'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

export default function CompletePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [bothSigned, setBothSigned] = useState(false);

  useEffect(() => {
    if (!id) return;
    let stop = false;
    const check = async () => {
      try {
        const res = await fetch(`/api/session/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        const roles = new Set((data.signatures || []).map((s: { role: string }) => s.role));
        if (!stop) setBothSigned(roles.has('tenant') && roles.has('landlord'));
      } catch {
        /* 무시하고 다음 폴링 */
      }
    };
    check();
    const interval = setInterval(check, 2000);
    return () => {
      stop = true;
      clearInterval(interval);
    };
  }, [id]);

  const handleDownload = () => {
    if (!bothSigned) return;
    // 새 탭에서 PDF를 브라우저 뷰어로 연다. (HTTP 환경의 "안전하지 않은 다운로드" 경고 회피)
    // 사용자는 열린 뷰어에서 저장/인쇄할 수 있다.
    window.open(`/api/session/${id}/final-pdf`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-[#F4F1FF] flex justify-center pb-20">
      <main className="w-full max-w-md bg-[#F9FAFC] text-gray-900 flex flex-col relative shadow-sm min-h-screen">
        <header className="flex items-center justify-start px-5 pt-10 pb-4">
          <Link href="/" className="text-[24px] font-extrabold tracking-tight" style={{ color: '#6542F1' }}>SIGNAL</Link>
        </header>
        <div className="px-5 border-b border-gray-100 mb-4"></div>
        <div className="px-5 mb-2">
          <button onClick={() => router.back()} aria-label="뒤로 가기" className="p-1 -ml-1 text-gray-700 hover:text-gray-900 transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-24 h-24 bg-[#F4F1FF] rounded-full flex items-center justify-center mb-6">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6542F1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <h2 className="text-[24px] font-extrabold text-gray-900 mb-3 tracking-tight">전자서명이 완료되었습니다!</h2>
          <p className="text-[15px] text-gray-500 font-medium leading-relaxed mb-8">
            {bothSigned
              ? '양측 서명이 모두 완료되었어요.\n최종 계약서를 PDF로 받을 수 있습니다.'
                .split('\n')
                .map((t, i) => <React.Fragment key={i}>{t}<br /></React.Fragment>)
              : ['양측의 서명이 모두 완료되면', '최종 계약서를 PDF로 받을 수 있습니다.'].map((t, i) => (
                  <React.Fragment key={i}>{t}<br /></React.Fragment>
                ))}
          </p>

          <div className="bg-gray-50 border border-gray-200 rounded-[24px] p-6 w-full mb-8">
            <h3 className="text-[16px] font-bold text-gray-900 mb-3">서명 현황</h3>
            <div className="flex items-center justify-between text-[14px] mb-2">
              <span className="text-gray-600">최종 계약서 상태</span>
              <span className={`px-3 py-1 rounded-full text-[12px] font-bold ${bothSigned ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FEF3C7] text-[#92400E]'}`}>
                {bothSigned ? '체결 완료' : '상대방 서명 대기중'}
              </span>
            </div>
            <p className="text-[13px] text-gray-500 text-left leading-relaxed mt-2">
              {bothSigned
                ? '아래 버튼을 눌러 서명이 포함된 최종 계약서를 내려받으세요.'
                : '양측 서명이 모두 끝나면 이 화면에서 바로 다운로드할 수 있어요.'}
            </p>
          </div>
        </div>

        <div className="p-6 bg-white border-t border-gray-100 pb-safe space-y-3">
          <button
            onClick={handleDownload}
            disabled={!bothSigned}
            className={`w-full flex py-4 text-[17px] font-bold rounded-[20px] items-center justify-center gap-2 transition-colors ${
              bothSigned
                ? 'bg-[#6542F1] hover:bg-[#5233c8] text-white shadow-lg shadow-indigo-200'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            최종 계약서 PDF 열기 / 저장
          </button>
          <Link href="/" className="w-full flex py-3.5 bg-white border border-gray-200 hover:bg-gray-50 transition-colors text-gray-700 text-[15px] font-bold rounded-[20px] items-center justify-center">
            홈으로 돌아가기
          </Link>
        </div>
      </main>
    </div>
  );
}
