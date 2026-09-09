import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

type Event = {
  arguments: { query: string; documentIds?: string[] | null };
  identity?: { sub?: string };
};

const embed = async (text: string) => {
  const response = await bedrock.send(new InvokeModelCommand({
    modelId: 'amazon.titan-embed-text-v2:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({ inputText: text, dimensions: 1024, normalize: true }),
  }));
  const payload = JSON.parse(new TextDecoder().decode(response.body));
  return payload.embedding as number[];
};

const cosineSimilarity = (left: number[], right: number[]) => {
  let score = 0;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    score += left[index] * right[index];
  }
  return score;
};

export const handler = async (event: Event) => {
  const owner = event.identity?.sub;
  const tableName = process.env.LIBRARY_CHUNKS_TABLE_NAME;
  if (!owner || !tableName) {
    throw new Error('Library search is not configured');
  }

  const queryEmbedding = await embed(event.arguments.query);
  const hasLibrarySelection = event.arguments.documentIds !== undefined && event.arguments.documentIds !== null;
  const selectedDocumentIds = new Set(event.arguments.documentIds ?? []);
  const result = await dynamo.send(new ScanCommand({
    TableName: tableName,
    FilterExpression: '#owner = :owner',
    ExpressionAttributeNames: { '#owner': 'owner' },
    ExpressionAttributeValues: { ':owner': owner },
  }));

  return (result.Items ?? [])
    .map((item) => ({
      documentId: String(item.documentId),
      filename: String(item.filename),
      text: String(item.text),
      score: cosineSimilarity(queryEmbedding, JSON.parse(String(item.embedding))),
    }))
    .filter((item) => !hasLibrarySelection || selectedDocumentIds.has(String(item.documentId)))
    .filter((item) => item.score >= 0.35)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map(({ filename, text, score }) => ({ filename, text, score }));
};
