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
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6 rounded-xl bg-white p-8 shadow-md border border-gray-100">
        {/* 서비스 로고 및 타이틀 영역 */}
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            My Amplify App
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            서비스 이용을 위해 로그인해 주세요
          </p>
        </div>

        {/* page.tsx 렌더링 영역 */}
        {children}
      </div>
    </div>
  );
}