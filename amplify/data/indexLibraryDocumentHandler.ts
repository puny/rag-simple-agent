import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DeleteCommand, DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { PDFParse } from 'pdf-parse';

const s3 = new S3Client({});
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

type Event = {
  arguments: { documentId: string; s3Key: string; filename: string; contentType: string; size: number };
  identity?: { sub?: string };
};

const getBodyBytes = async (body: unknown) => {
  if (!body || typeof body !== 'object' || !('transformToByteArray' in body)) {
    throw new Error('Unable to read the uploaded document');
  }
  return (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
};

const getDocumentText = async (body: unknown, contentType: string, filename: string) => {
  const bytes = await getBodyBytes(body);
  if (contentType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) {
    const parser = new PDFParse({ data: bytes });
    try {
      const result = await parser.getText();
      return result.text.trim();
    } finally {
      await parser.destroy();
    }
  }
  return new TextDecoder().decode(bytes);
};

const splitIntoChunks = (content: string) => {
  const chunks: string[] = [];
  const paragraphs = content.split(/\n\s*\n/).map((text) => text.trim()).filter(Boolean);
  for (const paragraph of paragraphs) {
    for (let offset = 0; offset < paragraph.length; offset += 6000) {
      chunks.push(paragraph.slice(offset, offset + 6000));
    }
  }
  return chunks;
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

export const handler = async (event: Event) => {
  const owner = event.identity?.sub;
  const { documentId, s3Key, filename, contentType, size } = event.arguments;
  const bucket = process.env.LIBRARY_BUCKET_NAME;
  const documentsTable = process.env.LIBRARY_DOCUMENTS_TABLE_NAME;
  const chunksTable = process.env.LIBRARY_CHUNKS_TABLE_NAME;

  if (!owner || !bucket || !documentsTable || !chunksTable) {
    throw new Error('Library indexing is not configured');
  }

  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: s3Key }));
  const content = await getDocumentText(object.Body, contentType, filename);
  const chunks = splitIntoChunks(content);

  const oldChunks = await dynamo.send(new ScanCommand({
    TableName: chunksTable,
    FilterExpression: '#owner = :owner AND documentId = :documentId',
    ExpressionAttributeNames: { '#owner': 'owner' },
    ExpressionAttributeValues: { ':owner': owner, ':documentId': documentId },
  }));
  for (const oldChunk of oldChunks.Items ?? []) {
    await dynamo.send(new DeleteCommand({
      TableName: chunksTable,
      Key: { id: oldChunk.id },
    }));
  }

  for (const [index, text] of chunks.entries()) {
    await dynamo.send(new PutCommand({
      TableName: chunksTable,
      Item: {
        id: `${documentId}-${index}`,
        owner,
        documentId,
        filename,
        text,
        embedding: JSON.stringify(await embed(text)),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  const item = {
    id: documentId,
    owner,
    filename,
    s3Key,
    contentType,
    size,
    status: chunks.length > 0 ? 'READY' : 'FAILED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await dynamo.send(new PutCommand({ TableName: documentsTable, Item: item }));
  return item;
};
