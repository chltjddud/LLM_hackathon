'use client';

import React from 'react';
import Link from 'next/link';

export default function CompletePage() {
  return (
    <div className="min-h-screen bg-[#F9FAFC] flex justify-center pb-20">
      <main className="w-full max-w-md bg-white text-gray-900 flex flex-col relative shadow-sm min-h-screen">
        <header className="flex items-center justify-center px-5 pt-10 pb-4 border-b border-gray-100">
          <Link href="/" className="text-[24px] font-extrabold tracking-tight" style={{ color: '#6542F1' }}>SIGNAL</Link>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-24 h-24 bg-[#F4F1FF] rounded-full flex items-center justify-center mb-6">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6542F1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <h2 className="text-[24px] font-extrabold text-gray-900 mb-3 tracking-tight">전자서명이 완료되었습니다!</h2>
          <p className="text-[15px] text-gray-500 font-medium leading-relaxed mb-8">
            양측의 서명이 모두 완료되면<br />
            최종 계약서가 PDF로 자동 저장됩니다.
          </p>

          <div className="bg-gray-50 border border-gray-200 rounded-[24px] p-6 w-full mb-8">
             <h3 className="text-[16px] font-bold text-gray-900 mb-2">다음 단계 안내</h3>
             <ul className="text-[14px] text-gray-600 space-y-3 text-left">
                <li className="flex items-start gap-2">
                   <span className="text-[#6542F1] font-bold mt-0.5">1.</span>
                   <span>상대방의 서명을 대기합니다. (양측 모두 완료시 계약 체결)</span>
                </li>
                <li className="flex items-start gap-2">
                   <span className="text-[#6542F1] font-bold mt-0.5">2.</span>
                   <span>체결된 계약서는 마이페이지에서 확인 및 다운로드 가능합니다.</span>
                </li>
             </ul>
          </div>
        </div>

        <div className="p-6 bg-white border-t border-gray-100 pb-safe">
          <Link href="/" className="w-full flex py-4 bg-[#6542F1] hover:bg-[#5233c8] transition-colors text-white text-[17px] font-bold rounded-[20px] shadow-lg shadow-indigo-200 items-center justify-center">
             홈으로 돌아가기
          </Link>
        </div>
      </main>
    </div>
  );
}
