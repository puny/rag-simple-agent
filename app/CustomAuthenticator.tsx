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
    <div className="w-full">
      <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
        {step === 'SIGN_IN' && '로그인'}
        {step === 'SIGN_UP' && '회원가입'}
        {step === 'CONFIRM' && '이메일 인증'}
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        {step === 'SIGN_IN' && '계정에 로그인해 작업을 계속하세요.'}
        {step === 'SIGN_UP' && '새 계정을 만들고 바로 시작하세요.'}
        {step === 'CONFIRM' && '이메일로 받은 인증 코드를 입력하세요.'}
      </p>

      {step === 'SIGN_IN' && (
        <form onSubmit={handleSignIn} className="mt-6 flex flex-col gap-4">
          <input
            type="email"
            placeholder="이메일"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-12 w-full rounded-lg border border-slate-300 px-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
          />
          <input
            type="password"
            placeholder="비밀번호"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-12 w-full rounded-lg border border-slate-300 px-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
          />
          <button type="submit" className="min-h-12 w-full rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-4 focus:ring-teal-200">
            로그인
          </button>
          <button type="button" onClick={() => setStep('SIGN_UP')} className="min-h-11 text-sm font-medium text-teal-700 underline-offset-4 hover:underline">
            계정이 없으신가요? 회원가입
          </button>
        </form>
      )}

      {step === 'SIGN_UP' && (
        <form onSubmit={handleSignUp} className="mt-6 flex flex-col gap-4">
          <input
            type="text"
            placeholder="닉네임"
            required
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="min-h-12 w-full rounded-lg border border-slate-300 px-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
          />
          <input
            type="email"
            placeholder="이메일"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-12 w-full rounded-lg border border-slate-300 px-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
          />
          <input
            type="password"
            placeholder="비밀번호"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-12 w-full rounded-lg border border-slate-300 px-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
          />
          <button type="submit" className="min-h-12 w-full rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-4 focus:ring-teal-200">
            회원가입
          </button>
          <button type="button" onClick={() => setStep('SIGN_IN')} className="min-h-11 text-sm font-medium text-teal-700 underline-offset-4 hover:underline">
            이미 계정이 있으신가요? 로그인
          </button>
        </form>
      )}

      {step === 'CONFIRM' && (
        <form onSubmit={handleConfirmSignUp} className="mt-6 flex flex-col gap-4">
          <input
            type="text"
            placeholder="인증코드 6자리"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="min-h-12 w-full rounded-lg border border-slate-300 px-4 text-base tracking-[0.3em] text-slate-900 outline-none transition placeholder:tracking-normal placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
          />
          <button type="submit" className="min-h-12 w-full rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-4 focus:ring-teal-200">인증 완료</button>
        </form>
      )}
    </div>
      )
  );
}