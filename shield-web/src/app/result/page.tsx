'use client';
import React, { useState } from 'react';
import Link from 'next/link';

export default function ResultPage() {
  const [activeTone, setActiveTone] = useState<'soft' | 'firm' | 'formal'>('soft');
  
  const tones = {
    soft: {
      label: '😊 부드럽게',
      text: "사장님, 근로계약서 관련해 말씀드릴 것이 있습니다.\n제 소정근로시간이 주 20시간이라 주휴수당 지급 대상에 해당하는데, 계약서에는 해당 내용이 빠져 있습니다.\n주휴수당은 주 15시간 이상 근무하면 사업장 규모와 관계없이 지급하도록 되어 있는 것으로 알고 있습니다.\n계약서에 주휴수당 항목을 추가해 주시고, 지급 방식을 알려주시면 감사하겠습니다."
    },
    firm: {
      label: '🙂 단호하게',
      text: "사장님, 이번에 작성한 근로계약서를 확인해보니 주휴수당 관련 명시가 누락되어 연락드렸습니다.\n근로기준법상 주 15시간 이상 근무 시 주휴수당이 의무적으로 지급되어야 합니다.\n추후 정산 시 문제가 없도록 계약서에 주휴수당 항목과 시급 산정 방식을 정확히 기재해 주시기 바랍니다."
    },
    formal: {
      label: '😐 공식적으로',
      text: "근로계약서상 주휴수당 지급 조항이 누락된 점 확인 요청드립니다.\n본인은 주 20시간 근로 예정으로 법정 주휴수당 지급 요건을 충족합니다.\n관련 법령에 따라 해당 조항을 추가한 계약서로 재작성해 주실 것을 요청하며, 미조치 시 향후 정산 과정에서 분쟁이 발생할 수 있음을 알려드립니다."
    }
  };

  return (
    <main className="min-h-screen bg-black text-white selection:bg-blue-500 selection:text-white pt-24 pb-32 px-6">
      
      {/* Top Header */}
      <div className="max-w-3xl mx-auto flex items-center justify-between mb-8 pb-6 border-b border-white/10">
        <Link href="/" className="text-gray-400 hover:text-white flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          홈으로
        </Link>
        <div className="flex gap-2">
          <span className="bg-gray-800 px-3 py-1 rounded-full text-xs text-gray-300">근로계약서</span>
          <span className="bg-blue-500/20 px-3 py-1 rounded-full text-xs text-blue-400">오늘 분석됨</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Number Verification */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h3 className="text-sm text-gray-400 mb-1">계약서에서 이렇게 읽었어요</h3>
            <div className="flex gap-6 mt-2">
              <div>
                <span className="text-gray-500 text-sm">시급 </span>
                <span className="font-semibold text-lg">9,500원</span>
              </div>
              <div>
                <span className="text-gray-500 text-sm">근로시간 </span>
                <span className="font-semibold text-lg">주 20시간</span>
              </div>
              <div>
                <span className="text-gray-500 text-sm">기간 </span>
                <span className="font-semibold text-lg">6개월</span>
              </div>
            </div>
          </div>
          <button className="px-4 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20 transition-colors">수정하기</button>
        </div>

        {/* Headline */}
        <div className="text-center py-6">
          <h2 className="text-4xl font-bold mb-2">위험 1건 · 주의 1건</h2>
          <p className="text-xl text-red-400 font-semibold bg-red-500/10 inline-block px-6 py-2 rounded-full border border-red-500/20">
            예상 누락 손실액: 약 99만원
          </p>
        </div>

        {/* Missing Item Alert */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="text-3xl">🚨</div>
            <div>
              <h3 className="text-xl font-bold text-red-400 mb-2">주휴수당 조항 누락</h3>
              <p className="text-gray-300 mb-4 leading-relaxed">
                주 15시간 이상 근무하기 때문에 주휴수당 지급 대상입니다. 
                계약서에 해당 내용이 없어 6개월 기준 약 99만 원을 받지 못할 위험이 있습니다.
              </p>
              <div className="text-sm text-gray-500 bg-black/30 p-3 rounded-lg inline-block">
                근거: 근로기준법 제55조 및 최저임금법
              </div>
            </div>
          </div>
        </div>

        {/* Risk Clauses */}
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="text-3xl">⚠️</div>
            <div>
              <h3 className="text-xl font-bold text-yellow-500 mb-2">지각 시 1만원 차감</h3>
              <p className="text-gray-300 mb-4 leading-relaxed">
                근로기준법상 위약금 또는 손해배상액을 예정하는 계약은 금지되어 있습니다. 
                지각에 대해 징계는 가능하나 일방적인 벌금 차감은 위법 소지가 있습니다.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Sheet - AI Negotiator */}
      <div className="fixed bottom-0 left-0 w-full bg-black border-t border-white/10 p-6 md:p-8 shadow-2xl z-40 transform transition-transform">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold flex items-center gap-2">
              <span className="text-blue-400">💬</span> AI 협상 코치
            </h3>
            <button className="text-sm text-gray-400 hover:text-white" onClick={() => alert('실제 배포에서는 닫을 수 있습니다')}>닫기</button>
          </div>
          
          <div className="flex gap-2 mb-6">
            {(Object.keys(tones) as Array<keyof typeof tones>).map((key) => (
              <button
                key={key}
                onClick={() => setActiveTone(key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeTone === key 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white/10 text-gray-400 hover:bg-white/20'
                }`}
              >
                {tones[key].label}
              </button>
            ))}
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-6 relative">
            <p className="text-gray-200 whitespace-pre-wrap leading-relaxed">{tones[activeTone].text}</p>
            
            <button 
              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              onClick={() => alert('클립보드에 복사되었습니다!')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              복사
            </button>
          </div>

        </div>
      </div>
    </main>
  );
}
