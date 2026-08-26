'use client';

import { useEffect, useState } from 'react';
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

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

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
}: {
  users: AdminUser[];
  setUsers: React.Dispatch<React.SetStateAction<AdminUser[]>>;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  errorMessage: string;
  setErrorMessage: React.Dispatch<React.SetStateAction<string>>;
  signOut: () => Promise<void>;
}) {
  useEffect(() => {
    const loadUsers = client.queries.adminUsers;

    if (typeof loadUsers !== 'function') {
      setErrorMessage('관리자 API가 아직 배포되지 않았습니다. Amplify 백엔드를 먼저 배포해 주세요.');
      setIsLoading(false);
      return;
    }

    loadUsers()
      .then(({ data, errors }) => {
        if (errors?.length) {
          throw new Error(errors[0].message);
        }
        setUsers((data ?? []) as AdminUser[]);
      })
      .catch((error: Error) => setErrorMessage(error.message))
      .finally(() => setIsLoading(false));
  }, [setErrorMessage, setIsLoading, setUsers]);

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
          <button
            type="button"
            onClick={() => void signOut()}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            로그아웃
          </button>
        </header>

        <div className="p-5 sm:p-8">
          {isLoading && <p className="text-sm text-slate-500">회원을 불러오는 중...</p>}
          {errorMessage && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>}
          {!isLoading && !errorMessage && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-3 py-3 font-semibold">회원</th>
                    <th className="px-3 py-3 font-semibold">이메일</th>
                    <th className="px-3 py-3 font-semibold">등급</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
