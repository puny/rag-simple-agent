'use client';

import { getCurrentUser } from 'aws-amplify/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then(() => router.replace('/dashboard'))
      .catch(() => setIsReady(true));
  }, [router]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-slate-950 px-4 py-6 sm:px-6 sm:py-10">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-white shadow-2xl shadow-slate-950/30">
        <div className="bg-teal-700 px-6 py-7 text-white sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-100">
            RAG Simple App
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            지식에 더 빠르게 닿는 공간
          </h1>
          <p className="mt-2 text-sm leading-6 text-teal-50">
            서비스 이용을 위해 계정으로 시작해 주세요.
          </p>
        </div>
        <div className="px-5 py-6 sm:px-8 sm:py-8">{children}</div>
      </div>
    </main>
  );
}