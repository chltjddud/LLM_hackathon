'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface AnalyzedClause {
  clause_text: string;
  category_id: string | null;
  simulation?: string;
  message_draft?: string;
  risk_level: string; // "안전" | "주의" | "위험"
  category: string | null;
  law_basis: string | null;
  explanation: string | null;
}

const CoachSection = ({ title, description }: { title: string; description: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tone, setTone] = useState<'soft' | 'firm' | 'formal'>('soft');
  const [loading, setLoading] = useState(false);
  const [coachData, setCoachData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCoachData = async (selectedTone: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, tone: selectedTone }),
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
    <div className="mt-6 border-t border-gray-100 dark:border-gray-800 pt-4">
      <button
        onClick={handleOpen}
        className="text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 px-4 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-2"
      >
        <span>💡 AI 협상 코치 받기 (어투 조절)</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="mt-4 border border-blue-100 dark:border-blue-900/50 rounded-2xl p-5 bg-blue-50/20 dark:bg-blue-950/10 transition-all duration-300">
          <div className="flex gap-2 mb-4">
            {([
              { id: 'soft', label: '😊 부드럽게' },
              { id: 'firm', label: '🙂 정중하게' },
              { id: 'formal', label: '😐 공식적으로' },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => handleToneChange(t.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                  tone === t.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="animate-pulse space-y-3 py-2">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
            </div>
          ) : error ? (
            <p className="text-red-500 text-sm font-medium">{error}</p>
          ) : coachData ? (
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-900/40 p-4 rounded-xl relative group shadow-sm">
                <button
                  onClick={() => copyToClipboard(coachData.message)}
                  className="absolute top-3 right-3 p-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-300 transition-colors"
                  title="복사하기"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </button>
                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap text-sm leading-relaxed pr-8 font-medium">
                  {coachData.message}
                </p>
              </div>

              {coachData.rebuttals && coachData.rebuttals.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    상대방의 예상 반발과 대처 가이드
                  </h4>
                  <div className="space-y-2.5">
                    {coachData.rebuttals.map((r: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800/80 rounded-xl p-3 text-sm shadow-sm"
                      >
                        <div className="text-red-600 dark:text-red-400 font-semibold mb-1.5 flex items-start gap-2">
                          <span className="text-[10px] bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-md font-bold mt-0.5">
                            예상 반론
                          </span>
                          <span className="leading-snug">{r.if_they_say}</span>
                        </div>
                        <div className="text-blue-600 dark:text-blue-400 font-semibold flex items-start gap-2">
                          <span className="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-md font-bold mt-0.5">
                            추천 답변
                          </span>
                          <span className="leading-snug">{r.reply}</span>
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
  const [isDark, setIsDark] = useState(false);
  const [clauses, setClauses] = useState<AnalyzedClause[]>([]);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));

    // Load data from session storage
    const stored = sessionStorage.getItem('analysisResult');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.clauses) {
          setClauses(parsed.clauses);
        }
      } catch (e) {
        console.error('Failed to parse result', e);
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

  if (clauses.length === 0) {
    return (
      <main className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-50 pt-24 pb-32 px-6 flex items-center justify-center">
        <div className="text-center max-w-md bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-lg">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-4">분석 결과가 없습니다.</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">계약서를 먼저 업로드하여 분석을 진행해 주세요.</p>
          <Link href="/upload" className="inline-block w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors">
            업로드 화면으로 가기
          </Link>
        </div>
      </main>
    );
  }

  const risks = clauses.filter((c) => c.risk_level === '위험');
  const warnings = clauses.filter((c) => c.risk_level === '주의');
  const safes = clauses.filter((c) => c.risk_level === '안전');

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-50 pt-24 pb-32 px-6 transition-colors duration-200 relative">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full z-40 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold">
              계약방패
            </Link>
            <Link
              href="/features"
              className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors"
            >
              기능 소개
            </Link>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            <button
              onClick={toggleTheme}
              className="p-2 px-4 bg-gray-200 dark:bg-gray-800 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              {isDark ? '라이트 모드' : '다크 모드'}
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto space-y-8 pt-6">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200 dark:border-gray-800">
          <Link
            href="/"
            className="text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white flex items-center gap-2 font-medium"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            홈으로
          </Link>
          <div className="flex gap-2">
            <span className="bg-gray-200 dark:bg-gray-800 px-3 py-1 rounded-full text-xs font-semibold text-gray-700 dark:text-gray-300">
              계약서 분석 완료
            </span>
            <span className="bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-full text-xs font-semibold text-blue-700 dark:text-blue-400">
              실시간 분석됨
            </span>
          </div>
        </div>

        {/* Dashboard Stat Summary */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl p-6 shadow-sm transition-all duration-200">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4">전체 진단 요약</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-2xl border border-red-100 dark:border-red-900/30">
              <span className="text-xs text-red-600 dark:text-red-400 font-bold block mb-1">위험 조항</span>
              <span className="text-3xl font-extrabold text-red-600 dark:text-red-400">{risks.length}</span>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-2xl border border-yellow-100 dark:border-yellow-900/30">
              <span className="text-xs text-yellow-600 dark:text-yellow-400 font-bold block mb-1">주의 조항</span>
              <span className="text-3xl font-extrabold text-yellow-600 dark:text-yellow-400">{warnings.length}</span>
            </div>
            <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-2xl border border-green-100 dark:border-green-900/30">
              <span className="text-xs text-green-600 dark:text-green-400 font-bold block mb-1">안전 조항</span>
              <span className="text-3xl font-extrabold text-green-600 dark:text-green-400">{safes.length}</span>
            </div>
          </div>
        </div>

        {/* Headline */}
        <div className="text-center py-4">
          <h2 className="text-3xl font-bold tracking-tight mb-2">위험/주의 조항 총 {risks.length + warnings.length}건이 발견되었습니다.</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            각 조항을 클릭하여 법적 근거 및 AI 협상 가이드를 확인하세요.
          </p>
        </div>

        {/* List of Clauses */}
        <div className="space-y-6">
          {clauses.map((item, i) => {
            const isRisk = item.risk_level === '위험';
            const isWarning = item.risk_level === '주의';
            
            let cardBgClass = 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';
            let badgeBgClass = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
            
            if (isRisk) {
              cardBgClass = 'bg-red-50/20 dark:bg-red-950/5 border-red-200 dark:border-red-900/50 shadow-sm shadow-red-500/5';
              badgeBgClass = 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400';
            } else if (isWarning) {
              cardBgClass = 'bg-yellow-50/20 dark:bg-yellow-950/5 border-yellow-200 dark:border-yellow-900/50 shadow-sm shadow-yellow-500/5';
              badgeBgClass = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400';
            }

            return (
              <div key={i} className={`border rounded-3xl p-6 transition-all duration-300 ${cardBgClass}`}>
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex-shrink-0">
                    {isRisk ? (
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                        🚨
                      </span>
                    ) : isWarning ? (
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-yellow-100 text-yellow-600 dark:bg-yellow-950/50 dark:text-yellow-400">
                        ⚠️
                      </span>
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-100 text-green-600 dark:bg-green-950/50 dark:text-green-400">
                        ✅
                      </span>
                    )}
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4 className="text-lg font-bold tracking-tight">
                        {item.category || (isRisk || isWarning ? '미분류 위험 조항' : '일반 조항')}
                      </h4>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${badgeBgClass}`}>
                        {item.risk_level}
                      </span>
                    </div>

                    {/* Original Clause Text */}
                    <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-2xl">
                      <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">계약서상 원문</span>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 italic leading-relaxed">
                        "{item.clause_text}"
                      </p>
                    </div>

                    {/* Explanation */}
                    {item.explanation && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase block">법률 조언</span>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                          {item.explanation}
                        </p>
                      </div>
                    )}

                    {/* Law Basis */}
                    {item.law_basis && (
                      <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                        </svg>
                        <span>관련 법근거: {item.law_basis}</span>
                      </div>
                    )}

                    {/* Simulation */}
                    {item.simulation && (
                      <div className="bg-orange-50/50 dark:bg-orange-950/10 border border-orange-100 dark:border-orange-900/30 p-4 rounded-2xl">
                        <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase block mb-1">
                          ⚠️ 이 조항이 그대로 계약될 시 예상 시나리오
                        </span>
                        <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed font-semibold">
                          {item.simulation}
                        </p>
                      </div>
                    )}

                    {/* AI Coach Negotiation Section */}
                    {(isRisk || isWarning) && (
                      <CoachSection
                        title={item.category || '계약서 조항'}
                        description={item.explanation || item.clause_text}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
