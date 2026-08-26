/// <reference types="node" />

import {
  AdminAddUserToGroupCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
const client = new CognitoIdentityProviderClient({});
const tierGroups = ['GENERAL', 'PREMIUM'] as const;

type MemberTier = 'GUEST' | 'GENERAL' | 'PREMIUM';

type AdminEvent = {
  info?: { fieldName?: string };
  arguments: { username?: string; tier?: MemberTier };
};

type CognitoUser = {
  username: string;
  email?: string;
  nickname?: string;
  tier: MemberTier;
};

const getUserAttributes = (attributes: Array<{ Name?: string; Value?: string }> = []) =>
  Object.fromEntries(attributes.map((attribute) => [attribute.Name, attribute.Value]));

const getTier = (groups: string[]): MemberTier => {
  if (groups.includes('PREMIUM')) {
    return 'PREMIUM';
  }

  if (groups.includes('GENERAL')) {
    return 'GENERAL';
  }

  return 'GUEST';
};

export const handler = async (event: AdminEvent) => {
  const adminEvent = event;
  const poolId = process.env.USER_POOL_ID;

  if (!poolId) {
    throw new Error('USER_POOL_ID is not configured');
  }

  if (adminEvent.info?.fieldName === 'updateMemberTier') {
    const username = adminEvent.arguments.username;
    const tier = adminEvent.arguments.tier;

    if (!username || !tier) {
      throw new Error('username and tier are required');
    }

    const currentGroups = await client.send(new AdminListGroupsForUserCommand({
      UserPoolId: poolId,
      Username: username,
    }));

    for (const group of tierGroups) {
      if (currentGroups.Groups?.some((currentGroup) => currentGroup.GroupName === group)) {
        await client.send(new AdminRemoveUserFromGroupCommand({
          UserPoolId: poolId,
          Username: username,
          GroupName: group,
        }));
      }
    }

    if (tier !== 'GUEST') {
      await client.send(new AdminAddUserToGroupCommand({
        UserPoolId: poolId,
        Username: username,
        GroupName: tier,
      }));
    }

    const userResult = await client.send(new ListUsersCommand({
      UserPoolId: poolId,
      Filter: `username = "${username}"`,
      Limit: 1,
    }));
    const user = userResult.Users?.[0];
    const attributes = getUserAttributes(user?.Attributes);

    return {
      username,
      email: attributes.email,
      nickname: attributes.nickname,
      tier,
    };
  }

  const result = await client.send(new ListUsersCommand({
    UserPoolId: poolId,
  }));

  const users = await Promise.all((result.Users ?? []).map(async (user): Promise<CognitoUser> => {
    const username = user.Username ?? '';
    const attributes = getUserAttributes(user.Attributes);
    const groups = await client.send(new AdminListGroupsForUserCommand({
      UserPoolId: poolId,
      Username: username,
    }));

    return {
      username,
      email: attributes.email,
      nickname: attributes.nickname,
      tier: getTier(groups.Groups?.map((group) => group.GroupName ?? '') ?? []),
    };
  }));

  return users;
};
