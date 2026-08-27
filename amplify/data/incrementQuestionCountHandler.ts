import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

type QuestionCountEvent = {
  identity?: {
    username?: string;
    claims?: Record<string, unknown>;
  };
};

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const getTier = (claims: Record<string, unknown> = {}) => {
  const groups = Array.isArray(claims['cognito:groups']) ? claims['cognito:groups'] : [];
  return groups.includes('PREMIUM') ? 'PREMIUM' : groups.includes('GENERAL') ? 'GENERAL' : 'GUEST';
};

export const handler = async (event: QuestionCountEvent) => {
  const username = event.identity?.username;
  const tableName = process.env.USER_MEMBERSHIP_TABLE_NAME;

  if (!username || !tableName) {
    throw new Error('Authenticated user and membership table are required');
  }

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + 1);
  const result = await dynamo.send(new UpdateCommand({
    TableName: tableName,
    Key: { id: username },
    UpdateExpression: 'SET #username = if_not_exists(#username, :username), #tier = if_not_exists(#tier, :tier), startedAt = if_not_exists(startedAt, :startedAt), expiresAt = if_not_exists(expiresAt, :expiresAt) ADD questionCount :one',
    ExpressionAttributeNames: { '#username': 'username', '#tier': 'tier' },
    ExpressionAttributeValues: {
      ':username': username,
      ':tier': getTier(event.identity?.claims),
      ':startedAt': now.toISOString(),
      ':expiresAt': expiresAt.toISOString(),
      ':one': 1,
    },
    ReturnValues: 'UPDATED_NEW',
  }));

  return Number(result.Attributes?.questionCount ?? 1);
};