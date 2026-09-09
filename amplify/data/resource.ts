import { type ClientSchema, a, defineData, defineFunction } from '@aws-amplify/backend';

import {
  defineConversationHandlerFunction,
} from "@aws-amplify/backend-ai/conversation";

export const model =
  "anthropic.claude-sonnet-4-5-20250929-v1:0";

export const crossRegionModel =
  "global.anthropic.claude-sonnet-4-5-20250929-v1:0";


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

export const adminUserHandler = defineFunction({
  entry: './adminUserHandler.ts',
});

export const updateMemberTierHandler = defineFunction({
  entry: './updateMemberTierHandler.ts',
});

export const incrementQuestionCountHandler = defineFunction({
  entry: './incrementQuestionCountHandler.ts',
  resourceGroupName: 'data',
});

export const indexLibraryDocumentHandler = defineFunction({
  entry: './indexLibraryDocumentHandler.ts',
  resourceGroupName: 'data',
});

export const searchLibraryHandler = defineFunction({
  entry: './searchLibraryHandler.ts',
  resourceGroupName: 'data',
});


const schema = a.schema({   
  MemberTier: a.enum(['GUEST', 'GENERAL', 'PREMIUM']),
  MemberTierConfig: a.model({
    id: a.id().required(),
    tier: a.ref('MemberTier').required(),
    modelIds: a.string().array().required(),
    monthlyQuestionLimit: a.integer().required(),
  }).authorization((allow) => [allow.group('ADMINS'), allow.authenticated().to(['read'])]),
  UserMembership: a.model({
    username: a.string().required(),
    tier: a.ref('MemberTier').required(),
    startedAt: a.datetime().required(),
    expiresAt: a.datetime().required(),
    questionCount: a.integer().required(),
  }).authorization((allow) => [allow.group('ADMINS'), allow.owner()]),
  LibraryDocument: a.model({
    filename: a.string().required(),
    s3Key: a.string().required(),
    contentType: a.string().required(),
    size: a.integer().required(),
    status: a.enum(['PROCESSING', 'READY', 'FAILED']),
  }).authorization((allow) => [allow.owner()]),
  LibraryChunk: a.model({
    documentId: a.string().required(),
    filename: a.string().required(),
    text: a.string().required(),
    embedding: a.string().required(),
  }).authorization((allow) => [allow.owner()]),
  AdminUser: a.customType({
    username: a.string().required(),
    email: a.string(),
    nickname: a.string(),
    tier: a.ref('MemberTier').required(),
  }),
  adminUsers: a.query()
    .returns(a.ref('AdminUser').array())
    .authorization((allow) => [allow.group('ADMINS')])
    .handler(a.handler.function(adminUserHandler)),
  updateMemberTier: a.mutation()
    .arguments({
      username: a.string().required(),
      tier: a.ref('MemberTier').required(),
    })
    .returns(a.ref('AdminUser'))
    .authorization((allow) => [allow.group('ADMINS')])
    .handler(a.handler.function(updateMemberTierHandler)),
  incrementQuestionCount: a.mutation()
    .returns(a.integer().required())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(incrementQuestionCountHandler)),
  indexLibraryDocument: a.mutation()
    .arguments({
      documentId: a.id().required(),
      s3Key: a.string().required(),
      filename: a.string().required(),
      contentType: a.string().required(),
      size: a.integer().required(),
    })
    .returns(a.ref('LibraryDocument'))
    .authorization((allow) => allow.authenticated())
    .handler(a.handler.function(indexLibraryDocumentHandler)),
  searchLibrary: a.query()
    .arguments({
      query: a.string().required(),
      documentIds: a.string().array(),
    })
    .returns(a.ref('LibrarySearchResult').array())
    .authorization((allow) => allow.authenticated())
    .handler(a.handler.function(searchLibraryHandler)),
  LibrarySearchResult: a.customType({
    filename: a.string().required(),
    text: a.string().required(),
    score: a.float().required(),
  }),
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