'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ResultPage() {
  const [activeTone, setActiveTone] = useState<'soft' | 'firm' | 'formal'>('soft');
  const [isDark, setIsDark] = useState(false);
  const [resultData, setResultData] = useState<any>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    
    // Load data from session storage
    const stored = sessionStorage.getItem('analysisResult');
    if (stored) {
      try {
        setResultData(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse result", e);
      }
    }
  }, []);

  const toggleTheme = () => {
    if (document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  };
  
  if (!resultData) {
    return (
      <main className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-50 pt-24 pb-32 px-6 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-500">분석 결과가 없습니다. 계약서를 먼저 업로드해 주세요.</p>
          <Link href="/upload" className="mt-4 inline-block bg-blue-600 text-white px-6 py-2 rounded-lg">업로드 화면으로 가기</Link>
        </div>
      </main>
    );
  }

  const { summary, risks, missing, negotiation } = resultData;
  const missingLoss = missing && missing.length > 0 ? missing[0].estimated_loss : "없음";

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-50 pt-24 pb-32 px-6 transition-colors duration-200 relative">
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full z-40 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold">
              계약방패
            </Link>
            <Link href="/features" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors">기능 소개</Link>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            <button onClick={toggleTheme} className="p-2 px-4 bg-gray-200 dark:bg-gray-800 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">
              {isDark ? '라이트 모드' : '다크 모드'}
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto space-y-8 pt-6">
        
        {/* Top Header */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-200 dark:border-gray-800">
          <Link href="/" className="text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            홈으로
          </Link>
          <div className="flex gap-2">
            <span className="bg-gray-200 dark:bg-gray-800 px-3 py-1 rounded-full text-xs text-gray-700 dark:text-gray-300">계약서 분석 결과</span>
            <span className="bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-full text-xs text-blue-700 dark:text-blue-400">방금 분석됨</span>
          </div>
        </div>

        {/* Number Verification */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-4 transition-colors">
          <div>
            <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-1">계약서에서 이렇게 읽었어요</h3>
            <div className="flex flex-wrap gap-6 mt-2">
              <div>
                <span className="text-gray-500 text-sm block">시급/임금 </span>
                <span className="font-semibold text-lg">{summary?.wage || "확인 불가"}</span>
              </div>
              <div>
                <span className="text-gray-500 text-sm block">근로시간/내용 </span>
                <span className="font-semibold text-lg">{summary?.hours || "확인 불가"}</span>
              </div>
              <div>
                <span className="text-gray-500 text-sm block">기간 </span>
                <span className="font-semibold text-lg">{summary?.period || "확인 불가"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Headline */}
        <div className="text-center py-6">
          <h2 className="text-4xl font-bold mb-2">위험 {risks?.length || 0}건 · 누락 {missing?.length || 0}건</h2>
          {missing && missing.length > 0 && (
            <p className="text-xl text-red-600 dark:text-red-400 font-semibold bg-red-50 dark:bg-red-900/20 inline-block px-6 py-2 rounded-full border border-red-200 dark:border-red-800 transition-colors mt-2">
              예상 누락 손실액: {missingLoss}
            </p>
          )}
        </div>

        {/* Missing Item Alert */}
        {missing && missing.map((item: any, i: number) => (
          <div key={`missing-${i}`} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 transition-colors">
            <div className="flex items-start gap-4">
              <div className="text-3xl">🚨</div>
              <div>
                <h3 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">{item.title}</h3>
                <p className="text-gray-800 dark:text-gray-300 mb-4 leading-relaxed">
                  {item.description}
                </p>
                <div className="text-sm text-gray-600 dark:text-gray-400 bg-red-100 dark:bg-black/30 p-3 rounded-lg inline-block transition-colors">
                  예상 손실액: {item.estimated_loss}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Risk Clauses */}
        {risks && risks.map((item: any, i: number) => (
          <div key={`risk-${i}`} className={`border rounded-2xl p-6 transition-colors ${item.level === 'red' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'}`}>
            <div className="flex items-start gap-4">
              <div className="text-3xl">{item.level === 'red' ? '⚠️' : '⚡'}</div>
              <div>
                <h3 className={`text-xl font-bold mb-2 ${item.level === 'red' ? 'text-red-700 dark:text-red-500' : 'text-yellow-700 dark:text-yellow-500'}`}>{item.title}</h3>
                <p className="text-gray-800 dark:text-gray-300 mb-4 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          </div>
        ))}

      </div>

      {/* Bottom Sheet - AI Negotiator */}
      {negotiation && (
        <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-6 md:p-8 shadow-2xl z-40 transition-colors duration-200">
          <div className="max-w-3xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <span className="text-blue-500">💬</span> AI 협상 코치
              </h3>
            </div>
            
            <div className="flex gap-2 mb-6">
              <button onClick={() => setActiveTone('soft')} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeTone === 'soft' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>😊 부드럽게</button>
              <button onClick={() => setActiveTone('firm')} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeTone === 'firm' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>🙂 단호하게</button>
              <button onClick={() => setActiveTone('formal')} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeTone === 'formal' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>😐 공식적으로</button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 relative transition-colors">
              <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{negotiation[activeTone]}</p>
              
              <button 
                className="absolute top-4 right-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText(negotiation[activeTone]);
                  alert('클립보드에 복사되었습니다!');
                }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                복사
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
