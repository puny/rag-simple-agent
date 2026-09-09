import { defineBackend } from '@aws-amplify/backend';
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { auth } from './auth/resource.js';
import { adminUserHandler, data, conversationHandler, crossRegionModel, model, updateMemberTierHandler, incrementQuestionCountHandler, indexLibraryDocumentHandler, searchLibraryHandler } from './data/resource.js';
import { libraryStorage } from './storage/resource.js';

const backend = defineBackend({
  auth,
  data,
  conversationHandler,
  adminUserHandler,
  updateMemberTierHandler,
  incrementQuestionCountHandler,
  indexLibraryDocumentHandler,
  searchLibraryHandler,
  libraryStorage,
});

const findUserMembershipTable = (scope: Construct): Table | undefined => {
  for (const child of scope.node.children) {
    if (child.node.id.includes('UserMembership') && 'tableName' in child) {
      return child as Table;
    }

    const nestedTable = findUserMembershipTable(child);
    if (nestedTable) {
      return nestedTable;
    }
  }

  return undefined;
};

const findTable = (scope: Construct, name: string): Table | undefined => {
  for (const child of scope.node.children) {
    if (child.node.id.includes(name) && 'tableName' in child) {
      return child as Table;
    }
    const nestedTable = findTable(child, name);
    if (nestedTable) return nestedTable;
  }
  return undefined;
};

const userMembershipTable = findUserMembershipTable(backend.data.stack);
const libraryDocumentsTable = findTable(backend.data.stack, 'LibraryDocument');
const libraryChunksTable = findTable(backend.data.stack, 'LibraryChunk');

if (!userMembershipTable) {
  throw new Error('Unable to find the UserMembership DynamoDB table');
}
if (!libraryDocumentsTable || !libraryChunksTable) {
  throw new Error('Unable to find library DynamoDB tables');
}

const account = backend.stack.account;

const inferenceProfileArn =
  `arn:aws:bedrock:ap-northeast-2:${account}:inference-profile/${crossRegionModel}`;

const foundationModelArn =
  `arn:aws:bedrock:*::foundation-model/${model}`;

backend.conversationHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream",
    ],
    resources: [
      inferenceProfileArn,
      foundationModelArn,
    ],
  }),
);

for (const handler of [backend.indexLibraryDocumentHandler, backend.searchLibraryHandler]) {
  const lambda = handler.resources.lambda as LambdaFunction;
  lambda.addToRolePolicy(new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['bedrock:InvokeModel'],
    resources: ['arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-v2:0'],
  }));
  lambda.addEnvironment('LIBRARY_DOCUMENTS_TABLE_NAME', libraryDocumentsTable.tableName);
  lambda.addEnvironment('LIBRARY_CHUNKS_TABLE_NAME', libraryChunksTable.tableName);
  lambda.addToRolePolicy(new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['dynamodb:Scan', 'dynamodb:PutItem', 'dynamodb:DeleteItem'],
    resources: [libraryChunksTable.tableArn],
  }));
}

const indexLibraryDocumentLambda = backend.indexLibraryDocumentHandler.resources.lambda as LambdaFunction;
indexLibraryDocumentLambda.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['dynamodb:PutItem', 'dynamodb:Scan', 'dynamodb:DeleteItem'],
  resources: [libraryDocumentsTable.tableArn],
}));
backend.libraryStorage.resources.bucket.grantRead(indexLibraryDocumentLambda);
indexLibraryDocumentLambda.addEnvironment(
  'LIBRARY_BUCKET_NAME',
  backend.libraryStorage.resources.bucket.bucketName,
);
(backend.adminUserHandler.resources.lambda as LambdaFunction).addEnvironment(
  'USER_POOL_ID',
  backend.auth.resources.userPool.userPoolId,
);

backend.adminUserHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      'cognito-idp:ListUsers',
      'cognito-idp:AdminListGroupsForUser',
      'cognito-idp:AdminAddUserToGroup',
      'cognito-idp:AdminRemoveUserFromGroup',
    ],
    resources: [backend.auth.resources.userPool.userPoolArn],
  }),
);

(backend.updateMemberTierHandler.resources.lambda as LambdaFunction).addEnvironment(
  'USER_POOL_ID',
  backend.auth.resources.userPool.userPoolId,
);

backend.updateMemberTierHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      'cognito-idp:ListUsers',
      'cognito-idp:AdminListGroupsForUser',
      'cognito-idp:AdminAddUserToGroup',
      'cognito-idp:AdminRemoveUserFromGroup',
    ],
    resources: [backend.auth.resources.userPool.userPoolArn],
  }),
);

(backend.incrementQuestionCountHandler.resources.lambda as LambdaFunction).addEnvironment(
  'USER_MEMBERSHIP_TABLE_NAME',
  userMembershipTable.tableName,
);

(backend.incrementQuestionCountHandler.resources.lambda as LambdaFunction).addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['dynamodb:UpdateItem'],
    resources: [userMembershipTable.tableArn],
  }),
);




