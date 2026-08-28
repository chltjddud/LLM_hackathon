'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Fredoka } from 'next/font/google';
import { supabase } from '@/lib/supabaseClient';

const fredoka = Fredoka({ subsets: ['latin'], weight: ['600', '700'] });

export default function LoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }
    if (isSignUp && !userName) {
      setError('사용자 이름을 입력해주세요.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        // Sign Up with userName metadata
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              user_name: userName,
            },
          },
        });
        if (signUpError) throw signUpError;
        
        // Auto login
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          alert('회원가입이 완료되었습니다. 로그인해주세요.');
          setIsSignUp(false);
          setLoading(false);
          return;
        }
      } else {
        // Sign In
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }

      // Success, redirect or go to home
      const redirectUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('redirect') || '/' : '/';
      router.push(redirectUrl);
      router.refresh();
    } catch (err: any) {
      setError(err.message || '인증에 실패했습니다. 입력값을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFC] flex justify-center items-center px-4">
      <main className="w-full max-w-md bg-white text-gray-900 flex flex-col rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-[#F3F0FF] p-8 py-12 justify-center">
        
        {/* Dynamic Header based on state */}
        {!isSignUp ? (
          <div className="text-center mb-10">
            <h1 className={`${fredoka.className} text-[46px] font-bold text-[#6542F1] tracking-tight`}>
              Sign In
            </h1>
          </div>
        ) : (
          <div className="text-center mb-10">
            <h1 className={`${fredoka.className} text-[42px] font-bold text-[#6542F1] leading-tight`}>
              Welcome !
            </h1>
            <h2 className={`${fredoka.className} text-[42px] font-bold text-[#6542F1] leading-none mb-3`}>
              SIGNAL
            </h2>
            <p className="text-[14px] text-gray-400 font-bold tracking-wide">
              Create Account To get started
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div>
            <label className="block text-[15px] font-semibold text-gray-800 mb-2 pl-4">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder=""
              className="w-full px-6 py-3.5 border-[2px] border-[#6542F1] rounded-full focus:outline-none focus:ring-4 focus:ring-[#6542F1]/10 bg-white text-[15px] font-semibold transition-all placeholder:text-gray-300"
            />
          </div>

          <div>
            <label className="block text-[15px] font-semibold text-gray-800 mb-2 pl-4">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=""
              className="w-full px-6 py-3.5 border-[2px] border-[#6542F1] rounded-full focus:outline-none focus:ring-4 focus:ring-[#6542F1]/10 bg-white text-[15px] font-semibold transition-all placeholder:text-gray-300"
            />
          </div>

          {isSignUp && (
            <div>
              <label className="block text-[15px] font-semibold text-gray-800 mb-2 pl-4">User name</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder=""
                className="w-full px-6 py-3.5 border-[2px] border-[#6542F1] rounded-full focus:outline-none focus:ring-4 focus:ring-[#6542F1]/10 bg-white text-[15px] font-semibold transition-all placeholder:text-gray-300"
              />
            </div>
          )}

          {error && (
            <div className="bg-[#FFF5F5] border border-[#FEE2E2] rounded-[16px] p-4 text-[13px] text-[#EF4444] font-semibold leading-relaxed">
              ⚠️ {error}
            </div>
          )}

          {/* Action Area */}
          <div className="flex flex-col items-center justify-center gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-1/2 min-w-[160px] py-3.5 bg-[#6542F1] text-white text-[16px] font-bold rounded-full shadow-[0_4px_14px_rgba(101,66,241,0.3)] hover:bg-[#573AC2] transition-colors disabled:bg-gray-300 disabled:shadow-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : !isSignUp ? (
                'Login'
              ) : (
                'Register'
              )}
            </button>

            {!isSignUp ? (
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setError(null);
                }}
                className="text-[15px] text-gray-800 font-bold underline mt-2 hover:text-[#573AC2] transition-colors"
              >
                Sign Up
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setError(null);
                }}
                className="text-[15px] text-gray-800 font-bold underline mt-2 hover:text-[#573AC2] transition-colors"
              >
                Sign In
              </button>
            )}
          </div>

        </form>

        {/* Back Link */}
        <div className="text-center mt-8">
          <Link href="/" className="text-[13px] text-gray-400 font-bold hover:text-gray-600 transition-colors">
            홈으로 돌아가기
          </Link>
        </div>

      </main>
    </div>
  );
}
