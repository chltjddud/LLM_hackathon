'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function UploadPage() {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
      }
    });
  }, []);

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
  };

  const handleStartAnalysis = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    try {
      const base64 = await convertToBase64(selectedFile);
      const mediaType = selectedFile.type || 'application/pdf';

      // Get user session to retrieve the access token for backend auth
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/session', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          imageBase64: base64,
          mediaType: mediaType,
          filename: selectedFile.name,
          fileSize: selectedFile.size,
        }),
      });
      
      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        const errMsg = errJson?.error || '계약서 분석 및 세션 생성 중 오류가 발생했습니다.';
        throw new Error(errMsg);
      }
      
      const data = await response.json();
      
      sessionStorage.setItem('analysisResult', JSON.stringify(data));
      
      router.push(`/session/${data.session.id}?role=tenant`);
    } catch (error: any) {
      alert(error.message || '분석 중 오류가 발생했습니다. 다시 시도해 주세요.');
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
  };

  const getFileExtension = (name: string) => {
    return name.split('.').pop()?.toUpperCase() || 'FILE';
  };

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFC] flex justify-center">
      <main className="w-full max-w-md bg-[#F9FAFC] text-gray-900 flex flex-col relative pb-10 shadow-sm min-h-screen">
        {/* Navigation */}
        <header className="flex items-center justify-between px-6 pt-10 pb-4">
          <Link href="/" className="text-[26px] font-extrabold tracking-tight" style={{ color: '#6542F1' }}>SIGNAL</Link>
          <div className="flex items-center gap-3">
            {!user && (
              <Link
                href="/login"
                className="text-[13px] font-bold text-[#6542F1] bg-[#F4F1FF] hover:bg-[#EAE5FC] px-3.5 py-1.5 rounded-full transition-colors"
              >
                로그인 / 가입
              </Link>
            )}
            <button className="p-2 -mr-2 text-gray-700 hover:text-gray-900 transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            </button>
          </div>
        </header>

        <div className="px-6 border-b border-gray-200/60 mx-6 mb-8"></div>

        <div className="px-6">
          <div className="mb-8">
            <h1 className="text-[24px] font-bold mb-3 tracking-tight text-gray-900">계약서 업로드</h1>
            <p className="text-[16px] text-gray-500 font-medium leading-relaxed">
              임대차 계약서를 업로드하면<br />
              법령·판례 기준으로 위험 조항을 분석해드려요.
            </p>
          </div>

          {/* Conditional Upload Area */}
          {!selectedFile ? (
            <label
              htmlFor="contract-file"
              data-testid="dropzone"
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              className={`block w-full border-[2px] border-dashed rounded-[24px] p-8 flex flex-col items-center text-center cursor-pointer mb-5 transition-colors ${
                isDragging
                  ? 'border-[#6542F1] bg-[#F4F1FF]'
                  : 'border-[#CBBBF3] bg-[#F6F5FD] hover:border-[#6542F1]'
              }`}
            >
              <div className="w-14 h-14 bg-white shadow-sm rounded-[16px] flex items-center justify-center mb-5">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6542F1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </div>
              <h3 className="text-[20px] font-bold mb-2 text-gray-900 tracking-tight">계약서를 업로드하세요</h3>
              <p className="text-[15px] text-gray-500 font-medium mb-4">여기에 사진을 끌어다 놓거나 클릭해서 파일 선택</p>
              <p className="text-[13px] text-gray-400 font-medium mb-6 tracking-wide">PDF, JPG, PNG · 최대 10MB</p>
              
              <div className="bg-[#6542F1] text-white font-bold text-[16px] py-4 px-8 rounded-full shadow-[0_4px_12px_rgba(101,66,241,0.25)] hover:bg-[#573AC2] transition-colors w-full flex items-center justify-center">
                파일 선택하기
              </div>
              
              <input id="contract-file" type="file" className="hidden" accept=".pdf,image/jpeg,image/png" onChange={handleFileSelect} />
            </label>
          ) : (
            <div className="bg-white border-[1.5px] border-[#F4F1FF] rounded-[24px] px-6 py-7 mb-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className={`flex items-center justify-between ${isUploading ? 'mb-6' : 'mb-8'}`}>
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="w-[52px] h-[52px] bg-[#F4F1FF] rounded-[16px] flex items-center justify-center shrink-0">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6542F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                  </div>
                  <div className="overflow-hidden pr-2">
                    <h3 className="text-[17px] font-bold text-gray-900 truncate">{selectedFile.name}</h3>
                    <p className="text-[13px] text-gray-500 font-medium mt-1">
                      {getFileExtension(selectedFile.name)} · {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>
                {!isUploading && (
                  <button onClick={clearSelectedFile} className="p-2 text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                )}
              </div>
              
              {isUploading ? (
                <>
                  <div className="border-t border-gray-100 mb-8 -mx-1"></div>
                  <div className="flex flex-col items-center justify-center pb-2">
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
                </>
              ) : (
                <>
                  <button onClick={handleStartAnalysis} className="bg-[#6542F1] text-white font-bold text-[16px] py-4 px-8 rounded-2xl shadow-[0_4px_12px_rgba(101,66,241,0.25)] hover:bg-[#573AC2] transition-colors w-full flex items-center justify-center mb-5">
                    AI 분석 시작
                  </button>
                  
                  <div className="text-center">
                    <label htmlFor="change-file" className="text-[14px] text-gray-500 font-bold cursor-pointer hover:text-gray-700 transition-colors">
                      다른 파일 선택하기
                    </label>
                    <input id="change-file" type="file" className="hidden" accept=".pdf,image/jpeg,image/png" onChange={handleFileSelect} />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Secondary Button */}
          {!isUploading && (
            <button className="w-full flex items-center justify-center gap-2.5 border-[1.5px] border-[#D4C8F6] text-[#6542F1] bg-white rounded-full py-4 mb-6 hover:bg-gray-50 transition-colors font-bold text-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
              계약서 촬영하기
            </button>
          )}

          {/* Info Box */}
          {!isUploading && (
            <div className="bg-[#F0F6FF] rounded-[16px] p-5 flex gap-3 items-start border border-[#E0EFFF]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              <p className="text-[14px] text-[#3B82F6] font-medium leading-relaxed">
                계약서 전체가 잘 보이도록<br />
                흔들림 없이 선명하게 촬영해주세요.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
