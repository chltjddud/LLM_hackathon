'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';

export default function SessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const role = (searchParams?.get('role') || 'tenant') as 'tenant' | 'landlord';

  // State
  const [session, setSession] = useState<any>(null);
  const [clauses, setClauses] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [signatures, setSignatures] = useState<any[]>([]);
  const [chatText, setChatText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDark, setIsDark] = useState(false);

  // AI Coach state
  const [activeCoachClause, setActiveCoachClause] = useState<string | null>(null);
  const [coachTone, setCoachTone] = useState<'soft' | 'firm' | 'formal'>('soft');
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachData, setCoachData] = useState<any>(null);

  // E-Signature state
  const [isDrawing, setIsDrawing] = useState(false);
  const [submittingSignature, setSubmittingSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Poll database every 2 seconds
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/session/${id}`);
        if (!res.ok) throw new Error('세션 조회를 실패했습니다.');
        const data = await res.json();
        setSession(data.session);
        setClauses(data.clauses || []);
        setMessages(data.messages || []);
        setSignatures(data.signatures || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [id]);

  // Scroll to chat end when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleTheme = () => {
    if (document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  };

  // Clause Agreement / Resolution
  const handleResolveClause = async (clauseId: string, currentResolved: boolean) => {
    try {
      const res = await fetch(`/api/session/${id}/clause/${clauseId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, resolved: !currentResolved })
      });
      if (!res.ok) throw new Error('조항 동의 상태 변경 실패');
    } catch (err) {
      alert('오류가 발생했습니다. 다시 시도해 주세요.');
    }
  };

  // Send Chat Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;

    try {
      const res = await fetch(`/api/session/${id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_role: role, text: chatText })
      });
      if (!res.ok) throw new Error('메시지 전송 실패');
      setChatText('');
    } catch (err) {
      alert('메시지 전송에 실패했습니다.');
    }
  };

  // Query AI Negotiation Coach
  const handleFetchCoach = async (clauseTitle: string, clauseDesc: string) => {
    setActiveCoachClause(clauseTitle);
    setCoachLoading(true);
    setCoachData(null);
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: clauseTitle, description: clauseDesc, tone: coachTone })
      });
      if (!res.ok) throw new Error('코칭 생성 실패');
      const data = await res.json();
      setCoachData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setCoachLoading(false);
    }
  };

  const handleApplyCoachMessage = (message: string) => {
    setChatText(message);
    setActiveCoachClause(null);
  };

  // E-Signature Drawing Logic
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = isDark ? '#ffffff' : '#000000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
      e.preventDefault();
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Submit Signature
  const handleSubmitSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check if canvas is empty
    const buffer = new Uint32Array(
      canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    if (!buffer.some(color => color !== 0)) {
      alert('서명 패드에 서명을 먼저 그려주세요.');
      return;
    }

    setSubmittingSignature(true);
    const signatureImage = canvas.toDataURL('image/png');

    try {
      const res = await fetch(`/api/session/${id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, signature_image: signatureImage })
      });
      if (!res.ok) throw new Error('서명 제출 실패');
      clearCanvas();
    } catch (err) {
      alert('서명 등록 중 오류가 발생했습니다.');
    } finally {
      setSubmittingSignature(false);
    }
  };

  const copyShareLink = () => {
    const origin = window.location.origin;
    const otherRole = role === 'tenant' ? 'landlord' : 'tenant';
    const link = `${origin}/session/${id}?role=${otherRole}`;
    navigator.clipboard.writeText(link);
    alert('상대방에게 공유할 협상 링크가 복사되었습니다!');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">실시간 협상 세션을 로드 중입니다...</p>
      </div>
    );
  }

  const hasSigned = signatures.some(s => s.role === role);
  const otherPartySigned = signatures.some(s => s.role !== role);
  const mySignature = signatures.find(s => s.role === role);
  const otherSignature = signatures.find(s => s.role !== role);

  // Check if all warnings and risks are resolved
  const unresolvedCriticalCount = clauses.filter(
    c => (c.risk_level === '위험' || c.risk_level === '주의') && (!c.resolved_by_tenant || !c.resolved_by_landlord)
  ).length;

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-50 pt-20 transition-colors duration-200 flex flex-col">
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full z-40 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold">
              계약방패
            </Link>
            <span className="text-xs px-2.5 py-1 bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold rounded-full">
              {role === 'tenant' ? '임차인(세입자)' : '임대인(집주인)'} 모드
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={copyShareLink} className="text-sm px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors flex items-center gap-1.5 font-medium shadow-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 10.742l4.739-2.37a2 2 0 11.954 1.906l-4.74 2.37a2 2 0 11-.954-1.906z" />
              </svg>
              상대방 초대 링크 복사
            </button>
            <button onClick={toggleTheme} className="p-2 bg-gray-200 dark:bg-gray-800 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors text-sm px-4">
              {isDark ? '라이트 모드' : '다크 모드'}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Flow Section */}
      {session?.status === 'analyzing' ? (
        <div className="max-w-3xl mx-auto py-24 px-6 flex-1 w-full flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin mb-8"></div>
          <h2 className="text-3xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">AI가 계약서를 꼼꼼히 분석하고 있습니다...</h2>
          <p className="text-gray-500 dark:text-gray-400 text-lg">조항의 유불리와 독소조항을 찾는 중입니다.<br/>잠시만 기다려주시면 완료되는 즉시 화면이 전환됩니다.</p>
        </div>
      ) : session?.status === 'error' ? (
        <div className="max-w-3xl mx-auto py-24 px-6 flex-1 w-full flex flex-col items-center justify-center text-center">
          <div className="text-6xl mb-6">🚨</div>
          <h2 className="text-2xl font-bold mb-4 text-red-600">계약서 분석 중 오류가 발생했습니다.</h2>
          <p className="text-gray-500 dark:text-gray-400">AI가 문서를 읽을 수 없거나 서버에 문제가 생겼습니다.<br/>홈으로 돌아가서 다시 시도해주세요.</p>
          <Link href="/" className="mt-8 bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-3 rounded-full shadow-sm transition-colors">홈으로 돌아가기</Link>
        </div>
      ) : session?.status === 'completed' ? (
        // Completion View
        <div className="max-w-3xl mx-auto py-12 px-6 flex-1 w-full flex flex-col items-center justify-center">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl p-10 w-full shadow-lg text-center space-y-8 relative overflow-hidden transition-colors">
            
            {/* Stamp decoration */}
            <div className="absolute -top-12 -right-12 w-40 h-40 border-4 border-emerald-500/20 rounded-full flex items-center justify-center rotate-12">
              <div className="border border-emerald-500/20 w-36 h-36 rounded-full flex items-center justify-center text-emerald-500/20 font-bold text-xl">합의 완료</div>
            </div>

            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-950/30 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>

            <div>
              <h1 className="text-3xl font-bold mb-2">실시간 계약 협상 합의 완료</h1>
              <p className="text-gray-500 dark:text-gray-400">양측이 모든 분쟁 조항에 합의하고 최종 전자서명을 마쳤습니다.</p>
            </div>

            <div className="border-y border-gray-100 dark:border-gray-700 py-6 grid grid-cols-2 gap-8 text-left">
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase">임차인 (세입자) 서명</h4>
                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 h-32 flex items-center justify-center">
                  {mySignature ? (
                    <img src={mySignature.signature_image} alt="임차인 서명" className="max-h-full max-w-full dark:invert" />
                  ) : (
                    <span className="text-gray-400 text-sm">서명 완료</span>
                  )}
                </div>
                <span className="text-xs text-gray-500 block">서명일시: {new Date(mySignature?.signed_at || "").toLocaleString()}</span>
              </div>
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase">임대인 (집주인) 서명</h4>
                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 h-32 flex items-center justify-center">
                  {otherSignature ? (
                    <img src={otherSignature.signature_image} alt="임대인 서명" className="max-h-full max-w-full dark:invert" />
                  ) : (
                    <span className="text-gray-400 text-sm">서명 완료</span>
                  )}
                </div>
                <span className="text-xs text-gray-500 block">서명일시: {new Date(otherSignature?.signed_at || "").toLocaleString()}</span>
              </div>
            </div>

            <div className="pt-4">
              <Link href="/" className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-3 rounded-full shadow-sm transition-colors">
                홈으로 돌아가기
              </Link>
            </div>
          </div>
        </div>
      ) : (
        // Negotiation and Signing View
        <div className="max-w-7xl mx-auto px-6 py-6 flex-1 w-full grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-hidden min-h-[calc(100vh-80px)]">
          
          {/* Left Side: Clauses List */}
          <div className="flex flex-col space-y-6 overflow-y-auto max-h-[calc(100vh-100px)] pr-2">
            <div>
              <h2 className="text-2xl font-bold mb-2">계약서 합의 조항 리스트</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                임차인과 임대인이 합의해야 하는 조항들입니다. 각 조항에 대해 양측이 모두 동의해 주세요.
              </p>
            </div>

            <div className="space-y-4">
              {clauses.map((item) => {
                const isRisk = item.risk_level === '위험';
                const isWarning = item.risk_level === '주의';
                const myAgreement = role === 'tenant' ? item.resolved_by_tenant : item.resolved_by_landlord;

                let cardBgClass = 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';
                if (item.resolved_by_tenant && item.resolved_by_landlord) {
                  cardBgClass = 'bg-emerald-50/20 dark:bg-emerald-950/5 border-emerald-200 dark:border-emerald-900/50 shadow-sm';
                } else if (isRisk) {
                  cardBgClass = 'bg-red-50/20 dark:bg-red-950/5 border-red-200 dark:border-red-900/50';
                } else if (isWarning) {
                  cardBgClass = 'bg-yellow-50/20 dark:bg-yellow-950/5 border-yellow-200 dark:border-yellow-900/50';
                }

                return (
                  <div key={item.id} className={`border rounded-3xl p-6 transition-all duration-300 ${cardBgClass}`}>
                    <div className="flex items-start gap-4">
                      <div className="mt-1 flex-shrink-0">
                        {item.resolved_by_tenant && item.resolved_by_landlord ? (
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 font-bold">✓</span>
                        ) : isRisk ? (
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">🚨</span>
                        ) : isWarning ? (
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-yellow-100 text-yellow-600 dark:bg-yellow-950/50 dark:text-yellow-400">⚠️</span>
                        ) : (
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-100 text-green-600 dark:bg-green-950/50 dark:text-green-400">✅</span>
                        )}
                      </div>

                      <div className="flex-1 space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <h4 className="text-lg font-bold">{item.category || '기본 조항'}</h4>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            item.resolved_by_tenant && item.resolved_by_landlord
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : isRisk
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400'
                              : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          }`}>
                            {item.resolved_by_tenant && item.resolved_by_landlord ? '합의 완료' : item.risk_level}
                          </span>
                        </div>

                        <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-2xl">
                          <p className="text-sm font-medium italic">"{item.clause_text}"</p>
                        </div>

                        {item.explanation && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                            {item.explanation}
                          </p>
                        )}

                        {/* Agreement States */}
                        <div className="flex gap-4 border-t border-gray-100 dark:border-gray-700 pt-4 flex-wrap">
                          <span className={`text-xs font-semibold flex items-center gap-1.5 ${item.resolved_by_tenant ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                            <span className={`w-2.5 h-2.5 rounded-full ${item.resolved_by_tenant ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                            세입자 합의: {item.resolved_by_tenant ? '동의함' : '대기중'}
                          </span>
                          <span className={`text-xs font-semibold flex items-center gap-1.5 ${item.resolved_by_landlord ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                            <span className={`w-2.5 h-2.5 rounded-full ${item.resolved_by_landlord ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                            임대인 합의: {item.resolved_by_landlord ? '동의함' : '대기중'}
                          </span>
                        </div>

                        {/* Action Agreement Button */}
                        <div className="flex justify-between items-center gap-4">
                          <button
                            onClick={() => handleResolveClause(item.id, myAgreement)}
                            className={`text-sm font-semibold px-5 py-2 rounded-xl transition-all duration-200 shadow-sm ${
                              myAgreement
                                ? 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            {myAgreement ? '✓ 동의 취소' : '동의하기'}
                          </button>

                          {(isRisk || isWarning) && (
                            <button
                              onClick={() => handleFetchCoach(item.category || '위험 조항', item.explanation || item.clause_text)}
                              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              💡 AI 협상코칭 제안받기
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Side: Chat & E-Signature Canvas */}
          <div className="flex flex-col max-h-[calc(100vh-100px)] border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-sm">
            
            {/* Signature Draw Area (Shows only when all clauses resolved) */}
            {unresolvedCriticalCount === 0 ? (
              <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-b border-gray-200 dark:border-gray-800 p-6 flex flex-col items-center">
                <div className="text-center mb-4">
                  <h3 className="text-lg font-bold text-blue-700 dark:text-blue-400">🚨 최종 전자서명 진행 가능</h3>
                  <p className="text-xs text-gray-500 mt-1">모든 조항에 동의했습니다. 아래 패드에 서명한 뒤 완료해 주세요.</p>
                </div>

                {hasSigned ? (
                  <div className="text-center p-4 border border-blue-200 dark:border-blue-900 rounded-2xl bg-white dark:bg-gray-900 w-full max-w-sm">
                    <span className="text-xs text-emerald-500 font-bold block mb-2">✓ 내 서명 등록 완료 (상대방 대기 중)</span>
                    <div className="h-20 flex items-center justify-center">
                      <img src={mySignature?.signature_image} alt="내 서명" className="max-h-full max-w-full dark:invert" />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center w-full max-w-sm">
                    <canvas
                      ref={canvasRef}
                      width={380}
                      height={150}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="border-2 border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-2xl cursor-crosshair touch-none w-full"
                    />
                    <div className="flex gap-2 w-full mt-3 justify-end">
                      <button onClick={clearCanvas} className="text-xs font-semibold px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 rounded-lg">
                        지우기
                      </button>
                      <button
                        onClick={handleSubmitSignature}
                        disabled={submittingSignature}
                        className="text-xs font-semibold px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                      >
                        {submittingSignature ? '제출 중...' : '서명 등록 완료'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 text-center">
                <span className="text-xs font-bold text-gray-500">
                  ⚠️ 서명 조건: 아직 합의되지 않은 조항이 {unresolvedCriticalCount}개 존재합니다.
                </span>
              </div>
            )}

            {/* AI Coach Suggestion Drawer (Overlays when active) */}
            {activeCoachClause && (
              <div className="bg-blue-50 dark:bg-blue-950/40 p-4 border-b border-blue-200 dark:border-blue-900 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-extrabold text-blue-700 dark:text-blue-400">💡 AI 협상 코칭: {activeCoachClause}</h4>
                  <button onClick={() => setActiveCoachClause(null)} className="text-xs text-gray-400 hover:text-black">닫기</button>
                </div>

                <div className="flex gap-1.5 mb-3">
                  {(['soft', 'firm', 'formal'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setCoachTone(t)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        coachTone === t ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 border border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      {t === 'soft' ? '부드럽게' : t === 'firm' ? '정중하게' : '공식적으로'}
                    </button>
                  ))}
                </div>

                {coachLoading ? (
                  <div className="text-xs text-gray-500 animate-pulse py-2">협상 대안을 생각하고 있습니다...</div>
                ) : coachData ? (
                  <div className="space-y-3 bg-white dark:bg-gray-900 p-3 rounded-2xl border border-blue-100 dark:border-blue-900 text-xs">
                    <p className="font-semibold">{coachData.message}</p>
                    <button
                      onClick={() => handleApplyCoachMessage(coachData.message)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 rounded-lg text-[10px]"
                    >
                      이 메시지 채팅창에 입력하기
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleFetchCoach(activeCoachClause, clauses.find(c => c.category === activeCoachClause)?.clause_text || "")}
                    className="w-full py-1.5 bg-blue-600 text-white font-bold rounded-lg text-xs"
                  >
                    코칭 가이드 생성하기
                  </button>
                )}
              </div>
            )}

            {/* Chat Messages Log */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[250px] bg-gray-50/50 dark:bg-gray-900/10">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center text-gray-400 text-xs">
                  대화 기록이 없습니다. 조항 수정을 위해 상대방에게 메시지를 건네보세요!
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender_role === role;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <span className="text-[10px] text-gray-400 mb-1">
                        {msg.sender_role === 'tenant' ? '임차인' : '임대인'}
                      </span>
                      <div className={`p-3 px-4 rounded-2xl max-w-[80%] text-sm leading-relaxed ${
                        isMe
                          ? 'bg-blue-600 text-white rounded-tr-none'
                          : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-tl-none'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input form */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 flex gap-2">
              <input
                type="text"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="메시지를 입력해 주세요..."
                className="flex-1 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-4 py-2 rounded-2xl text-sm focus:outline-none focus:border-blue-500"
              />
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-2xl text-sm transition-colors">
                전송
              </button>
            </form>

          </div>
        </div>
      )}
    </main>
  );
}
