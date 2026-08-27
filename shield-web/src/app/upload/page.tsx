'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function UploadPage() {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [loadingText, setLoadingText] = useState('문서 읽는 중...');
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true);
      const file = e.target.files[0];
      
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        setLoadingText('파일 업로드 중...');
        const response = await fetch('/api/analyze_contract', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          const errJson = await response.json().catch(() => null);
          const errMsg = errJson?.error || errJson?.detail || '계약서 분석 서버에서 오류가 발생했습니다.';
          throw new Error(errMsg);
        }
        
        setLoadingText('조항 분석 및 결과 생성 중...');
        const data = await response.json();
        
        // Save result to session storage
        sessionStorage.setItem('analysisResult', JSON.stringify(data));
        
        router.push('/result');
      } catch (error: any) {
        alert(error.message || '분석 중 오류가 발생했습니다. 다시 시도해 주세요.');
        setIsUploading(false);
      }
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-50 pt-24 px-6 relative transition-colors duration-200">
      
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

      {isUploading && (
        <div className="fixed inset-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm flex flex-col items-center justify-center">
           <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin mb-8"></div>
           <h2 className="text-3xl font-bold mb-2">계약서 분석 중</h2>
           <p className="text-blue-600 dark:text-blue-400 text-lg animate-pulse">{loadingText}</p>
        </div>
      )}

      <div className="max-w-3xl mx-auto pt-10">
        <div className="mb-10 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">계약서 업로드</h1>
          <p className="text-gray-600 dark:text-gray-400">
            분석할 계약서 파일(PDF, PNG, JPG)을 올려주세요. 여러 장인 경우 모두 올려주시면 됩니다.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-4 py-2 rounded-lg text-sm border border-blue-200 dark:border-blue-800">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            업로드하신 파일은 분석 즉시 폐기되며 안전하게 보호됩니다.
          </div>
        </div>

        {/* Upload Area */}
        <label className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 transition-colors bg-white dark:bg-gray-800 rounded-3xl p-12 flex flex-col text-center cursor-pointer group">
          <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
            <svg className="w-10 h-10 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h3 className="text-2xl font-semibold mb-2">클릭하여 파일 선택</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">또는 이 곳으로 파일을 드래그 앤 드롭 하세요.</p>
          <p className="text-xs text-gray-500">지원 형식: PDF, PNG, JPG (최대 10MB)</p>
          
          <input type="file" className="hidden" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileUpload} />
        </label>

        <div className="mt-12 flex justify-between items-center border-t border-gray-200 dark:border-gray-800 pt-6">
          <Link href="/" className="text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors">
            이전으로
          </Link>
        </div>

      </div>
    </main>
  );
}
