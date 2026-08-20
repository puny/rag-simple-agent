'use client';

import { useState } from 'react';
import { signUp } from 'aws-amplify/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    try {
      const result = await signUp({
        username: email,        
        password,
        options: {
          userAttributes: {
            email,
            nickname: nickname,
          },
        },
      });

      if (result.nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
        setSuccess('회원가입 요청이 완료되었습니다. 이메일 인증을 진행해 주세요.');
        setTimeout(() => {
          router.push('/login');
        }, 1500);
        return;
      }

      if (result.isSignUpComplete) {
        setSuccess('회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.');
        setTimeout(() => {
          router.push('/login');
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || '회원가입에 실패했습니다.');
    }
  };

  return (
    <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {error && <p style={{ color: 'red', fontSize: '14px', margin: 0 }}>{error}</p>}
      {success && <p style={{ color: 'green', fontSize: '14px', margin: 0 }}>{success}</p>}

      <div>
        <label style={{ display: 'block', fontSize: '14px', marginBottom: '6px' }}>이메일</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '14px', marginBottom: '6px' }}>닉네임</label>
        <input
          type="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
          style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '14px', marginBottom: '6px' }}>비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '14px', marginBottom: '6px' }}>비밀번호 확인</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
        />
      </div>

      <button
        type="submit"
        style={{ padding: '12px', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
      >
        회원가입
      </button>

      <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '14px' }}>
        이미 계정이 있으신가요? <Link href="/login" style={{ color: '#0070f3' }}>로그인</Link>
      </div>
    </form>
  );
}