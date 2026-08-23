import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

import {
  defineConversationHandlerFunction,
} from "@aws-amplify/backend-ai/conversation";

export const model =
  "anthropic.claude-sonnet-4-5-20250929-v1:0";

export const crossRegionModel =
  "global.anthropic.claude-sonnet-4-5-20250929-v1:0";

// export const crossRegionModel =
//   "global.anthropic.claude-haiku-4-5-20250514-v1:0";


export const conversationHandler =
  defineConversationHandlerFunction({
    entry: "./conversationHandler.ts",
    name: "conversationHandler",
    models: [
      {
        modelId: crossRegionModel,
        region: "ap-northeast-2",
      },
    ],
  });


const schema = a.schema({   
  chat: a.conversation({    
    aiModel: {resourcePath: crossRegionModel,},
    systemPrompt: 'You are a helpful assistant',
    handler: conversationHandler,
  })
  .authorization((allow) => allow.owner()),
    
  generateRecipe: a.generation({
    aiModel: {resourcePath: crossRegionModel,},
    systemPrompt: 'You are a helpful assistant that generates recipes.',    
  })
  .arguments({
    description: a.string(),
  })
  .returns(
    a.customType({
      name: a.string(),
      ingredients: a.string().array(),
      instructions: a.string(),
    })
  )
  .authorization((allow) => allow.authenticated()),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  }
});