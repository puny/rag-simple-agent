import {
  AdminAddUserToGroupCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';

type MemberTier = 'GUEST' | 'GENERAL' | 'PREMIUM';

type AdminEvent = {
  arguments: { username?: string; tier?: MemberTier };
};

const client = new CognitoIdentityProviderClient({});
const tierGroups = ['GENERAL', 'PREMIUM'] as const;

const getUserAttributes = (attributes: Array<{ Name?: string; Value?: string }> = []) =>
  Object.fromEntries(attributes.map((attribute) => [attribute.Name, attribute.Value]));

export const handler = async (event: AdminEvent) => {
  const poolId = process.env.USER_POOL_ID;
  const username = event.arguments.username;
  const tier = event.arguments.tier;

  if (!poolId) {
    throw new Error('USER_POOL_ID is not configured');
  }

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
    username: user?.Username ?? username,
    email: attributes.email,
    nickname: attributes.nickname,
    tier,
  };
};
