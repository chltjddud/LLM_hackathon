'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function FeaturesPage() {
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

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-50 transition-colors duration-200">
      <nav className="fixed w-full z-50 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold">
              계약방패
            </Link>
            <Link href="/features" className="text-sm font-medium text-blue-600 dark:text-blue-400">기능 소개</Link>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            <button onClick={toggleTheme} className="p-2 px-4 bg-gray-200 dark:bg-gray-800 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">
              {isDark ? '라이트 모드' : '다크 모드'}
            </button>
            <Link href="/upload" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              시작하기
            </Link>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-12 text-center">주요 기능 소개</h1>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              title: "1. 위험 조항 탐지",
              desc: "전입신고 금지, 지각 벌금 등 불리한 독소조항을 신호등(🔴🟡🟢)으로 직관적으로 알려줍니다."
            },
            {
              title: "2. 누락 조항 분석",
              desc: "계약서에 꼭 있어야 하지만 빠진 항목(주휴수당 등)을 찾아내 예상 손해액으로 환산해 보여줍니다."
            },
            {
              title: "3. AI 협상 코치",
              desc: "발견된 문제에 대해 집주인이나 사장님께 보낼 카톡 메시지를 상황에 맞는 톤으로 자동 작성합니다."
            }
          ].map((feature, i) => (
            <div key={i} className="p-8 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-colors shadow-sm">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-6 text-blue-600 dark:text-blue-400 text-xl font-bold">
                {i + 1}
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
