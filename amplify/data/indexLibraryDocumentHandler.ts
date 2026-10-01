import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DeleteCommand, DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getDocument, PDFWorker } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { WorkerMessageHandler } from 'pdfjs-dist/legacy/build/pdf.worker.mjs';

const s3 = new S3Client({});
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

Object.defineProperty(PDFWorker, '_setupFakeWorkerGlobal', {
  configurable: true,
  value: Promise.resolve(WorkerMessageHandler),
});

type Event = {
  arguments: { documentId: string; s3Key: string; filename: string; contentType: string; size: number };
  identity?: { sub?: string };
};

const logInfo = (documentId: string, event: string, details: Record<string, unknown> = {}) => {
  console.info(JSON.stringify({ component: 'library-indexing', documentId, event, ...details }));
};

const logError = (documentId: string, stage: string, error: unknown) => {
  console.error(JSON.stringify({
    component: 'library-indexing',
    documentId,
    event: 'failed',
    stage,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  }));
};

const getBodyBytes = async (body: unknown) => {
  if (!body || typeof body !== 'object' || !('transformToByteArray' in body)) {
    throw new Error('Unable to read the uploaded document');
  }
  return (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
};

const extractPdfText = async (bytes: Uint8Array, documentId: string) => {
  const startedAt = Date.now();
  logInfo(documentId, 'pdf.parse.started', { sizeBytes: bytes.byteLength });
  const document = await getDocument({ data: bytes }).promise;
  try {
    logInfo(documentId, 'pdf.opened', { pageCount: document.numPages });
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join('');
      pages.push(pageText);
      page.cleanup();
      if (pageNumber === 1 || pageNumber % 10 === 0 || pageNumber === document.numPages) {
        logInfo(documentId, 'pdf.page.extracted', {
          pageNumber,
          pageCount: document.numPages,
          textCharacters: pageText.length,
        });
      }
    }
    const text = pages.join('\n\n');
    logInfo(documentId, 'pdf.parse.completed', {
      pageCount: document.numPages,
      textCharacters: text.length,
      durationMs: Date.now() - startedAt,
    });
    return text;
  } finally {
    await document.destroy();
  }
};

const getDocumentText = async (body: unknown, contentType: string, filename: string, documentId: string) => {
  const bytes = await getBodyBytes(body);
  logInfo(documentId, 'document.bytes.read', { sizeBytes: bytes.byteLength });
  if (contentType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) {
    return (await extractPdfText(bytes, documentId)).trim();
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
  const startedAt = Date.now();
  let stage = 'validate';

  logInfo(documentId, 'started', { contentType, sizeBytes: size });

  try {
    if (!owner || !bucket || !documentsTable || !chunksTable) {
      throw new Error('Library indexing is not configured');
    }

    stage = 's3.download';
    logInfo(documentId, 's3.download.started');
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: s3Key }));
    logInfo(documentId, 's3.download.completed');

    stage = 'document.extract';
    const content = await getDocumentText(object.Body, contentType, filename, documentId);
    logInfo(documentId, 'document.extracted', { textCharacters: content.length });

    stage = 'chunks.split';
    const chunks = splitIntoChunks(content);
    logInfo(documentId, 'chunks.split', { chunkCount: chunks.length });

    stage = 'chunks.scan';
    const oldChunks = await dynamo.send(new ScanCommand({
      TableName: chunksTable,
      FilterExpression: '#owner = :owner AND documentId = :documentId',
      ExpressionAttributeNames: { '#owner': 'owner' },
      ExpressionAttributeValues: { ':owner': owner, ':documentId': documentId },
    }));
    logInfo(documentId, 'chunks.previous.scan.completed', { chunkCount: oldChunks.Items?.length ?? 0 });
    for (const oldChunk of oldChunks.Items ?? []) {
      await dynamo.send(new DeleteCommand({
        TableName: chunksTable,
        Key: { id: oldChunk.id },
      }));
    }

    for (const [index, text] of chunks.entries()) {
      stage = `chunk.${index + 1}.embed`;
      logInfo(documentId, 'chunk.embedding.started', { chunkNumber: index + 1, chunkCount: chunks.length });
      const embedding = await embed(text);
      stage = `chunk.${index + 1}.save`;
      await dynamo.send(new PutCommand({
        TableName: chunksTable,
        Item: {
          id: `${documentId}-${index}`,
          owner,
          documentId,
          filename,
          text,
          embedding: JSON.stringify(embedding),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }));
      logInfo(documentId, 'chunk.saved', { chunkNumber: index + 1, chunkCount: chunks.length });
    }

    stage = 'document.save';
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
    logInfo(documentId, 'completed', { status: item.status, chunkCount: chunks.length, durationMs: Date.now() - startedAt });
    return item;
  } catch (error) {
    logError(documentId, stage, error);
    throw error;
  }
};
