'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  confirmSignUp,
  fetchUserAttributes,
  getCurrentUser,
  signIn,
  signOut,
  signUp,
} from 'aws-amplify/auth';
import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';

Amplify.configure(outputs);

type CustomAuthPageProps = {
  initialStep?: 'SIGN_UP' | 'SIGN_IN';
  children?: (auth: {
    user: (Awaited<ReturnType<typeof getCurrentUser>> & {
      nickname?: string;
    }) | null;
    signOut: () => Promise<void>;
  }) => React.ReactNode;
};

type AuthUser = Awaited<ReturnType<typeof getCurrentUser>> & {
  nickname?: string;
};

export default function CustomAuthPage({ initialStep = 'SIGN_IN', children }: CustomAuthPageProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'SIGN_UP' | 'CONFIRM' | 'SIGN_IN'>(initialStep);

  useEffect(() => {
    getAuthenticatedUser()
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (children && !isLoading && !user) {
      router.replace('/login');
    }
  }, [children, isLoading, router, user]);

  useEffect(() => {
    if (!children && !isLoading && user) {
      router.replace('/dashboard');
    }
  }, [children, isLoading, router, user]);

  const getAuthenticatedUser = async () => {
    const currentUser = await getCurrentUser();
    const attributes = await fetchUserAttributes();

    setUser({
      ...currentUser,
      nickname: attributes.nickname,
    });
  };

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
  };

  // 회원가입 요청
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            ...(nickname.trim() ? { nickname: nickname.trim() } : {}),
          },
        },
      });
      alert('인증 코드가 이메일로 전송되었습니다.');
      setStep('CONFIRM');
    } catch (error: any) {
      alert(error.message);
    }
  };

  // 이메일 인증코드 확인
  const handleConfirmSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
      alert('회원가입이 완료되었습니다! 로그인해 주세요.');
      setStep('SIGN_IN');
    } catch (error: any) {
      alert(error.message);
    }
  };

  // 로그인 요청
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { isSignedIn } = await signIn({ username: email, password });
      if (isSignedIn) {
        await getAuthenticatedUser();
        window.location.href = '/dashboard'; // 로그인 성공 시 이동
      }
    } catch (error: any) {
      alert(error.message);
    }
  };

  return (
    isLoading || (!children && user)
      ? null
      : children
        ? children({ user, signOut: handleSignOut })
        : (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white border rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4 text-center">
        {step === 'SIGN_IN' && '로그인'}
        {step === 'SIGN_UP' && '회원가입'}
        {step === 'CONFIRM' && '이메일 인증'}
      </h2>

      {step === 'SIGN_IN' && (
        <form onSubmit={handleSignIn} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="p-2 border rounded"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-2 border rounded"
          />
          <button type="submit" className="bg-teal-600 text-white p-2 rounded">로그인</button>
          <button type="button" onClick={() => setStep('SIGN_UP')} className="text-sm text-gray-500">
            계정이 없으신가요? 회원가입
          </button>
        </form>
      )}

      {step === 'SIGN_UP' && (
        <form onSubmit={handleSignUp} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="닉네임"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="p-2 border rounded"
          />
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="p-2 border rounded"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-2 border rounded"
          />
          <button type="submit" className="bg-teal-600 text-white p-2 rounded">회원가입</button>
          <button type="button" onClick={() => setStep('SIGN_IN')} className="text-sm text-gray-500">
            이미 계정이 있으신가요? 로그인
          </button>
        </form>
      )}

      {step === 'CONFIRM' && (
        <form onSubmit={handleConfirmSignUp} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="인증코드 6자리"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="p-2 border rounded"
          />
          <button type="submit" className="bg-teal-600 text-white p-2 rounded">인증 완료</button>
        </form>
      )}
    </div>
      )
  );
}