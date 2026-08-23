import { defineBackend } from '@aws-amplify/backend';
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { auth } from './auth/resource.js';
import { data, conversationHandler } from './data/resource.js';

const backend = defineBackend({
  auth,
  data,
  conversationHandler,
});

const account = backend.stack.account;

// const inferenceProfileArn =
//   "arn:aws:bedrock:ap-northeast-2:${account}:inference-profile/apac.anthropic.claude-sonnet-4-20250514-v1:0";

// const foundationModelArn =
//   "arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-20250514-v1:0";

const inferenceProfileArn =
  "arn:aws:bedrock:ap-northeast-2:${account}:inference-profile/apac.anthropic.claude-haiku-4-5-20250514-v1:0";

const foundationModelArn =
  "arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-20250514-v1:0";

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




