'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import CustomAuthPage from '../CustomAuthenticator';

const client = generateClient<Schema>();
type MemberTier = 'GUEST' | 'GENERAL' | 'PREMIUM';

type AdminUser = {
  username: string;
  email?: string | null;
  nickname?: string | null;
  tier: MemberTier;
};

type TierConfig = {
  id: string;
  tier: MemberTier;
  modelIds: string[];
  monthlyQuestionLimit: number;
};

type UserMembership = {
  id: string;
  username: string;
  tier: MemberTier;
  startedAt: string;
  expiresAt: string;
  questionCount: number;
};

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [tierConfigs, setTierConfigs] = useState<TierConfig[]>([]);
  const [memberships, setMemberships] = useState<UserMembership[]>([]);

  return (
    <CustomAuthPage>
      {({ user, signOut }) => {
        if (!user) {
          return null;
        }

        const isAdmin = user.groups?.includes('ADMINS') ?? false;

        if (!isAdmin) {
          return (
            <main className="min-h-dvh bg-slate-950 px-4 py-8 text-white">
              <p>관리자 권한이 필요합니다.</p>
            </main>
          );
        }

        return (
          <AdminContent
            users={users}
            setUsers={setUsers}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            errorMessage={errorMessage}
            setErrorMessage={setErrorMessage}
            signOut={signOut}
            tierConfigs={tierConfigs}
            setTierConfigs={setTierConfigs}
            memberships={memberships}
            setMemberships={setMemberships}
          />
        );
      }}
    </CustomAuthPage>
  );
}

