import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { createLibraryLogger } from './libraryLogger.js';

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
  const { query, documentIds } = event.arguments;
  const startedAt = Date.now();
  let stage = 'validate';
  const logger = createLibraryLogger('library-search');

  logger.info('started', { queryCharacters: query.length, selectedDocumentCount: documentIds?.length ?? 0 });

  try {
    if (!owner || !tableName) {
      throw new Error('Library search is not configured');
    }

    stage = 'query.embed';
    const queryEmbedding = await embed(query);

    stage = 'chunks.scan';
    const result = await dynamo.send(new ScanCommand({
      TableName: tableName,
      FilterExpression: '#owner = :owner',
      ExpressionAttributeNames: { '#owner': 'owner' },
      ExpressionAttributeValues: { ':owner': owner },
    }));

    const hasLibrarySelection = documentIds !== undefined && documentIds !== null;
    const selectedDocumentIds = new Set(documentIds ?? []);
    const ownedChunks = (result.Items ?? []).map((item) => ({
      documentId: String(item.documentId),
      filename: String(item.filename),
      text: String(item.text),
      score: cosineSimilarity(queryEmbedding, JSON.parse(String(item.embedding))),
    }));
    const selectedChunks = ownedChunks
      .filter((item) => !hasLibrarySelection || selectedDocumentIds.has(item.documentId))
      .sort((left, right) => right.score - left.score);
    const matches = selectedChunks.slice(0, 5);

    logger.info('completed', {
      ownedChunkCount: ownedChunks.length,
      selectedChunkCount: selectedChunks.length,
      returnedCount: matches.length,
      topScores: matches.map(({ score }) => Number(score.toFixed(4))),
      durationMs: Date.now() - startedAt,
    });
    return matches.map(({ filename, text, score }) => ({ filename, text, score }));
  } catch (error) {
    logger.error(stage, error);
    throw error;
  }
};
