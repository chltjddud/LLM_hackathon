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
  const [proposals, setProposals] = useState<any[]>([]);
  const [chatText, setChatText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingProposal, setUploadingProposal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Mobile Tab State
  const [activeTab, setActiveTab] = useState<'contracts' | 'chat' | 'sign'>('contracts');
  const [selectedClause, setSelectedClause] = useState<any>(null);

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
        setProposals(data.proposals || []);
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
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messagesLength, activeTab]);

  const handleResolveClause = async (clauseId: string, currentResolved: boolean) => {
    const updatedStatus = !currentResolved;
    // Optimistic update
    setClauses(prev => prev.map(c => 
      c.id === clauseId 
        ? { ...c, [role === 'tenant' ? 'resolved_by_tenant' : 'resolved_by_landlord']: updatedStatus } 
        : c
    ));
    if (selectedClause?.id === clauseId) {
      setSelectedClause((prev: any) => ({
        ...prev,
        [role === 'tenant' ? 'resolved_by_tenant' : 'resolved_by_landlord']: updatedStatus
      }));
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

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleProposalFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert('PDF 파일만 수정안으로 보낼 수 있어요.');
      return;
    }
    setUploadingProposal(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const res = await fetch(`/api/session/${id}/proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, fileBase64, filename: file.name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '수정안 분석 실패');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '수정안 전송에 실패했습니다.');
    } finally {
      setUploadingProposal(false);
    }
  };

  const handleAcceptProposal = async (proposalId: string) => {
    try {
      const res = await fetch(`/api/session/${id}/proposal/${proposalId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error('동의 처리 실패');
    } catch {
      alert('동의 처리 중 오류가 발생했습니다.');
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
    } catch (err) {
      alert('서명 등록 중 오류가 발생했습니다.');
    } finally {
      setSubmittingSignature(false);
    }
  };

  const copyShareLink = () => {
    const link = `${window.location.origin}/session/${id}?role=${role === 'tenant' ? 'landlord' : 'tenant'}`;
    navigator.clipboard.writeText(link).then(() => alert('상대방에게 공유할 협상 링크가 복사되었습니다!'));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F9FAFC] flex flex-col items-center justify-center max-w-md mx-auto">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-[#6542F1] rounded-full animate-spin mb-4"></div>
      </div>
    );
  }

  const hasSigned = signatures.some(s => s.role === role);
  const unresolvedCriticalCount = clauses.filter(c => (c.risk_level === '위험' || c.risk_level === '주의') && (!c.resolved_by_tenant || !c.resolved_by_landlord)).length;

  const riskClauses = clauses.filter(c => c.risk_level === '위험');
  const warningClauses = clauses.filter(c => c.risk_level === '주의');
  const missingClauses = clauses.filter(c => c.category?.includes('누락') || c.clause_text?.includes('없음'));
  const score = Math.max(0, 100 - (riskClauses.length * 10) - (warningClauses.length * 4) - (missingClauses.length * 5));

  // If a clause is selected for viewing details
  if (selectedClause) {
    return (
      <div className="min-h-screen bg-white flex justify-center pb-20">
        <main className="w-full max-w-md bg-white text-gray-900 flex flex-col relative shadow-sm min-h-screen">
          <div className="flex items-center gap-2 px-5 pt-10 pb-4 border-b border-gray-100">
            <button onClick={() => setSelectedClause(null)} className="p-2 -ml-2">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            </button>
            <h2 className="text-[20px] font-bold text-gray-900 mx-auto pr-8">조회 상세 보기</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5 pb-28">
            {/* Card 1: Risk Detail */}
            <div className={`relative overflow-hidden rounded-[24px] p-6 ${selectedClause.risk_level === '위험' ? 'bg-[#FFF5F5] border border-[#FEE2E2]' : 'bg-[#FFF7ED] border border-[#FFEDD5]'}`}>
              <p className={`text-[13px] font-bold mb-2 flex items-center gap-1.5 ${selectedClause.risk_level === '위험' ? 'text-[#EF4444]' : 'text-[#F97316]'}`}>
                {selectedClause.risk_level === '위험' ? '🔥 위험 조항' : '⚠️ 주의 조항'}
              </p>
              <h3 className="text-[22px] font-extrabold text-gray-900 mb-2 pr-6 leading-tight">{selectedClause.category || '조항 상세'}</h3>
              <p className="text-[14px] text-gray-500 mb-4">{selectedClause.clause_text ? selectedClause.clause_text.substring(0, 50) + (selectedClause.clause_text.length > 50 ? '...' : '') : '내용 없음'}</p>
              <p className="text-[15px] text-gray-700 font-medium leading-relaxed">{selectedClause.explanation}</p>
            </div>

            {/* Card 2: Law */}
            <div className="bg-[#F4F6FC] rounded-[24px] p-6 border border-[#E0E7FF]">
              <p className="text-[#3B82F6] text-[14px] font-bold mb-2 flex items-center gap-1.5">⚖️ 관련 법령 근거</p>
              <h4 className="text-[16px] font-extrabold text-[#4F46E5] leading-relaxed">
                {selectedClause.law_basis || '관련 법령 정보가 없습니다.'}
              </h4>
            </div>

            {/* Card 3: Guide */}
            <div className="bg-[#F0FDF4] border border-[#DCFCE7] rounded-[24px] p-6 mb-4">
              <p className="text-[#059669] text-[15px] font-bold mb-4 flex items-center gap-1.5">💡 AI 협상 가이드</p>
              <ul className="space-y-3">
                {selectedClause.keyword_hint && selectedClause.keyword_hint.length > 0 ? (
                  selectedClause.keyword_hint.map((item: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      <span className="text-[15px] text-gray-700 font-medium leading-relaxed">
                        <strong className="text-[#059669]">[{item}]</strong> 키워드를 중심으로 협상을 진행해보세요.
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="flex items-start gap-2">
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
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
    <div className="min-h-screen bg-white flex justify-center pb-20">
      <main className="w-full max-w-md bg-white text-gray-900 flex flex-col relative shadow-sm min-h-screen">
        
        {session?.status === 'analyzing' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white z-50">
            <div className="w-[42px] h-[42px] border-[3px] border-[#F4F1FF] border-t-[#D4C8F6] rounded-full animate-spin mb-6"></div>
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
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white z-50 text-center">
            <div className="text-[40px] mb-4">🚨</div>
            <h2 className="text-[18px] font-bold mb-2 text-red-600">계약서 분석 중 오류가 발생했습니다.</h2>
            <p className="text-[14px] text-gray-500 mb-6">AI가 문서를 읽을 수 없거나 서버에 문제가 생겼습니다.</p>
            <Link href="/" className="bg-[#6542F1] text-white font-bold py-3 px-6 rounded-xl">홈으로 돌아가기</Link>
          </div>
        ) : (
          <>
            {activeTab === 'contracts' && (
              <div className="flex-1 flex flex-col bg-white overflow-hidden pb-20">
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
                    <button onClick={() => window.history.back()} className="p-1">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    </button>
                    <h2 className="text-[20px] font-bold text-gray-900 tracking-tight">AI 분석 결과</h2>
                    <button onClick={copyShareLink} className="p-1 text-gray-800">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                    </button>
                  </div>

                  <div className="px-5">
                    {/* Score Card */}
                    <div className="bg-[#F8F7FF] border border-[#E3DCFA] rounded-[24px] p-6 mb-5 relative overflow-hidden">
                      <p className="text-[#3B82F6] text-[13px] font-bold mb-3">계약서를 꼼꼼하게 분석했어요!</p>
                      <h3 className="text-[15px] font-bold text-gray-900 mb-1">종합 위험 점수</h3>
                      <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-[42px] font-black text-[#4F46E5] leading-none tracking-tighter">{score}</span>
                        <span className="text-[24px] font-bold text-gray-400">/100</span>
                        <span className="ml-2 px-3 py-1 bg-[#D1FAE5] text-[#059669] text-[13px] font-bold rounded-full">보통</span>
                      </div>
                      <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden flex">
                        <div className="h-full bg-[#10B981]" style={{ width: '60%' }}></div>
                        <div className="h-full bg-[#F59E0B]" style={{ width: '25%' }}></div>
                        <div className="h-full bg-gray-200" style={{ width: '15%' }}></div>
                      </div>
                      <div className="absolute top-6 right-2 w-24 h-24 flex items-center justify-center opacity-90">
                        <div className="text-[64px]">🐶</div>
                        <div className="absolute bottom-2 left-0 text-[32px]">🔍</div>
                      </div>
                    </div>

                    {/* Summary Boxes */}
                    <div className="flex gap-3 mb-8">
                      <div className="flex-1 bg-white border border-[#FEE2E2] rounded-[20px] p-4 text-center shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                        <p className="text-[13px] font-bold text-[#EF4444] mb-1">위험 조항</p>
                        <p className="text-[24px] font-black text-[#EF4444]"><span className="text-[28px]">{riskClauses.length}</span><span className="text-[16px]">개</span></p>
                      </div>
                      <div className="flex-1 bg-white border border-[#FFEDD5] rounded-[20px] p-4 text-center shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                        <p className="text-[13px] font-bold text-[#F97316] mb-1">주의 조항</p>
                        <p className="text-[24px] font-black text-[#F97316]"><span className="text-[28px]">{warningClauses.length}</span><span className="text-[16px]">개</span></p>
                      </div>
                      <div className="flex-1 bg-white border border-[#E0E7FF] rounded-[20px] p-4 text-center shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                        <p className="text-[13px] font-bold text-[#3B82F6] mb-1">누락 항목</p>
                        <p className="text-[24px] font-black text-[#3B82F6]"><span className="text-[28px]">{missingClauses.length || 0}</span><span className="text-[16px]">개</span></p>
                      </div>
                    </div>

                    {/* Lists */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[18px] font-bold text-gray-900 tracking-tight">주요 위험 조항</h3>
                        <span className="px-3 py-1 bg-[#F3F0FF] text-[#6542F1] text-[12px] font-bold rounded-full">{riskClauses.length + warningClauses.length}건</span>
                      </div>
                      <div className="space-y-3">
                        {[...riskClauses, ...warningClauses].map((clause, idx) => (
                          <div key={clause.id} className="bg-white border border-gray-200 rounded-[20px] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] cursor-pointer hover:border-[#6542F1] hover:shadow-md transition-all" onClick={() => setSelectedClause(clause)}>
                            <div className="flex items-start gap-3">
                              <div className={`w-[26px] h-[26px] rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0 mt-0.5 ${clause.risk_level === '위험' ? 'bg-[#EF4444]' : 'bg-[#F97316]'}`}>
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
                              <div className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0 mt-0.5 bg-[#3B82F6]">
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

                    <div className="bg-[#F6F8FE] border border-[#E0E7FF] rounded-[24px] p-5 flex items-center gap-4 mb-8">
                      <div className="text-[40px]">🐶</div>
                      <div>
                        <h4 className="text-[15px] font-bold text-[#4F46E5] mb-0.5">위험 조항을 확인했어요!</h4>
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
                             <h4 className="text-[16px] font-bold mb-1">🎉 모든 조항 합의 완료!</h4>
                             <p className="text-[13px] font-medium opacity-90">이제 전자서명을 진행해주세요.</p>
                          </div>
                          <button onClick={() => setActiveTab('sign')} className="px-4 py-2.5 bg-white text-[#6542F1] text-[14px] font-bold rounded-[12px] shadow-sm">
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
                    <button onClick={() => setActiveTab('contracts')} className={`flex flex-col items-center gap-1.5 p-2 transition-colors ${activeTab === 'contracts' ? 'text-[#6542F1]' : ''}`}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                      Contracts
                    </button>
                    <button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center gap-1.5 p-2 transition-colors ${activeTab === 'chat' ? 'text-[#6542F1]' : ''}`}>
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

            {activeTab === 'chat' && (
              <div className="flex-1 flex flex-col overflow-hidden bg-white">
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
                     const proposal = msg.proposal_id ? proposals.find((p) => p.id === msg.proposal_id) : null;

                     if (proposal) {
                       const iAccepted = role === 'tenant' ? proposal.accepted_by_tenant : proposal.accepted_by_landlord;
                       const otherAccepted = role === 'tenant' ? proposal.accepted_by_landlord : proposal.accepted_by_tenant;
                       return (
                         <div key={msg.id} className="flex flex-col items-stretch">
                           <div className="bg-white border-2 border-[#6542F1] rounded-[20px] p-5 mx-1 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                             <div className="flex items-center gap-3 mb-3">
                               <div className="w-[40px] h-[40px] bg-[#F4F1FF] rounded-xl flex items-center justify-center shrink-0">
                                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6542F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                               </div>
                               <div>
                                 <h4 className="text-[15px] font-extrabold text-gray-900">{proposal.filename || '수정안.pdf'}</h4>
                                 <p className="text-[12px] font-bold text-[#6542F1]">{proposal.changes.length}개 조항 수정 제안</p>
                               </div>
                             </div>

                             <div className="space-y-2 mb-3">
                               {proposal.changes.map((c: any, i: number) => (
                                 <div key={i} className="bg-[#F9FAFC] rounded-[12px] p-3">
                                   <p className="text-[12px] text-gray-400 line-through mb-1">{c.old_text}</p>
                                   <p className="text-[13px] text-gray-900 font-semibold">{c.new_text}</p>
                                 </div>
                               ))}
                             </div>

                             {proposal.status === 'accepted' ? (
                               <div className="text-center py-2 text-[13px] font-bold text-[#059669]">✓ 양쪽 합의 완료 · 반영됨</div>
                             ) : iAccepted ? (
                               <div className="text-center py-2 text-[13px] font-bold text-gray-500">
                                 {otherAccepted ? '상대방 응답 반영 중...' : '동의함 · 상대방 동의 대기 중'}
                               </div>
                             ) : (
                               <button onClick={() => handleAcceptProposal(proposal.id)} className="w-full py-3 bg-[#6542F1] text-white text-[14px] font-bold rounded-[14px]">
                                 이 수정안에 동의하기
                               </button>
                             )}
                           </div>
                           <span className={`text-[10px] font-bold text-gray-400 mt-1.5 px-2 ${isMe ? 'text-right' : 'text-left'}`}>{timeStr}</span>
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
                   {uploadingProposal && (
                     <div className="flex flex-col items-start mb-4">
                       <div className="px-5 py-4 rounded-[20px] bg-white border border-gray-100 text-gray-900 rounded-tl-[6px] shadow-sm flex items-center gap-3">
                         <div className="flex gap-1.5 items-center">
                            <span className="w-2 h-2 bg-[#6542F1] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-2 h-2 bg-[#6542F1] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-2 h-2 bg-[#6542F1] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                         </div>
                         <span className="text-[14px] font-bold text-gray-500">수정안 PDF를 분석하고 있어요...</span>
                       </div>
                     </div>
                   )}
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
                   <form onSubmit={handleSendMessage} className="relative">
                      <textarea 
                         value={chatText} 
                         onChange={(e) => setChatText(e.target.value)} 
                         placeholder="" 
                         className="w-full h-[180px] bg-white border-[2.5px] border-[#6542F1] rounded-[24px] p-5 pb-14 text-[15px] font-medium text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none shadow-sm"
                      />
                      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingProposal} title="수정된 계약서 PDF 보내기" className="absolute left-4 bottom-4 w-10 h-10 flex items-center justify-center">
                         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                      </button>
                      <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleProposalFileSelect} />
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
                  <button onClick={() => setActiveTab('contracts')} className={`flex flex-col items-center gap-1.5 p-2 transition-colors ${activeTab === 'contracts' ? 'text-[#6542F1]' : ''}`}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Contracts
                  </button>
                  <button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center gap-1.5 p-2 transition-colors ${activeTab === 'chat' ? 'text-[#6542F1]' : ''}`}>
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

             {activeTab === 'sign' && (
               <div className="flex-1 flex flex-col overflow-hidden bg-white">
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
           </>
         )}
      </main>
    </div>
  );
}
