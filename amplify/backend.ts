import { defineBackend } from '@aws-amplify/backend';
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';
import { auth } from './auth/resource.js';
import { adminUserHandler, data, conversationHandler, crossRegionModel, model, updateMemberTierHandler } from './data/resource.js';

const backend = defineBackend({
  auth,
  data,
  conversationHandler,
  adminUserHandler,
  updateMemberTierHandler,
});

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




