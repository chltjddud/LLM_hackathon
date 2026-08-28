'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Session = {
  id: string;
  status: string;
  filename: string | null;
  file_size: number | null;
  tenant_user_id: string | null;
  landlord_user_id: string | null;
  created_at: string;
};

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMySessions = async (token: string) => {
    try {
      const res = await fetch('/api/my-sessions', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        await fetchMySessions(session.access_token);
        setLoading(false);
      } else {
        setUser(null);
        setSessions([]);
        setLoading(false);
        router.push('/login');
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setUser(session.user);
        await fetchMySessions(session.access_token);
        setLoading(false);
      } else {
        setUser(null);
        setSessions([]);
        setLoading(false);
        router.push('/login');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const getStatusTextAndBadge = (status: string) => {
    switch (status) {
      case 'analyzing':
        return { text: '분석 중', style: 'bg-amber-50 text-amber-600 border border-amber-200' };
      case 'negotiating':
        return { text: '협의 중', style: 'bg-[#F4F1FF] text-[#6542F1] border border-[#E3DCFA]' };
      case 'ready_to_sign':
        return { text: '서명 대기', style: 'bg-blue-50 text-blue-600 border border-blue-200' };
      case 'completed':
        return { text: '계약 완료', style: 'bg-green-50 text-green-600 border border-green-200' };
      case 'error':
        return { text: '분석 오류', style: 'bg-red-50 text-red-600 border border-red-200' };
      default:
        return { text: '대기 중', style: 'bg-gray-50 text-gray-500 border border-gray-200' };
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
  };

  const getFileExtension = (name?: string | null) => {
    if (!name) return 'PDF';
    return name.split('.').pop()?.toUpperCase() || 'FILE';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFC] flex flex-col items-center justify-center max-w-md mx-auto">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-[#6542F1] rounded-full animate-spin mb-4"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to /login
  }

  const inProgressSessions = sessions.filter(s => s.status !== 'completed');
  const completedSessions = sessions.filter(s => s.status === 'completed');

  return (
    <div className="min-h-screen bg-[#F9FAFC] flex justify-center">
      <main className="w-full max-w-md bg-[#F9FAFC] text-gray-900 flex flex-col relative pb-10 shadow-sm min-h-screen">
        
        {/* Header */}
        <header className="flex items-center justify-between px-6 pt-10 pb-4">
          <Link href="/" className="text-[26px] font-extrabold tracking-tight" style={{ color: '#6542F1' }}>
            SIGNAL
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              className="text-[13px] font-bold text-gray-500 hover:text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-full transition-colors shadow-sm"
            >
              로그아웃
            </button>
            <button className="p-2 text-gray-700 hover:text-gray-900 transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            </button>
          </div>
        </header>

        <div className="px-6 border-b border-gray-200/60 mx-6 mb-8"></div>

        {/* Greeting */}
        <section className="px-6 mb-8">
          <h2 className="text-[24px] font-bold leading-snug mb-2 text-gray-900 tracking-tight">
            안녕하세요, {user.user_metadata?.user_name || user.user_metadata?.full_name || user.email.split('@')[0]}님!
          </h2>
          <p className="text-[16px] text-gray-500 font-medium">
            내 계약서를 안전하게 관리하세요.
          </p>
        </section>

        {/* Primary Action Card */}
        <section className="px-6 mb-10">
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

        {/* In Progress Contracts */}
        <section className="px-6 mb-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[18px] font-bold text-gray-900 tracking-tight">진행 중 계약</h3>
            <span className="px-3.5 py-1 bg-[#F4F1FF] text-[#6542F1] text-[13px] font-bold rounded-full">
              {inProgressSessions.length}건
            </span>
          </div>
          
          <div className="flex flex-col gap-3.5">
            {inProgressSessions.length > 0 ? (
              inProgressSessions.map((session) => {
                const badge = getStatusTextAndBadge(session.status);
                const userRole = session.landlord_user_id === user.id ? 'landlord' : 'tenant';
                return (
                  <div
                    key={session.id}
                    onClick={() => router.push(`/session/${session.id}?role=${userRole}`)}
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
                        <h4 className="text-[16px] font-bold text-gray-900 mb-1 line-clamp-1">
                          {session.filename || '계약서 이미지'}
                        </h4>
                        <p className="text-[13px] text-gray-500 mb-2 font-medium">
                          {getFileExtension(session.filename)} · {formatFileSize(session.file_size)}
                        </p>
                        <span className={`inline-block px-2.5 py-0.5 text-[12px] font-bold rounded-md ${badge.style}`}>
                          {badge.text}
                        </span>
                        {session.landlord_user_id === user.id && (
                          <span className="ml-1.5 inline-block px-2.5 py-0.5 bg-gray-100 text-gray-600 text-[12px] font-bold rounded-md border border-gray-200">
                            임대인 참여
                          </span>
                        )}
                      </div>
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C1C7D0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                );
              })
            ) : (
              <div className="bg-white border border-dashed border-gray-200 rounded-[20px] p-8 text-center text-gray-400 font-medium text-[14px]">
                진행 중인 계약 계약서가 없습니다.
              </div>
            )}
          </div>
        </section>

        {/* Completed Contracts */}
        <section className="px-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[18px] font-bold text-gray-900 tracking-tight">완료된 계약</h3>
            <span className="px-3.5 py-1 bg-[#F4F1FF] text-[#6542F1] text-[13px] font-bold rounded-full">
              {completedSessions.length}건
            </span>
          </div>
          
          <div className="flex flex-col gap-3.5">
            {completedSessions.length > 0 ? (
              completedSessions.map((session) => {
                const badge = getStatusTextAndBadge(session.status);
                const userRole = session.landlord_user_id === user.id ? 'landlord' : 'tenant';
                return (
                  <div
                    key={session.id}
                    onClick={() => router.push(`/session/${session.id}?role=${userRole}`)}
                    className="bg-white border border-gray-100 rounded-[20px] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex items-center justify-between cursor-pointer hover:border-gray-200 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-[52px] h-[52px] bg-[#E1F0FF] rounded-[16px] flex items-center justify-center text-[#0284C7]">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 21h18"></path>
                          <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"></path>
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-[16px] font-bold text-gray-900 mb-1 line-clamp-1">
                          {session.filename || '완료된 계약서'}
                        </h4>
                        <p className="text-[13px] text-gray-500 mb-2 font-medium">
                          {new Date(session.created_at).toLocaleDateString('ko-KR')}
                        </p>
                        <span className={`inline-block px-2.5 py-0.5 text-[12px] font-bold rounded-md ${badge.style}`}>
                          {badge.text}
                        </span>
                      </div>
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C1C7D0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                );
              })
            ) : (
              <div className="bg-white border border-dashed border-gray-200 rounded-[20px] p-8 text-center text-gray-400 font-medium text-[14px]">
                완료된 계약 목록이 없습니다.
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
