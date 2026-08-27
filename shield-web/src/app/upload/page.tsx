'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function UploadPage() {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [loadingText, setLoadingText] = useState('문서 읽는 중...');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true);
      
      // Simulate fake loading stages for prototype
      setTimeout(() => setLoadingText('조항 나누는 중...'), 1500);
      setTimeout(() => setLoadingText('위험 확인 중...'), 3000);
      setTimeout(() => setLoadingText('빠진 조항 확인 중...'), 4500);
      
      setTimeout(() => {
        router.push('/result');
      }, 6000);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white selection:bg-blue-500 selection:text-white pt-24 px-6 relative">
      
      {isUploading && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center">
           <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-8"></div>
           <h2 className="text-3xl font-bold mb-2">계약서 분석 중</h2>
           <p className="text-blue-400 text-lg animate-pulse">{loadingText}</p>
        </div>
      )}

      <div className="max-w-3xl mx-auto">
        <div className="mb-10 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">계약서 업로드</h1>
          <p className="text-gray-400">
            분석할 계약서 파일(PDF, PNG, JPG)을 올려주세요. 여러 장인 경우 모두 올려주시면 됩니다.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 bg-blue-500/10 text-blue-400 px-4 py-2 rounded-lg text-sm border border-blue-500/20">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            업로드하신 파일은 분석 즉시 폐기되며 안전하게 보호됩니다.
          </div>
        </div>

        {/* Upload Area */}
        <label className="border-2 border-dashed border-white/20 hover:border-blue-500/50 transition-colors bg-white/5 rounded-3xl p-12 flex flex-col text-center cursor-pointer group">
          <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
            <svg className="w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h3 className="text-2xl font-semibold mb-2">클릭하여 파일 선택</h3>
          <p className="text-gray-400 mb-6">또는 이 곳으로 파일을 드래그 앤 드롭 하세요.</p>
          <p className="text-xs text-gray-500">지원 형식: PDF, PNG, JPG (최대 10MB)</p>
          
          <input type="file" className="hidden" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileUpload} />
        </label>

        <div className="mt-12 flex justify-between items-center border-t border-white/10 pt-6">
          <Link href="/" className="text-gray-400 hover:text-white transition-colors">
            이전으로
          </Link>
          <button className="bg-white/10 text-white/50 px-8 py-3 rounded-xl font-semibold cursor-not-allowed">
            다음 단계
          </button>
        </div>

      </div>
    </main>
  );
}