function AdminContent({
  users,
  setUsers,
  isLoading,
  setIsLoading,
  errorMessage,
  setErrorMessage,
  signOut,
  tierConfigs,
  setTierConfigs,
  memberships,
  setMemberships,
}: {
  users: AdminUser[];
  setUsers: React.Dispatch<React.SetStateAction<AdminUser[]>>;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  errorMessage: string;
  setErrorMessage: React.Dispatch<React.SetStateAction<string>>;
  signOut: () => Promise<void>;
  tierConfigs: TierConfig[];
  setTierConfigs: React.Dispatch<React.SetStateAction<TierConfig[]>>;
  memberships: UserMembership[];
  setMemberships: React.Dispatch<React.SetStateAction<UserMembership[]>>;
}) {
  const router = useRouter();

  useEffect(() => {
    const loadUsers = client.queries.adminUsers;

    if (typeof loadUsers !== 'function') {
      setErrorMessage('관리자 API가 아직 배포되지 않았습니다. Amplify 백엔드를 먼저 배포해 주세요.');
      setIsLoading(false);
      return;
    }

    Promise.all([loadUsers(), client.models.MemberTierConfig.list(), client.models.UserMembership.list()])
      .then(([userResult, configResult, membershipResult]) => {
        const { data, errors } = userResult;
        if (errors?.length) {
          throw new Error(errors[0].message);
        }
        setUsers((data ?? []).filter((user): user is AdminUser => user !== null));
        setTierConfigs((configResult.data ?? [])
          .filter((config) => config !== null)
          .map((config) => ({
            id: config.id,
            tier: config.tier,
            modelIds: config.modelIds.filter((modelId): modelId is string => modelId !== null),
            monthlyQuestionLimit: config.monthlyQuestionLimit,
          })));
        setMemberships((membershipResult.data ?? [])
          .filter((membership) => membership !== null)
          .map((membership) => ({
            id: membership.id,
            username: membership.username,
            tier: membership.tier,
            startedAt: membership.startedAt,
            expiresAt: membership.expiresAt,
            questionCount: membership.questionCount,
          })));
      })
      .catch((error: Error) => setErrorMessage(error.message))
      .finally(() => setIsLoading(false));
  }, [setErrorMessage, setIsLoading, setUsers, setMemberships, setTierConfigs]);

  const saveTierConfig = async (config: TierConfig) => {
    setErrorMessage('');
    const result = await client.models.MemberTierConfig.update({
      id: config.id,
      tier: config.tier,
      modelIds: config.modelIds.filter(Boolean),
      monthlyQuestionLimit: Math.max(0, config.monthlyQuestionLimit),
    });

    if (result.errors?.length) {
      setErrorMessage(result.errors[0].message);
      return;
    }

    if (result.data) {
      setTierConfigs((current) => current.map((item) => item.id === config.id ? result.data as TierConfig : item));
    }
  };

  const createTierConfig = async (tier: MemberTier) => {
    const result = await client.models.MemberTierConfig.create({
      id: tier,
      tier,
      modelIds: [],
      monthlyQuestionLimit: tier === 'GUEST' ? 10 : 0,
    });

    if (result.errors?.length) {
      setErrorMessage(result.errors[0].message);
    } else if (result.data) {
      setTierConfigs((current) => [...current, result.data as TierConfig]);
    }
  };

  const updateTier = async (username: string, tier: MemberTier) => {
    setErrorMessage('');
    if (typeof client.mutations.updateMemberTier !== 'function') {
      setErrorMessage('관리자 API가 아직 배포되지 않았습니다. Amplify 백엔드를 먼저 배포해 주세요.');
      return;
    }

    const { data, errors } = await client.mutations.updateMemberTier({ username, tier });

    if (errors?.length) {
      setErrorMessage(errors[0].message);
      return;
    }

    if (data) {
      setUsers((currentUsers) => currentUsers.map((user) => (
        user.username === username ? { ...user, tier } : user
      )));

      const currentMembership = memberships.find((membership) => membership.username === username);
      const startedAt = new Date();
      const expiresAt = new Date(startedAt);
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      const membershipInput = {
        username,
        tier,
        startedAt: startedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        questionCount: currentMembership?.questionCount ?? 0,
      };
      const membershipResult = currentMembership
        ? await client.models.UserMembership.update({ id: currentMembership.id, ...membershipInput })
        : await client.models.UserMembership.create({ id: username, ...membershipInput });

      if (membershipResult.errors?.length) {
        setErrorMessage(membershipResult.errors[0].message);
      } else if (membershipResult.data) {
        setMemberships((current) => currentMembership
          ? current.map((item) => item.id === currentMembership.id ? membershipResult.data as UserMembership : item)
          : [...current, membershipResult.data as UserMembership]);
      }
    }
  };

  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-5 sm:px-6 sm:py-8">
      <section className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-slate-800 bg-white shadow-2xl shadow-slate-950/30">
        <header className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Admin</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">회원 등급 관리</h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) {
                  router.back();
                } else {
                  router.push('/dashboard');
                }
              }}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              ← 이전으로
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              로그아웃
            </button>
          </div>
        </header>

        <div className="p-5 sm:p-8">
          {isLoading && <p className="text-sm text-slate-500">회원을 불러오는 중...</p>}
          {errorMessage && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>}
          {!isLoading && !errorMessage && (
            <>
            <section className="mb-8 border-b border-slate-200 pb-8">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">등급별 사용 정책</h2>
              <div className="grid gap-4 lg:grid-cols-3">
                {(['GUEST', 'GENERAL', 'PREMIUM'] as MemberTier[]).map((tier) => {
                  const config = tierConfigs.find((item) => item.tier === tier);
                  if (!config) {
                    return (
                      <div key={tier} className="rounded-xl border border-dashed border-slate-300 p-4">
                        <p className="font-semibold text-slate-900">{tier}</p>
                        <button type="button" onClick={() => void createTierConfig(tier)} className="mt-3 text-sm font-semibold text-teal-700 hover:underline">설정 생성</button>
                      </div>
                    );
                  }

                  return (
                    <div key={tier} className="rounded-xl border border-slate-200 p-4">
                      <p className="font-semibold text-slate-900">{tier}</p>
                      <label className="mt-3 block text-xs font-semibold text-slate-500">사용 가능 모델 ID (줄바꿈으로 여러 개)</label>
                      <textarea
                        value={config.modelIds.join('\n')}
                        onChange={(event) => setTierConfigs((current) => current.map((item) => item.id === config.id ? { ...item, modelIds: event.target.value.split('\n') } : item))}
                        className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                      />
                      <label className="mt-3 block text-xs font-semibold text-slate-500">월 사용 횟수 (0은 무제한)</label>
                      <input
                        type="number"
                        min="0"
                        value={config.monthlyQuestionLimit}
                        onChange={(event) => setTierConfigs((current) => current.map((item) => item.id === config.id ? { ...item, monthlyQuestionLimit: Number(event.target.value) } : item))}
                        className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                      />
                      <button type="button" onClick={() => void saveTierConfig(config)} className="mt-3 rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800">저장</button>
                    </div>
                  );
                })}
              </div>
            </section>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-3 py-3 font-semibold">회원</th>
                    <th className="px-3 py-3 font-semibold">이메일</th>
                    <th className="px-3 py-3 font-semibold">등급</th>
                    <th className="px-3 py-3 font-semibold">전환일</th>
                    <th className="px-3 py-3 font-semibold">만료일</th>
                    <th className="px-3 py-3 font-semibold">사용 횟수</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const membership = memberships.find((item) => item.username === user.username);

                    return (
                    <tr key={user.username} className="border-b border-slate-100">
                      <td className="px-3 py-4 font-medium text-slate-900">{user.nickname ?? user.username}</td>
                      <td className="px-3 py-4 text-slate-600">{user.email ?? '-'}</td>
                      <td className="px-3 py-4">
                        <select
                          value={user.tier}
                          onChange={(event) => void updateTier(user.username, event.target.value as MemberTier)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                          aria-label={`${user.nickname ?? user.username} 등급`}
                        >
                          <option value="GUEST">게스트</option>
                          <option value="GENERAL">일반</option>
                          <option value="PREMIUM">프리미엄</option>
                        </select>
                      </td>
                      <td className="px-3 py-4 text-slate-600">{membership?.startedAt.slice(0, 10) ?? '-'}</td>
                      <td className="px-3 py-4 text-slate-600">{membership?.expiresAt.slice(0, 10) ?? '-'}</td>
                      <td className="px-3 py-4 text-slate-600">{membership?.questionCount ?? 0}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
