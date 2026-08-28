'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseClient';

type SessionRow = {
  id: string;
  status: string;
  created_at: string;
};

const STATUS_LABEL: Record<string, { text: string; bg: string; color: string }> = {
  analyzing: { text: '분석 중', bg: '#EAF2FF', color: '#2563EB' },
  negotiating: { text: '협의 중', bg: '#F4F1FF', color: '#7C3AED' },
  ready_to_sign: { text: '서명 대기', bg: '#FFF7E6', color: '#B45309' },
  completed: { text: '계약 완료', bg: '#F4F1FF', color: '#6542F1' },
};

export default function Home() {
  const [email, setEmail] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(async ({ data: { session } }) => {
      setEmail(session?.user.email ?? null);
      setCheckingAuth(false);

      if (session?.access_token) {
        const res = await fetch('/api/my-sessions', {
          headers: { authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSessions(data.sessions ?? []);
        }
      }
    });
  }, []);

  const handleLogout = async () => {
    await supabaseBrowser.auth.signOut();
    setEmail(null);
    setSessions(null);
  };

  const inProgress = sessions?.filter((s) => s.status !== 'completed') ?? [];
  const completed = sessions?.filter((s) => s.status === 'completed') ?? [];

  return (
    <div className="min-h-screen bg-[#F9FAFC] flex justify-center">
      <main className="w-full max-w-md bg-[#F9FAFC] text-gray-900 flex flex-col relative pb-10 shadow-sm min-h-screen">
        {/* Header */}
        <header className="flex items-center justify-between px-6 pt-10 pb-4">
          <h1 className="text-[26px] font-extrabold tracking-tight" style={{ color: '#6542F1' }}>SIGNAL</h1>
          {!checkingAuth && (
            email ? (
              <button
                onClick={handleLogout}
                className="text-[13px] font-bold text-gray-500 hover:text-gray-700"
              >
                로그아웃
              </button>
            ) : (
              <Link
                href="/login"
                className="text-[13px] font-bold"
                style={{ color: '#6542F1' }}
              >
                로그인
              </Link>
            )
          )}
        </header>

        <div className="px-6 border-b border-gray-200/60 mx-6 mb-8"></div>

        {/* Greeting */}
        <section className="px-6 mb-8">
          <h2 className="text-[24px] font-bold leading-snug mb-2 text-gray-900 tracking-tight">
            {email ? `안녕하세요, ${email.split('@')[0]}님!` : '안녕하세요!'}
          </h2>
          <p className="text-[16px] text-gray-500 font-medium">
            {email ? '계약을 안전하게 관리하세요.' : '로그인하면 내 계약을 저장하고 관리할 수 있어요.'}
          </p>
        </section>

        {/* Primary Action Card */}
        <section className="px-6 mb-12">
          <Link href="/upload" className="block relative overflow-hidden rounded-[28px] p-7 shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]" style={{ background: 'linear-gradient(135deg, #6747D5 0%, #573AC2 100%)' }}>
            <div className="relative z-10 text-white">
              <h3 className="text-[22px] font-bold mb-3 tracking-tight">새 계약 요청</h3>
              <p className="text-[15px] font-medium text-white/90 leading-relaxed mb-6">
                계약서 업로드하고<br />AI로 검토해보세요
              </p>
            </div>
            <div className="absolute right-6 bottom-6 z-10">
              <div className="w-14 h-14 bg-white rounded-[20px] flex items-center justify-center shadow-sm transition-transform hover:scale-105">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#573AC2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </div>
            </div>
          </Link>
        </section>

        {!email ? (
          <section className="px-6">
            <div className="rounded-[20px] border border-dashed border-gray-300 bg-white p-6 text-center">
              <p className="text-[14px] font-medium text-gray-500">
                로그인하면 여기에 내 계약 목록이 표시돼요.
              </p>
              <Link
                href="/login"
                className="mt-3 inline-block text-[14px] font-bold"
                style={{ color: '#6542F1' }}
              >
                로그인하러 가기
              </Link>
            </div>
          </section>
        ) : (
          <>
            {/* In Progress Contracts */}
            <section className="px-6 mb-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[18px] font-bold text-gray-900 tracking-tight">진행 중 계약</h3>
                <span className="px-3.5 py-1 bg-[#F4F1FF] text-[#6542F1] text-[13px] font-bold rounded-full">
                  {inProgress.length}건
                </span>
              </div>

              {inProgress.length === 0 ? (
                <p className="text-[14px] text-gray-400 font-medium">진행 중인 계약이 없어요.</p>
              ) : (
                <div className="flex flex-col gap-3.5">
                  {inProgress.map((s) => {
                    const label = STATUS_LABEL[s.status] ?? STATUS_LABEL.negotiating;
                    return (
                      <Link
                        key={s.id}
                        href={`/session/${s.id}`}
                        className="bg-white border border-gray-100 rounded-[20px] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex items-center justify-between cursor-pointer hover:border-gray-200 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-[52px] h-[52px] bg-[#EEF2F6] rounded-[16px] flex items-center justify-center text-[#9CA3AF]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7A8B9C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                          </div>
                          <div>
                            <h4 className="text-[17px] font-bold text-gray-900 mb-1">
                              계약 #{s.id.slice(0, 8)}
                            </h4>
                            <span
                              className="inline-block px-2.5 py-1 text-[12px] font-bold rounded-md"
                              style={{ background: label.bg, color: label.color }}
                            >
                              {label.text}
                            </span>
                          </div>
                        </div>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C1C7D0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Completed Contracts */}
            <section className="px-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[18px] font-bold text-gray-900 tracking-tight">완료된 계약</h3>
                <span className="px-3.5 py-1 bg-[#F4F1FF] text-[#6542F1] text-[13px] font-bold rounded-full">
                  {completed.length}건
                </span>
              </div>

              {completed.length === 0 ? (
                <p className="text-[14px] text-gray-400 font-medium">완료된 계약이 없어요.</p>
              ) : (
                <div className="flex flex-col gap-3.5">
                  {completed.map((s) => (
                    <Link
                      key={s.id}
                      href={`/session/${s.id}`}
                      className="bg-white border border-gray-100 rounded-[20px] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex items-center justify-between cursor-pointer hover:border-gray-200 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-[52px] h-[52px] bg-[#E1F0FF] rounded-[16px] flex items-center justify-center">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"></path>
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-[17px] font-bold text-gray-900 mb-1">
                            계약 #{s.id.slice(0, 8)}
                          </h4>
                          <p className="text-[14px] text-gray-500 mb-2 font-medium">
                            {new Date(s.created_at).toLocaleDateString('ko-KR')}
                          </p>
                          <span className="inline-block px-2.5 py-1 bg-[#F4F1FF] text-[#6542F1] text-[12px] font-bold rounded-md">
                            계약 완료
                          </span>
                        </div>
                      </div>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C1C7D0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
