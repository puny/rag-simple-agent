import { defineStorage } from '@aws-amplify/backend';

export const libraryStorage = defineStorage({
  name: 'libraryStorage',
  access: (allow) => ({
    'library/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
      allow.groups(['ADMINS', 'GENERAL', 'PREMIUM']).to(['read', 'write', 'delete']),
    ],
  }),
});
