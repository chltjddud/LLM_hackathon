'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';

const CoachSection = ({ title, description }: { title: string, description: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tone, setTone] = useState<'soft' | 'firm' | 'formal'>('soft');
  const [loading, setLoading] = useState(false);
  const [coachData, setCoachData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCoachData = async (selectedTone: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:8000/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, tone: selectedTone })
      });
      if (!res.ok) throw new Error('협상 코치 정보를 불러오는 데 실패했습니다.');
      const data = await res.json();
      setCoachData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    if (!isOpen) {
      setIsOpen(true);
      if (!coachData) fetchCoachData(tone);
    } else {
      setIsOpen(false);
    }
  };

  const handleToneChange = (newTone: 'soft' | 'firm' | 'formal') => {
    setTone(newTone);
    fetchCoachData(newTone);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('복사되었습니다!');
  };

  return (
    <div className="mt-4">
      <button 
        onClick={handleOpen}
        className="text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
      >
        <span>💡 이 조항에 대해 어떻게 말할지 AI 코치 받기</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="mt-4 border border-blue-100 dark:border-blue-900/50 rounded-xl p-4 bg-white dark:bg-gray-800">
          <div className="flex gap-2 mb-4">
            {(['soft', 'firm', 'formal'] as const).map(t => (
              <button
                key={t}
                onClick={() => handleToneChange(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${tone === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'}`}
              >
                {t === 'soft' ? '😊 부드럽게' : t === 'firm' ? '🙂 정중하게' : '😐 공식적으로'}
              </button>
            ))}
          </div>
          
          {loading ? (
            <div className="animate-pulse flex space-x-4">
              <div className="flex-1 space-y-4 py-1">
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded"></div>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded col-span-2"></div>
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded col-span-1"></div>
                  </div>
                  <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded"></div>
                </div>
              </div>
            </div>
          ) : error ? (
            <p className="text-red-500 text-sm">{error}</p>
          ) : coachData ? (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg relative group">
                <button 
                  onClick={() => copyToClipboard(coachData.message)}
                  className="absolute top-2 right-2 p-1.5 bg-white dark:bg-gray-700 shadow-sm rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="복사하기"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap text-sm leading-relaxed">{coachData.message}</p>
              </div>
              
              {coachData.rebuttals && coachData.rebuttals.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">상대방의 예상 반응과 대처법</h4>
                  <div className="space-y-2">
                    {coachData.rebuttals.map((r: any, idx: number) => (
                      <div key={idx} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 text-sm">
                        <div className="text-red-600 dark:text-red-400 font-medium mb-1 flex items-start gap-2">
                          <span className="text-xs bg-red-100 dark:bg-red-900/30 px-1.5 rounded min-w-[32px] text-center">예상</span>
                          <span>{r.if_they_say}</span>
                        </div>
                        <div className="text-blue-600 dark:text-blue-400 font-medium flex items-start gap-2">
                          <span className="text-xs bg-blue-100 dark:bg-blue-900/30 px-1.5 rounded min-w-[32px] text-center">답변</span>
                          <span>{r.reply}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

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

  const { summary, risks, missing } = resultData;
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
            <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-1">계약서 요약 정보</h3>
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
          <h2 className="text-4xl font-bold mb-2">위험 조항 {risks?.length || 0}건 · 누락 조항 {missing?.length || 0}건</h2>
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
              <div className="text-red-700 dark:text-red-400">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">{item.title}</h3>
                <div className="text-gray-800 dark:text-gray-300 mb-4 leading-relaxed bg-white/50 dark:bg-black/20 p-4 rounded-lg">
                  <span className="font-semibold block mb-1">누락 사유 및 문제점:</span>
                  {item.description}
                </div>
                <div className="text-sm font-medium text-red-800 dark:text-red-300 bg-red-100 dark:bg-red-900/50 px-4 py-2 rounded-lg inline-block transition-colors">
                  예상 피해/손실액: {item.estimated_loss}
                </div>
                <CoachSection title={item.title} description={item.description} />
              </div>
            </div>
          </div>
        ))}

        {/* Risk Clauses */}
        {risks && risks.map((item: any, i: number) => (
          <div key={`risk-${i}`} className={`border rounded-2xl p-6 transition-colors ${item.level === 'red' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'}`}>
            <div className="flex items-start gap-4">
              <div className={item.level === 'red' ? 'text-orange-700 dark:text-orange-500' : 'text-yellow-700 dark:text-yellow-500'}>
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className={`text-xl font-bold mb-2 ${item.level === 'red' ? 'text-orange-800 dark:text-orange-400' : 'text-yellow-800 dark:text-yellow-400'}`}>{item.title}</h3>
                <div className="text-gray-800 dark:text-gray-300 leading-relaxed bg-white/50 dark:bg-black/20 p-4 rounded-lg">
                  <span className="font-semibold block mb-1">위험 사유 및 문제점:</span>
                  {item.description}
                </div>
                <CoachSection title={item.title} description={item.description} />
              </div>
            </div>
          </div>
        ))}

      </div>
    </main>
  );
}
