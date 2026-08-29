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
  
  // Mobile Tab State
  const [activeTab, setActiveTab] = useState<'contracts' | 'chat' | 'sign'>('contracts');
  const [selectedClause, setSelectedClause] = useState<any>(null);

  // Contracts sub-step: 점수화면 -> 막대그래프 -> 주요 위험 조항 -> 조항 리스트
  const [contractStep, setContractStep] = useState<'score' | 'graph' | 'clauses' | 'list'>('score');

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
  
  // Popup state
  const [showChangesPopup, setShowChangesPopup] = useState(false);

  // Copy toast state
  const [showCopyToast, setShowCopyToast] = useState(false);

  useEffect(() => {
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

  const messagesLength = messages.length;
  useEffect(() => {
    if ((activeTab as any) === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messagesLength, activeTab]);

  const handleResolveClause = async (clauseId: string, currentResolved: boolean) => {
    const updatedStatus = !currentResolved;
    
    // Calculate new clauses list to see if everything is resolved
    const nextClauses = clauses.map(c => 
      c.id === clauseId 
        ? { ...c, [role === 'tenant' ? 'resolved_by_tenant' : 'resolved_by_landlord']: updatedStatus } 
        : c
    );
    
    // Optimistic update
    setClauses(nextClauses);
    if (selectedClause?.id === clauseId) {
      setSelectedClause((prev: any) => ({
        ...prev,
        [role === 'tenant' ? 'resolved_by_tenant' : 'resolved_by_landlord']: updatedStatus
      }));
    }

    // Check if this action makes unresolvedCriticalCount === 0
    const newUnresolvedCount = nextClauses.filter(c => (c.risk_level === '위험' || c.risk_level === '주의') && (!c.resolved_by_tenant || !c.resolved_by_landlord)).length;
    
    // Auto-open popup if all are resolved (and not already signed)
    const hasSignedStatus = signatures.some(s => s.role === role);
    if (newUnresolvedCount === 0 && !hasSignedStatus) {
       setSelectedClause(null); // Close the detail view
       setShowChangesPopup(true); // Auto-open the popup
    }

    try {
      const res = await fetch(`/api/session/${id}/clause/${clauseId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, resolved: updatedStatus })
      });
      if (!res.ok) throw new Error('조항 동의 상태 변경 실패');
    } catch (err) {
      // Revert on failure
      setClauses(prev => prev.map(c => 
        c.id === clauseId 
          ? { ...c, [role === 'tenant' ? 'resolved_by_tenant' : 'resolved_by_landlord']: currentResolved } 
          : c
      ));
      if (selectedClause?.id === clauseId) {
        setSelectedClause((prev: any) => ({
          ...prev,
          [role === 'tenant' ? 'resolved_by_tenant' : 'resolved_by_landlord']: currentResolved
        }));
      }
      alert('오류가 발생했습니다. 다시 시도해 주세요.');
    }
  };

  // Read receipt mock logic for demo
  useEffect(() => {
    // In a real app, this would call an API to mark unread messages as read
    // when the user views the chat tab.
  }, [messagesLength, activeTab]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
  };

  const getFileExtension = (name?: string) => {
    if (!name) return 'PDF';
    return name.split('.').pop()?.toUpperCase() || 'FILE';
  };

  // 임대인이 협상 반영 수정본 PDF를 채팅에 공유(첨부 카드 메시지)
  const [sendingRevised, setSendingRevised] = useState(false);
  const handleShareRevisedPdf = async () => {
    if (sendingRevised) return;
    setSendingRevised(true);
    try {
      // 1) 협상 채팅을 AI가 반영해 조항 문구(clause_text)를 먼저 갱신
      let updatedCount = 0;
      let appliedReasons: string[] = [];
      try {
        const applyRes = await fetch(`/api/session/${id}/apply-negotiation`, { method: 'POST' });
        if (applyRes.ok) {
          const applyData = await applyRes.json();
          updatedCount = applyData.updated ?? 0;
          appliedReasons = (applyData.applied ?? [])
            .map((a: { reason?: string }) => a.reason)
            .filter((r: string | undefined): r is string => !!r);
        }
      } catch {
        /* 반영 실패해도 현재 조항 상태로 수정본은 공유 */
      }

      // 변경 요약을 채팅에 먼저 남김 (어디가 수정됐는지 안내)
      if (appliedReasons.length > 0) {
        const summary = '수정 반영 내역:\n' + appliedReasons.map((r, i) => `${i + 1}. ${r}`).join('\n');
        await fetch(`/api/session/${id}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender_role: role, text: summary })
        }).catch(() => {});
      }

      // 2) 채팅에 수정본 계약서 첨부 카드 메시지 전송
      const res = await fetch(`/api/session/${id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_role: role, text: '[[REVISED_PDF]] 수정본 계약서를 공유했습니다.' })
      });
      if (!res.ok) throw new Error('전송 실패');

      if (updatedCount > 0) {
        alert(`협상 내용을 반영해 ${updatedCount}개 조항을 수정했어요. 수정본을 공유했습니다.`);
      }
    } catch {
      alert('수정본 공유에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setSendingRevised(false);
    }
  };

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

  const handleFetchCoach = async (clauseTitle: string, clauseDesc: string) => {
    setActiveCoachClause(clauseTitle);
    setActiveTab('chat');
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
      
      // Auto apply mock message for demo if the AI response is empty
      if(data.message) {
         setChatText(data.message);
      }
    } catch (err) {
      console.error(err);
      // Mock for Hackathon demo
      await new Promise(resolve => setTimeout(resolve, 1500));
      setChatText("수리 책임 조항과 관련해서 노후 시설 교체까지 임차인 부담으로 보는 것은 과도해 보입니다. 아래와 같이 수정 제안드립니다. 검토 부탁드립니다.\n\n· 수리 범위를 명확히 규정하고 자연적 마모/노후는 임대인 부담으로 수정 부탁드립니다.");
    } finally {
      setCoachLoading(false);
    }
  };

  const handleApplyCoachMessage = (message: string) => {
    setChatText(message);
    setActiveCoachClause(null);
    setActiveTab('chat');
  };

  // 위험/주의 조항 전체를 하나의 협상 메시지로 묶어 채팅창에 채운다.
  const handleNegotiateAll = () => {
    const targets = [...clauses.filter(c => c.risk_level === '위험'), ...clauses.filter(c => c.risk_level === '주의')];
    if (targets.length === 0) {
      alert('협상할 조항이 없습니다.');
      return;
    }

    const items = targets.map((c, i) => {
      const title = c.category || `조항 ${i + 1}`;
      // AI 초안(message_draft)이 있으면 우선 사용, 없으면 설명 기반 문구 구성
      const body = (c.message_draft && c.message_draft.trim())
        ? c.message_draft.trim()
        : `${c.explanation || '해당 조항이 임차인에게 불리하게 해석될 수 있습니다.'} 관련 내용을 합리적으로 조정해 주시길 요청드립니다.`;
      return `${i + 1}. [${title}]\n${body}`;
    }).join('\n\n');

    const message =
      `안녕하세요. 계약서를 검토하며 아래 조항들에 대해 조정을 요청드리고자 합니다.\n\n` +
      `${items}\n\n` +
      `위 사항들을 함께 검토해 주시면 감사하겠습니다.`;

    setChatText(message);
    setActiveCoachClause(null);
    setActiveTab('chat');
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#000000';
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

  const stopDrawing = () => setIsDrawing(false);
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSubmitSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const buffer = new Uint32Array(canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
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
      window.location.href = `/session/${id}/complete`;
    } catch (err) {
      alert('서명 등록 중 오류가 발생했습니다.');
    } finally {
      setSubmittingSignature(false);
    }
  };

  const showCopiedToast = () => {
    setShowCopyToast(true);
    window.setTimeout(() => setShowCopyToast(false), 2000);
  };

  const copyShareLink = () => {
    const link = `${window.location.origin}/session/${id}?role=${role === 'tenant' ? 'landlord' : 'tenant'}`;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(link).then(showCopiedToast).catch(() => {
        fallbackCopy(link);
        showCopiedToast();
      });
    } else {
      fallbackCopy(link);
      showCopiedToast();
    }
  };

  const fallbackCopy = (text: string) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch {
      // 복사 실패해도 토스트는 표시
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F4F1FF] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-[#6542F1] rounded-full animate-spin mb-4"></div>
      </div>
    );
  }

  const hasSigned = signatures.some(s => s.role === role);
  // 수정본 계약서 PDF가 채팅에 공유되었는지 여부
  const revisedPdfShared = messages.some(m => typeof m.text === 'string' && m.text.startsWith('[[REVISED_PDF]]'));
  // 협상으로 수정된(원문 != 현재문구) 조항 + 동의 처리된 조항 = 최종 특약사항으로 표시
  const revisedClauses = clauses.filter(c => {
    const changed = (c.original_text ?? c.clause_text) !== c.clause_text;
    const resolved = c.resolved_by_tenant && c.resolved_by_landlord;
    return changed || resolved;
  });
  const unresolvedCriticalCount = clauses.filter(c => (c.risk_level === '위험' || c.risk_level === '주의') && (!c.resolved_by_tenant || !c.resolved_by_landlord)).length;

  const riskClauses = clauses.filter(c => c.risk_level === '위험');
  const warningClauses = clauses.filter(c => c.risk_level === '주의');
  const missingClauses = clauses.filter(c => c.category?.includes('누락') || c.clause_text?.includes('없음'));
  // 감점 2배: 위험 -20, 주의 -8, 누락 -10 (비율은 기존과 동일하게 유지하되 2배)
  const score = Math.max(0, 100 - (riskClauses.length * 20) - (warningClauses.length * 8) - (missingClauses.length * 10));

  // 점수 -> 등급 매핑. index: 0=위험 1=주의 2=보통 3=안전 (게이지 4등분 순서와 동일)
  // 감점 2배와 맞물리는 구간: 안전=100(감점0), 보통=90~99(주의/누락 1개 수준), 주의=60~89, 위험=60미만
  const getGrade = (s: number) => {
    if (s < 60) return { label: '위험', index: 0, color: '#FC0303', bg: '#FFFFFF', desc: '계약 전 반드시 조정이 필요해요.' };
    if (s < 90) return { label: '주의', index: 1, color: '#FFA200', bg: '#FFFFFF', desc: '몇 가지 조항을 다시 살펴보세요.' };
    if (s < 100) return { label: '보통', index: 2, color: '#B7F50C', bg: '#FFFFFF', desc: '조금 더 살펴볼 부분이 있어요.' };
    return { label: '안전', index: 3, color: '#1CE644', bg: '#FFFFFF', desc: '전반적으로 안전한 계약서예요.' };
  };
  const grade = getGrade(score);
  // 바늘은 점수가 아니라 "등급 구간의 중앙"을 가리킨다.
  // 게이지가 4등분(각 25%)이므로 각 등급 칸의 가운데 위치(0.125, 0.375, 0.625, 0.875)를 향한다.
  const gradeFraction = (grade.index + 0.5) / 4;
  const totalCheckPoints = riskClauses.length + warningClauses.length + missingClauses.length;
  const firstClause = [...riskClauses, ...warningClauses, ...missingClauses][0];

  // If a clause is selected for viewing details
  if (selectedClause) {
    return (
      <div className="min-h-screen bg-[#F4F1FF] flex justify-center pb-20">
        <main className="w-full max-w-md bg-[#F9FAFC] text-gray-900 flex flex-col relative shadow-sm min-h-screen">
          <div className="flex items-center gap-2 px-5 pt-10 pb-4 border-b border-gray-100">
            <button onClick={() => setSelectedClause(null)} className="p-2 -ml-2">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            </button>
            <h2 className="text-[20px] font-bold text-gray-900 mx-auto pr-8">조회 상세 보기</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5 pb-28">
            {/* Card 1: Risk Detail */}
            <div className={`relative overflow-hidden rounded-[24px] p-6 ${selectedClause.risk_level === '위험' ? 'bg-gray-50 border border-gray-200' : 'bg-gray-50 border border-gray-200'}`}>
              <p className={`text-[13px] font-bold mb-2 flex items-center gap-1.5 ${selectedClause.risk_level === '위험' ? 'text-[#6542F1]' : 'text-[#6542F1]'}`}>
                {selectedClause.risk_level === '위험' ? '위험 조항' : '주의 조항'}
              </p>
              <h3 className="text-[22px] font-extrabold text-gray-900 mb-2 pr-6 leading-tight">{selectedClause.category || '조항 상세'}</h3>
              <p className="text-[14px] text-gray-500 mb-4">{selectedClause.clause_text ? selectedClause.clause_text.substring(0, 50) + (selectedClause.clause_text.length > 50 ? '...' : '') : '내용 없음'}</p>
              <p className="text-[15px] text-gray-700 font-medium leading-relaxed">{selectedClause.explanation}</p>
            </div>

            {/* Card 2: Law */}
            <div className="bg-gray-50 rounded-[24px] p-6 border border-gray-200">
              <p className="text-[#6542F1] text-[14px] font-bold mb-2 flex items-center gap-1.5">관련 법령 근거</p>
              <h4 className="text-[16px] font-extrabold text-gray-900 leading-relaxed">
                {selectedClause.law_basis || '관련 법령 정보가 없습니다.'}
              </h4>
            </div>

            {/* Card 3: Guide */}
            <div className="bg-gray-50 border border-gray-200 rounded-[24px] p-6 mb-4">
              <p className="text-[#6542F1] text-[15px] font-bold mb-4 flex items-center gap-1.5">AI 협상 가이드</p>
              <ul className="space-y-3">
                {selectedClause.keyword_hint && selectedClause.keyword_hint.length > 0 ? (
                  selectedClause.keyword_hint.map((item: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6542F1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      <span className="text-[15px] text-gray-700 font-medium leading-relaxed">
                        <strong className="text-[#6542F1]">[{item}]</strong> 키워드를 중심으로 협상을 진행해보세요.
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="flex items-start gap-2">
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6542F1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                     <span className="text-[15px] text-gray-700 font-medium leading-relaxed">
                       해당 조항의 위험성을 언급하며 수정을 요청하세요.
                     </span>
                  </li>
                )}
              </ul>
            </div>

            <div className="flex gap-2 mt-2">
              <button 
                onClick={() => handleResolveClause(selectedClause.id, role === 'tenant' ? selectedClause.resolved_by_tenant : selectedClause.resolved_by_landlord)} 
                className={`flex-1 py-4 text-[16px] font-bold rounded-[20px] shadow-lg transition-colors ${
                  (role === 'tenant' ? selectedClause.resolved_by_tenant : selectedClause.resolved_by_landlord) 
                    ? 'bg-gray-200 text-gray-700' 
                    : 'bg-gray-900 text-white'
                }`}
              >
                {(role === 'tenant' ? selectedClause.resolved_by_tenant : selectedClause.resolved_by_landlord) ? '동의 취소' : '동의하기'}
              </button>
              <button onClick={() => {
                handleFetchCoach(selectedClause.category, selectedClause.explanation);
                setSelectedClause(null);
              }} className="flex-1 py-4 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[16px] font-bold rounded-[20px] flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-200">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                협상하기
              </button>
            </div>
          </div>

          <nav className="absolute bottom-0 w-full bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center text-[10px] font-bold text-gray-400 pb-safe">
            <button className="flex flex-col items-center gap-1.5 p-2">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
              Home
            </button>
            <button onClick={() => { setSelectedClause(null); setActiveTab('contracts'); }} className="flex flex-col items-center gap-1.5 p-2 transition-colors text-[#6542F1]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              Contracts
            </button>
            <button onClick={() => { setSelectedClause(null); setActiveTab('chat'); }} className="flex flex-col items-center gap-1.5 p-2 transition-colors">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              Chat
            </button>
            <button className="flex flex-col items-center gap-1.5 p-2">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              Settings
            </button>
          </nav>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F1FF] flex justify-center pb-20">
      <main className="w-full max-w-md bg-[#F9FAFC] text-gray-900 flex flex-col relative shadow-sm min-h-screen">
        
        {session?.status === 'analyzing' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#F9FAFC] z-50">
            {/* 강아지 마스코트 (배경 없는 경량 PNG, 통통 튀는 애니메이션) */}
            <img
              src="/mascot.png"
              alt="분석 중 마스코트"
              width={190}
              height={190}
              loading="eager"
              decoding="async"
              className="w-[190px] h-[190px] object-contain mb-6 animate-mascot"
            />
            <h3 className="text-[19px] font-bold text-gray-900 mb-2 tracking-tight">계약서 분석 중</h3>
            <p className="text-[14px] text-gray-500 font-medium text-center leading-relaxed mb-6">
              법령·판례를 기준으로<br />
              위험 조항을 확인하고 있어요.
            </p>
            <span className="inline-block px-4 py-1.5 bg-[#F4F1FF] text-[#6542F1] text-[13px] font-bold rounded-full">
              예상 소요 15~40초
            </span>
          </div>
        ) : session?.status === 'error' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#F9FAFC] z-50 text-center">
            <div className="text-[40px] mb-4">🚨</div>
            <h2 className="text-[18px] font-bold mb-2 text-red-600">계약서 분석 중 오류가 발생했습니다.</h2>
            <p className="text-[14px] text-gray-500 mb-6">AI가 문서를 읽을 수 없거나 서버에 문제가 생겼습니다.</p>
            <Link href="/" className="bg-[#6542F1] text-white font-bold py-3 px-6 rounded-xl">홈으로 돌아가기</Link>
          </div>
        ) : (
          <>
            {/* STEP 1: 종합 위험 점수 화면 */}
            {(activeTab as any) === 'contracts' && contractStep === 'score' && (
              <div className="flex-1 flex flex-col bg-[#F9FAFC] overflow-hidden pb-20">
                <header className="flex items-center justify-between px-5 pt-10 pb-4">
                  <Link href="/" className="text-[24px] font-extrabold tracking-tight" style={{ color: '#6542F1' }}>SIGNAL</Link>
                  <button onClick={copyShareLink} className="p-1 text-gray-800">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                  </button>
                </header>
                <div className="px-5 border-b border-gray-100 mb-4"></div>

                <div className="flex-1 overflow-y-auto px-6 pb-28">
                  <button onClick={() => window.history.back()} aria-label="뒤로 가기" className="p-1 -ml-1 mb-4 text-gray-700 hover:text-gray-900 transition-colors">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                  </button>
                  <h1 className="text-[30px] font-black text-gray-900 tracking-tight mb-2">종합 위험 점수</h1>
                  <p className="text-[15px] text-gray-500 font-medium mb-8">계약서를 꼼꼼하게 분석했어요.</p>

                  {/* Score number */}
                  <div className="flex flex-col items-center mb-6">
                    <div className="flex items-baseline">
                      <span className="text-[72px] font-black leading-none tracking-tighter" style={{ color: grade.color }}>{score}</span>
                      <span className="text-[28px] font-bold text-gray-400 ml-1">/100</span>
                    </div>
                    <span className="mt-4 px-5 py-1.5 text-[15px] font-bold rounded-full border" style={{ backgroundColor: grade.bg, color: grade.color, borderColor: grade.color }}>
                      {grade.label}
                    </span>
                  </div>

                  {/* Gauge */}
                  <div className="relative w-full max-w-[300px] mx-auto mb-2" style={{ aspectRatio: '180 / 102' }}>
                    <svg viewBox="10 10 180 102" className="w-full h-full">
                      <defs>
                        <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#FC0303" />
                          <stop offset="33%" stopColor="#FFA200" />
                          <stop offset="66%" stopColor="#B7F50C" />
                          <stop offset="100%" stopColor="#1CE644" />
                        </linearGradient>
                      </defs>
                      {/* 반원 하나에 그라데이션 적용 (좌: 위험 -> 우: 안전) */}
                      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#gaugeGradient)" strokeWidth="15" strokeLinecap="round" />
                      {/* Needle: 등급 구간의 중앙을 가리킴 (위험=왼쪽 ... 안전=오른쪽) */}
                      {(() => {
                        const theta = (180 - gradeFraction * 180) * Math.PI / 180;
                        const nx = 100 + 62 * Math.cos(theta);
                        const ny = 100 - 62 * Math.sin(theta);
                        return <line x1="100" y1="100" x2={nx} y2={ny} stroke="#4B5563" strokeWidth="4" strokeLinecap="round" />;
                      })()}
                      <circle cx="100" cy="100" r="8" fill="#4B5563" />
                      <circle cx="100" cy="100" r="3.5" fill="#fff" />
                    </svg>
                    <div className="flex justify-between text-[13px] font-bold text-gray-500 px-1 mt-1">
                      <span>위험</span>
                      <span>주의</span>
                      <span>보통</span>
                      <span>안전</span>
                    </div>
                  </div>

                  {/* Summary line */}
                  <div className="mt-8 bg-gray-50 rounded-[18px] px-5 py-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: grade.color }}></span>
                    <p className="text-[15px] text-gray-700 font-medium">
                      <strong className="font-bold text-gray-900">{grade.label}</strong> {grade.desc}
                    </p>
                  </div>
                </div>

                {/* Next button */}
                <div className="absolute bottom-[116px] left-0 w-full px-6 z-20">
                  <button onClick={() => setContractStep('graph')} className="w-full py-4 bg-[#6542F1] hover:bg-[#5233c8] transition-colors text-white text-[17px] font-bold rounded-[20px] shadow-lg shadow-indigo-200 flex items-center justify-center gap-2">
                    다음으로
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                  </button>
                </div>

                <nav className="absolute bottom-0 w-full bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center text-[10px] font-bold text-gray-400 pb-safe z-10">
                  <button className="flex flex-col items-center gap-1.5 p-2">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    Home
                  </button>
                  <button onClick={() => { setActiveTab('contracts'); setContractStep('score'); }} className="flex flex-col items-center gap-1.5 p-2 transition-colors text-[#6542F1]">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Contracts
                  </button>
                  <button onClick={() => setActiveTab('chat')} className="flex flex-col items-center gap-1.5 p-2 transition-colors">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    Chat
                  </button>
                  <button className="flex flex-col items-center gap-1.5 p-2">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    Settings
                  </button>
                </nav>
              </div>
            )}

            {/* STEP 2: 확인이 필요한 지점 (막대그래프) */}
            {(activeTab as any) === 'contracts' && contractStep === 'graph' && (
              <div className="flex-1 flex flex-col bg-[#F9FAFC] overflow-hidden pb-20">
                <header className="flex items-center justify-between px-5 pt-10 pb-4">
                  <Link href="/" className="text-[24px] font-extrabold tracking-tight" style={{ color: '#6542F1' }}>SIGNAL</Link>
                  <button onClick={copyShareLink} className="p-1 text-gray-800">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                  </button>
                </header>
                <div className="px-5 border-b border-gray-100 mb-4"></div>

                <div className="flex-1 overflow-y-auto px-6 pb-28">
                  <button onClick={() => setContractStep('score')} aria-label="뒤로 가기" className="p-1 -ml-1 mb-4 text-gray-700 hover:text-gray-900 transition-colors">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                  </button>
                  <h1 className="text-[30px] font-black text-gray-900 tracking-tight mb-2">확인이 필요한 지점</h1>
                  <p className="text-[15px] text-gray-500 font-medium mb-8">총 {totalCheckPoints}곳을 확인해보세요.</p>

                  {/* Bar chart */}
                  {(() => {
                    const bars = [
                      { label: '위험', count: riskClauses.length, color: '#FC0303' },
                      { label: '주의', count: warningClauses.length, color: '#FFA200' },
                      { label: '누락', count: missingClauses.length, color: '#7FA8D4' },
                    ];
                    const MAX_STEPS = 5; // 최대 5칸
                    return (
                      <div className="flex items-end justify-center gap-5 h-[340px] mb-4">
                        {bars.map((bar) => {
                          // 절대 스케일: 값 그대로 5칸 기준 (0 -> 0%, 1 -> 20%, 5 -> 100%)
                          const capped = Math.min(MAX_STEPS, bar.count);
                          const heightPct = (capped / MAX_STEPS) * 100;
                          return (
                            <div key={bar.label} className="flex flex-col items-center gap-3.5 flex-1 max-w-[96px]">
                              <div className="relative w-full flex-1 flex items-end">
                                <div className="absolute inset-0 rounded-lg bg-gray-100"></div>
                                <div
                                  className="relative w-full rounded-lg flex items-start justify-center pt-5 transition-all duration-700 ease-out"
                                  style={{ height: `${heightPct}%`, backgroundColor: bar.color }}
                                >
                                  {bar.count > 0 && <span className="text-white text-[26px] font-black">{bar.count}</span>}
                                </div>
                              </div>
                              <span className="text-[16px] font-bold text-gray-700">{bar.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* First-to-check card */}
                  {firstClause && (
                    <button
                      onClick={() => { setContractStep('clauses'); setSelectedClause(firstClause); }}
                      className="w-full text-left bg-gray-50 rounded-[18px] px-5 py-4 flex items-center justify-between mt-4"
                    >
                      <div>
                        <p className="text-[13px] font-bold text-gray-500 mb-1">가장 먼저 확인할 항목</p>
                        <p className="text-[16px] font-bold text-gray-900">{firstClause.category || '조항'}</p>
                      </div>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                  )}
                </div>

                {/* Next button */}
                <div className="absolute bottom-[116px] left-0 w-full px-6 z-20">
                  <button onClick={() => setContractStep('clauses')} className="w-full py-4 bg-[#6542F1] hover:bg-[#5233c8] transition-colors text-white text-[17px] font-bold rounded-[20px] shadow-lg shadow-indigo-200 flex items-center justify-center gap-2">
                    주요 조항 보기
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                  </button>
                </div>

                <nav className="absolute bottom-0 w-full bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center text-[10px] font-bold text-gray-400 pb-safe z-10">
                  <button className="flex flex-col items-center gap-1.5 p-2">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    Home
                  </button>
                  <button onClick={() => { setActiveTab('contracts'); setContractStep('score'); }} className="flex flex-col items-center gap-1.5 p-2 transition-colors text-[#6542F1]">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Contracts
                  </button>
                  <button onClick={() => setActiveTab('chat')} className="flex flex-col items-center gap-1.5 p-2 transition-colors">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    Chat
                  </button>
                  <button className="flex flex-col items-center gap-1.5 p-2">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    Settings
                  </button>
                </nav>
              </div>
            )}

            {/* STEP 3: 주요 위험 조항 (참고 디자인 기반) */}
            {(activeTab as any) === 'contracts' && contractStep === 'clauses' && (
              <div className="flex-1 flex flex-col bg-[#F9FAFC] overflow-hidden pb-20">
                <header className="flex items-center justify-between px-5 pt-10 pb-4">
                  <Link href="/" className="text-[24px] font-extrabold tracking-tight" style={{ color: '#6542F1' }}>SIGNAL</Link>
                  <button onClick={copyShareLink} className="p-1 text-gray-800">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                  </button>
                </header>
                <div className="px-5 border-b border-gray-100 mb-4"></div>

                <div className="flex-1 overflow-y-auto px-5 pb-28">
                  <div className="px-1 mb-5">
                    <button onClick={() => setContractStep('graph')} aria-label="뒤로 가기" className="p-1 -ml-1 mb-4 text-gray-700 hover:text-gray-900 transition-colors">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    </button>
                    <h1 className="text-[30px] font-black text-gray-900 tracking-tight mb-2">주요 위험 조항</h1>
                    <p className="text-[15px] text-gray-500 font-medium">계약 전 아래 내용을 꼭 확인해주세요.</p>
                  </div>

                  <ol className="flex flex-col gap-2.5 list-none m-0 p-0">
                    {(() => {
                      const items = [...riskClauses, ...warningClauses, ...missingClauses];
                      const badgeStyle = (clause: any) => {
                        const isMissing = clause.category?.includes('누락') || clause.clause_text?.includes('없음');
                        if (isMissing) return { num: '#60A5FA', badgeBg: '#60A5FA', badgeText: '#FFFFFF', label: '누락' };
                        if (clause.risk_level === '위험') return { num: '#EF4444', badgeBg: '#EF4444', badgeText: '#FFFFFF', label: '위험' };
                        return { num: '#F59E0B', badgeBg: '#F59E0B', badgeText: '#FFFFFF', label: '주의' };
                      };
                      if (items.length === 0) {
                        return <p className="text-gray-500 text-sm text-center py-8">확인이 필요한 조항이 없습니다.</p>;
                      }
                      return items.map((clause, idx) => {
                        const s = badgeStyle(clause);
                        return (
                          <li key={clause.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedClause(clause)}
                              className="w-full text-left flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:border-[#6542F1] hover:shadow-md transition-all"
                            >
                              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                <div className="inline-flex items-center gap-2">
                                  <span className="flex w-6 h-6 items-center justify-center rounded-xl text-white text-[13px] font-bold" style={{ backgroundColor: s.num }}>{idx + 1}</span>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[12px] font-bold" style={{ backgroundColor: s.badgeBg, color: s.badgeText }}>{s.label}</span>
                                </div>
                                <span className="text-[16px] font-bold text-gray-900">{clause.category || '조항'}</span>
                                <span className="text-[13px] text-gray-400 font-medium">{clause.clause_text ? (clause.clause_text.length > 24 ? clause.clause_text.substring(0, 24) + '...' : clause.clause_text) : '내용 없음'}</span>
                              </div>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9C5BF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </button>
                          </li>
                        );
                      });
                    })()}
                  </ol>

                  {/* 확인 안내 카드 */}
                  <button
                    type="button"
                    onClick={() => setContractStep('list')}
                    className="w-full text-left flex items-center gap-3 p-4 mt-2.5 bg-[#F4F1FF] rounded-[20px]"
                  >
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <span className="text-[16px] font-bold text-[#6542F1]">위험 조항을 확인했어요!</span>
                      <span className="text-[13px] text-gray-500 font-medium">상세 내용을 보고 안전하게 조정해보세요.</span>
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6C3EF5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </button>
                </div>

                {/* Next button */}
                <div className="absolute bottom-[116px] left-0 w-full px-6 z-20">
                  <button onClick={() => setContractStep('list')} className="w-full py-4 bg-[#6542F1] hover:bg-[#5233c8] transition-colors text-white text-[17px] font-bold rounded-[20px] shadow-lg shadow-indigo-200 flex items-center justify-center gap-2">
                    상세 분석 결과 보기
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                  </button>
                </div>

                <nav className="absolute bottom-0 w-full bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center text-[10px] font-bold text-gray-400 pb-safe z-10">
                  <button className="flex flex-col items-center gap-1.5 p-2">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    Home
                  </button>
                  <button onClick={() => { setActiveTab('contracts'); setContractStep('score'); }} className="flex flex-col items-center gap-1.5 p-2 transition-colors text-[#6542F1]">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Contracts
                  </button>
                  <button onClick={() => setActiveTab('chat')} className="flex flex-col items-center gap-1.5 p-2 transition-colors">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    Chat
                  </button>
                  <button className="flex flex-col items-center gap-1.5 p-2">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    Settings
                  </button>
                </nav>
              </div>
            )}

            {/* STEP 4: 상세 분석 결과 리스트 (기존 AI 분석 결과 화면) */}
            {(activeTab as any) === 'contracts' && contractStep === 'list' && (
              <div className="flex-1 flex flex-col bg-[#F9FAFC] overflow-hidden pb-20">
                {/* Top Header */}
                <header className="flex items-center justify-between px-5 pt-10 pb-4">
                  <Link href="/" className="text-[24px] font-extrabold tracking-tight" style={{ color: '#6542F1' }}>SIGNAL</Link>
                  <div className="flex items-center gap-4">
                    <button className="text-gray-700 hover:text-gray-900 transition-colors">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                    </button>
                  </div>
                </header>
                <div className="px-5 border-b border-gray-100 mb-4"></div>

                <div className="flex-1 overflow-y-auto">
                  {/* Sub Header */}
                  <div className="flex items-center justify-between px-5 mb-6">
                    <button onClick={() => setContractStep('clauses')} className="p-1">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    </button>
                    <h2 className="text-[20px] font-bold text-gray-900 tracking-tight">상세 분석 결과</h2>
                    <button onClick={copyShareLink} className="p-1 text-gray-800">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                    </button>
                  </div>

                  <div className="px-5">
                    {/* Score Card */}
                    <div className="bg-gray-50 border border-gray-200 rounded-[24px] p-6 mb-5 relative overflow-hidden">
                      <p className="text-gray-900 text-[13px] font-bold mb-3">계약서를 꼼꼼하게 분석했어요!</p>
                      <h3 className="text-[15px] font-bold text-gray-900 mb-1">종합 위험 점수</h3>
                      <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-[42px] font-black text-gray-900 leading-none tracking-tighter">{score}</span>
                        <span className="text-[24px] font-bold text-gray-400">/100</span>
                        <span className="ml-2 px-3 py-1 bg-white text-[13px] font-bold rounded-full border" style={{ color: grade.color, borderColor: grade.color }}>{grade.label}</span>
                      </div>
                      <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, score))}%`, backgroundColor: grade.color }}></div>
                      </div>
                      <div className="absolute top-6 right-2 w-24 h-24 flex items-center justify-center opacity-90">
                        
                        
                      </div>
                    </div>

                    {/* Summary Boxes */}
                    <div className="flex gap-3 mb-8">
                      <div className="flex-1 bg-white border border-gray-200 rounded-[20px] p-4 text-center shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                        <p className="text-[13px] font-bold text-gray-900 mb-1">위험 조항</p>
                        <p className="text-[24px] font-black text-gray-900"><span className="text-[28px]">{riskClauses.length}</span><span className="text-[16px]">개</span></p>
                      </div>
                      <div className="flex-1 bg-white border border-gray-200 rounded-[20px] p-4 text-center shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                        <p className="text-[13px] font-bold text-gray-900 mb-1">주의 조항</p>
                        <p className="text-[24px] font-black text-gray-900"><span className="text-[28px]">{warningClauses.length}</span><span className="text-[16px]">개</span></p>
                      </div>
                      <div className="flex-1 bg-white border border-gray-200 rounded-[20px] p-4 text-center shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                        <p className="text-[13px] font-bold text-gray-900 mb-1">누락 항목</p>
                        <p className="text-[24px] font-black text-gray-900"><span className="text-[28px]">{missingClauses.length || 0}</span><span className="text-[16px]">개</span></p>
                      </div>
                    </div>

                    {/* AI 참고용 안내 문구 */}
                    <p className="text-[13px] font-medium text-gray-900 mb-4 leading-relaxed text-center">
                      본 분석은 AI가 제공하는 참고용 정보이며, 법적 효력을 갖지 않습니다.<br />
                      중요한 결정은 전문가와 상담하세요.
                    </p>

                    {/* Lists */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[18px] font-bold text-gray-900 tracking-tight">주요 위험 조항</h3>
                        <span className="px-3 py-1 bg-[#F3F0FF] text-[#6542F1] text-[12px] font-bold rounded-full">{riskClauses.length + warningClauses.length}건</span>
                      </div>

                      {(riskClauses.length + warningClauses.length) > 0 && (
                        <button
                          onClick={handleNegotiateAll}
                          className="w-full mb-4 py-3.5 bg-[#6542F1] hover:bg-[#5233c8] transition-colors text-white text-[15px] font-bold rounded-[16px] shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                          모든 조항 한 번에 협상하기
                        </button>
                      )}
                      <div className="space-y-3">
                        {[...riskClauses, ...warningClauses].map((clause, idx) => (
                          <div key={clause.id} className="bg-white border border-gray-200 rounded-[20px] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] cursor-pointer hover:border-[#6542F1] hover:shadow-md transition-all" onClick={() => setSelectedClause(clause)}>
                            <div className="flex items-start gap-3">
                              <div className={`w-[26px] h-[26px] rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0 mt-0.5 ${clause.risk_level === '위험' ? 'bg-[#6542F1]' : 'bg-[#6542F1]'}`}>
                                {idx + 1}
                              </div>
                              <div className="flex-1 pr-2">
                                <h4 className="text-[16px] font-bold text-gray-900 mb-1">{clause.category || '조항'}</h4>
                                <p className="text-[13px] text-gray-400 mb-1.5">{clause.clause_text ? (clause.clause_text.length > 20 ? clause.clause_text.substring(0, 20) + '...' : clause.clause_text) : '내용 없음'}</p>
                                <p className="text-[14px] text-gray-600 font-medium leading-relaxed">{clause.explanation}</p>
                              </div>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-1 shrink-0">
                                <polyline points="9 18 15 12 9 6"></polyline>
                              </svg>
                            </div>
                          </div>
                        ))}
                        {(riskClauses.length === 0 && warningClauses.length === 0) && (
                           <p className="text-gray-500 text-sm text-center py-4">위험 조항이 없습니다.</p>
                        )}
                      </div>
                    </div>

                    <div className="mb-8">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[18px] font-bold text-gray-900 tracking-tight">누락되었을 수 있는 항목</h3>
                        <span className="px-3 py-1 bg-[#F3F0FF] text-[#6542F1] text-[12px] font-bold rounded-full">{missingClauses.length}건</span>
                      </div>
                      <div className="space-y-3">
                        {missingClauses.length > 0 ? missingClauses.map((clause, idx) => (
                          <div key={clause.id} className="bg-white border border-gray-200 rounded-[20px] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                            <div className="flex items-start gap-3">
                              <div className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0 mt-0.5 bg-[#6542F1]">
                                {idx + riskClauses.length + warningClauses.length + 1}
                              </div>
                              <div className="flex-1 pr-2">
                                <h4 className="text-[16px] font-bold text-gray-900 mb-1">{clause.category || '누락 항목'}</h4>
                                <p className="text-[14px] text-gray-600 font-medium leading-relaxed">{clause.explanation}</p>
                              </div>
                            </div>
                          </div>
                        )) : (
                          <p className="text-gray-500 text-sm text-center py-4">누락된 항목이 없습니다.</p>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#F6F8FE] border border-gray-200 rounded-[24px] p-5 flex items-center gap-4 mb-8">
                      
                      <div>
                        <h4 className="text-[15px] font-bold text-gray-900 mb-0.5">위험 조항을 확인했어요!</h4>
                        <p className="text-[13px] text-gray-500 font-medium">상세 내용을 보고 안전하게 조정해보세요.</p>
                      </div>
                    </div>
                  </div>
                </div>

                  {/* Floating Banner when all resolved */}
                  {unresolvedCriticalCount === 0 && !hasSigned && (
                    <div className="absolute bottom-[76px] left-0 w-full px-5 z-20">
                       <div className="bg-[#6542F1] text-white rounded-[20px] p-5 shadow-xl flex items-center justify-between">
                          <div>
                             <h4 className="text-[16px] font-bold mb-1">모든 조항 합의 완료!</h4>
                             <p className="text-[13px] font-medium opacity-90">이제 전자서명을 진행해주세요.</p>
                          </div>
                          <button onClick={() => setShowChangesPopup(true)} className="px-4 py-2.5 bg-white text-[#6542F1] text-[14px] font-bold rounded-[12px] shadow-sm">
                             서명하기
                          </button>
                       </div>
                    </div>
                  )}

                  <nav className="absolute bottom-0 w-full bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center text-[10px] font-bold text-gray-400 pb-safe z-10">
                    <button className="flex flex-col items-center gap-1.5 p-2">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                      Home
                    </button>
                    <button onClick={() => setActiveTab('contracts')} className={`flex flex-col items-center gap-1.5 p-2 transition-colors ${(activeTab as any) === 'contracts' ? 'text-[#6542F1]' : ''}`}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                      Contracts
                    </button>
                    <button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center gap-1.5 p-2 transition-colors ${(activeTab as any) === 'chat' ? 'text-[#6542F1]' : ''}`}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                      Chat
                    </button>
                    <button className="flex flex-col items-center gap-1.5 p-2">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                      Settings
                    </button>
                  </nav>
              </div>
            )}

            {(activeTab as any) === 'chat' && (
              <div className="flex-1 flex flex-col overflow-hidden bg-[#F9FAFC]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-10 pb-4 bg-white border-b border-gray-100 z-10">
                  <button onClick={() => setActiveTab('contracts')} className="p-1 -ml-2">
                     <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                  </button>
                  <h2 className="text-[17px] font-extrabold text-gray-900 mx-auto -mr-2">{role === 'tenant' ? '임대인' : '임차인'}</h2>
                  <div className="flex gap-2">
                    <button className="p-2"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg></button>
                    <button className="p-2"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1.5"></circle><circle cx="19" cy="12" r="1.5"></circle><circle cx="5" cy="12" r="1.5"></circle></svg></button>
                  </div>
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 pb-4">
                   {/* Fixed Document Card (from image) */}
                   <div className="bg-white border border-gray-200 rounded-[24px] p-5 mx-1 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-[46px] h-[46px] bg-[#F9FAFC] border border-gray-100 rounded-xl flex items-center justify-center shrink-0">
                           <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        </div>
                        <div>
                           <h4 className="text-[16px] font-extrabold text-gray-900 mb-0.5">
                             {session?.filename || '업로드된 계약서'}
                           </h4>
                           <p className="text-[12px] font-bold text-gray-400">
                             {formatFileSize(session?.file_size)} · {getFileExtension(session?.filename)}
                           </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                         <button className="flex-1 py-3 bg-white border border-gray-200 rounded-[14px] text-[14px] font-bold text-gray-900 shadow-sm">다운로드</button>
                         <button onClick={() => setActiveTab('contracts')} className="flex-1 py-3 bg-[#6542F1] rounded-[14px] text-[14px] font-bold text-white shadow-sm">AI 검토하기</button>
                      </div>
                   </div>

                   {/* Messages */}
                   {messages.map((msg) => {
                     const isMe = msg.sender_role === role;
                     const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }) : '방금 전';
                     const isRevisedPdf = typeof msg.text === 'string' && msg.text.startsWith('[[REVISED_PDF]]');
                     if (isRevisedPdf) {
                       return (
                         <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                           <button
                             onClick={() => window.open(`/api/session/${id}/revised-pdf`, '_blank', 'noopener,noreferrer')}
                             className={`text-left rounded-[20px] max-w-[85%] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border transition-colors ${
                               isMe ? 'bg-[#6542F1] border-[#6542F1] text-white rounded-tr-[6px] hover:bg-[#5233c8]' : 'bg-white border-gray-200 text-gray-900 rounded-tl-[6px] hover:border-[#6542F1]'
                             }`}
                           >
                             <div className="flex items-center gap-3">
                               <div className={`w-[42px] h-[42px] rounded-xl flex items-center justify-center shrink-0 ${isMe ? 'bg-white/20' : 'bg-[#F4F1FF]'}`}>
                                 <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={isMe ? '#fff' : '#6542F1'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                               </div>
                               <div>
                                 <p className="text-[14px] font-bold mb-0.5">수정본 계약서.pdf</p>
                                 <p className={`text-[12px] font-medium ${isMe ? 'text-white/80' : 'text-gray-400'}`}>탭하여 열기 / 다운로드</p>
                               </div>
                             </div>
                           </button>
                           <span className={`text-[10px] font-bold text-gray-400 mt-1.5 px-2 flex items-center gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                             {timeStr}
                           </span>
                         </div>
                       );
                     }
                     return (
                       <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                         <div className={`px-5 py-3.5 rounded-[20px] max-w-[85%] text-[15px] font-medium leading-relaxed shadow-[0_2px_8px_rgba(0,0,0,0.02)] ${
                           isMe ? 'bg-[#6542F1] text-white rounded-tr-[6px]' : 'bg-white border border-gray-200 text-gray-900 rounded-tl-[6px]'
                         }`}>
                           {msg.text}
                         </div>
                         <span className={`text-[10px] font-bold text-gray-400 mt-1.5 px-2 flex items-center gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {timeStr}
                            {isMe && msg.is_read && (
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6542F1" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            )}
                         </span>
                       </div>
                     );
                   })}
                   {coachLoading && (
                     <div className="flex flex-col items-start mb-4">
                       <div className="px-5 py-4 rounded-[20px] bg-white border border-gray-100 text-gray-900 rounded-tl-[6px] shadow-sm flex items-center gap-3">
                         <div className="flex gap-1.5 items-center">
                            <span className="w-2 h-2 bg-[#6542F1] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-2 h-2 bg-[#6542F1] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-2 h-2 bg-[#6542F1] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                         </div>
                         <span className="text-[14px] font-bold text-gray-500">AI가 협상 메시지를 작성하고 있어요...</span>
                       </div>
                     </div>
                   )}
                   <div ref={chatEndRef} />
                </div>

                {/* Input Form area */}
                <div className="bg-white px-4 py-4 pb-20 border-t border-gray-100 relative">
                   {/* 임대인: 수정본 계약서 공유 */}
                   {role === 'landlord' && (
                     <button
                       type="button"
                       onClick={handleShareRevisedPdf}
                       disabled={sendingRevised}
                       className="w-full mb-3 py-3 bg-[#F4F1FF] hover:bg-[#EAE5FC] disabled:opacity-60 transition-colors text-[#6542F1] text-[14px] font-bold rounded-[14px] flex items-center justify-center gap-2"
                     >
                       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                       {sendingRevised ? '공유 중...' : '수정본 계약서 PDF 공유하기'}
                     </button>
                   )}
                   {/* 수정본 공유 후: 양측 모두 동의 후 서명 가능 */}
                   {!hasSigned && revisedPdfShared && (
                     <button
                       type="button"
                       onClick={() => setShowChangesPopup(true)}
                       className="w-full mb-3 py-3.5 bg-[#6542F1] hover:bg-[#5233c8] transition-colors text-white text-[15px] font-bold rounded-[14px] flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                     >
                       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                       동의 후 전자서명하기
                     </button>
                   )}
                   <form onSubmit={handleSendMessage} className="relative">
                      <textarea 
                         value={chatText} 
                         onChange={(e) => setChatText(e.target.value)} 
                         placeholder="" 
                         className="w-full h-[180px] bg-white border-[2.5px] border-[#6542F1] rounded-[24px] p-5 pb-14 text-[15px] font-medium text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none shadow-sm"
                      />
                      <button type="button" className="absolute left-4 bottom-4 w-10 h-10 flex items-center justify-center">
                         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                      </button>
                      <button type="submit" className="absolute right-4 bottom-4 w-10 h-10 bg-[#6542F1] text-white rounded-full flex items-center justify-center shadow-md">
                         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                      </button>
                   </form>
                </div>

                <nav className="absolute bottom-0 w-full bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center text-[10px] font-bold text-gray-400 pb-safe z-10">
                  <button className="flex flex-col items-center gap-1.5 p-2">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    Home
                  </button>
                  <button onClick={() => setActiveTab('contracts')} className={`flex flex-col items-center gap-1.5 p-2 transition-colors ${(activeTab as any) === 'contracts' ? 'text-[#6542F1]' : ''}`}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Contracts
                  </button>
                  <button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center gap-1.5 p-2 transition-colors ${(activeTab as any) === 'chat' ? 'text-[#6542F1]' : ''}`}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    Chat
                  </button>
                  <button className="flex flex-col items-center gap-1.5 p-2">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    Settings
                  </button>
                </nav>
              </div>
            )}

             {(activeTab as any) === 'sign' && (
               <div className="flex-1 flex flex-col overflow-hidden bg-[#F9FAFC]">
                 {/* Header */}
                 <div className="flex items-center justify-between px-5 pt-10 pb-4 bg-white border-b border-gray-100 z-10">
                   <button onClick={() => setActiveTab('contracts')} className="p-1 -ml-2">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                   </button>
                   <h2 className="text-[19px] font-extrabold text-gray-900 mx-auto pr-6">전자서명 진행</h2>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 pb-8">
                    {/* Section 1: Final Contract */}
                    <div>
                       <h3 className="text-[17px] font-bold text-gray-900 mb-3">최종계약서</h3>
                       <div className="bg-white border border-gray-200 rounded-[20px] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                          <div className="flex items-center gap-4 mb-4">
                             <div className="w-[46px] h-[46px] bg-[#F9FAFC] border border-gray-100 rounded-xl flex items-center justify-center shrink-0">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                             </div>
                             <div>
                                <h4 className="text-[16px] font-extrabold text-gray-900 mb-0.5">
                                  {session?.filename || '업로드된 계약서.pdf'}
                                </h4>
                                <p className="text-[13px] font-bold text-gray-400">
                                  {formatFileSize(session?.file_size)} · {getFileExtension(session?.filename)}
                                </p>
                             </div>
                          </div>
                          <div className="border-t border-gray-100 pt-4 text-center">
                             <span className="text-[13px] font-extrabold text-gray-900">1/12페이지</span>
                          </div>
                       </div>
                    </div>

                    {/* Section 2: Participants */}
                    <div>
                       <h3 className="text-[17px] font-bold text-gray-900 mb-3">서명 참여자</h3>
                       <div className="bg-white border border-gray-200 rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.02)] overflow-hidden">
                          <div className="flex items-center justify-between p-4 border-b border-gray-100">
                             <div className="flex items-center gap-3">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                <span className="text-[15px] font-bold text-gray-800">홍길동(임차인)</span>
                             </div>
                             <span className={`px-3 py-1 text-[12px] font-bold rounded-md ${signatures.some(s => s.role === 'tenant') ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FFEDD5] text-[#9A3412]'}`}>
                                {signatures.some(s => s.role === 'tenant') ? '서명완료' : '서명대기'}
                             </span>
                          </div>
                          <div className="flex items-center justify-between p-4">
                             <div className="flex items-center gap-3">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                <span className="text-[15px] font-bold text-gray-800">00공인중개사(임대인 대리)</span>
                             </div>
                             <span className={`px-3 py-1 text-[12px] font-bold rounded-md ${signatures.some(s => s.role === 'landlord') ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FFEDD5] text-[#9A3412]'}`}>
                                {signatures.some(s => s.role === 'landlord') ? '서명완료' : '서명대기'}
                             </span>
                          </div>
                       </div>
                    </div>

                    {/* Section 3: Canvas */}
                    <div>
                       <h3 className="text-[17px] font-bold text-gray-900 mb-3">내 서명</h3>
                       <div className="bg-[#F9FAFC] border border-gray-200 rounded-[20px] p-2 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                          <canvas
                             ref={canvasRef}
                             width={320}
                             height={120}
                             onMouseDown={startDrawing}
                             onMouseMove={draw}
                             onMouseUp={stopDrawing}
                             onMouseLeave={stopDrawing}
                             onTouchStart={startDrawing}
                             onTouchMove={draw}
                             onTouchEnd={stopDrawing}
                             className="w-full bg-white rounded-xl cursor-crosshair border border-gray-100"
                          />
                          <button onClick={clearCanvas} className="w-full text-center text-[13px] font-bold text-gray-400 py-3 mt-1 hover:text-gray-600 transition-colors">
                             서명 변경
                          </button>
                       </div>
                    </div>

                    <div className="pt-4 pb-2">
                      <p className="text-center text-[14px] font-bold text-gray-400 mb-4">서명 완료후 계약서가 자동 저장됩니다.</p>
                      <button onClick={handleSubmitSignature} disabled={submittingSignature} className="w-full py-4 bg-[#6542F1] hover:bg-[#5233c8] transition-colors text-white text-[17px] font-bold rounded-[20px] shadow-lg shadow-indigo-200 flex items-center justify-center">
                         {submittingSignature ? '제출 중...' : '전자 서명 완료하기'}
                      </button>
                    </div>
                 </div>
               </div>
            )}
            
            {/* Copy Toast */}
            {showCopyToast && (
              <div className="fixed left-1/2 bottom-24 -translate-x-1/2 z-[200] pointer-events-none">
                <div className="flex items-center gap-2 bg-gray-900/90 text-white text-[14px] font-bold px-5 py-3 rounded-full shadow-xl">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  클립보드에 복사가 되었습니다.
                </div>
              </div>
            )}

            {/* Changes Popup */}
            {showChangesPopup && (
              <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-5">
                <div className="bg-white rounded-[24px] w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                  <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white z-10">
                    <h3 className="text-[19px] font-extrabold text-gray-900 tracking-tight">최종 특약사항 확인</h3>
                    <button onClick={() => setShowChangesPopup(false)} className="text-gray-400 hover:text-gray-700 p-1 bg-gray-50 rounded-full transition-colors">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  </div>
                  <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
                    <div className="bg-[#F4F1FF] text-[#6542F1] px-4 py-3 rounded-[14px] mb-5 flex items-start gap-3">
                       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                       <p className="text-[13px] font-bold leading-relaxed">
                         아래 조항들이 협상을 통해 특약사항으로 합의되었습니다. 서명 후에는 수정할 수 없으니 꼼꼼히 확인해주세요.
                       </p>
                    </div>
                    
                    <div className="space-y-4">
                       {revisedClauses.map((clause, idx) => {
                          const original = clause.original_text ?? clause.clause_text;
                          const isChanged = original !== clause.clause_text;
                          return (
                            <div key={clause.id} className="bg-white p-5 rounded-[20px] border border-gray-200 shadow-sm relative overflow-hidden">
                               <div className="absolute top-0 left-0 w-1 h-full bg-[#6542F1]"></div>
                               <h4 className="text-[14px] font-bold text-gray-900 mb-3">{clause.category || `조항 ${idx + 1}`}</h4>

                               {isChanged ? (
                                  <div className="space-y-2">
                                     <div className="bg-gray-50 p-3 rounded-[12px] opacity-70 line-through">
                                        <p className="text-[12px] font-bold text-gray-500 mb-1 no-underline">기존 원본 내용</p>
                                        <p className="text-[13px] text-gray-500 leading-relaxed">{original || '내용 없음'}</p>
                                     </div>
                                     <div className="bg-[#F4F1FF] p-3 rounded-[12px]">
                                        <p className="text-[12px] font-bold text-[#6542F1] mb-1 flex items-center gap-1">
                                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                           변경(합의)된 특약
                                        </p>
                                        <p className="text-[13px] text-gray-800 font-medium leading-relaxed">{clause.clause_text || '내용 없음'}</p>
                                     </div>
                                  </div>
                               ) : (
                                  <div className="bg-[#F4F1FF] p-3 rounded-[12px]">
                                     <p className="text-[12px] font-bold text-[#6542F1] mb-1 flex items-center gap-1">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                        합의된 특약
                                     </p>
                                     <p className="text-[13px] text-gray-800 font-medium leading-relaxed">{clause.clause_text || '내용 없음'}</p>
                                  </div>
                               )}
                            </div>
                          );
                       })}
                       {revisedClauses.length === 0 && (
                          <div className="text-center py-8">
                             <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                             </div>
                             <p className="text-gray-500 font-bold text-[14px]">추가된 특약사항이 없습니다.</p>
                          </div>
                       )}
                    </div>
                  </div>
                  <div className="p-5 bg-white border-t border-gray-100 z-10">
                    <button 
                      onClick={() => {
                         setShowChangesPopup(false);
                         setActiveTab('sign');
                      }} 
                      className="w-full py-4 bg-[#6542F1] text-white text-[16px] font-extrabold rounded-[18px] shadow-lg hover:bg-[#5233d4] transition-colors flex justify-center items-center gap-2"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      확인 완료 및 서명하기
                    </button>
                  </div>
                </div>
              </div>
            )}
           </>
         )}
      </main>
    </div>
  );
}
