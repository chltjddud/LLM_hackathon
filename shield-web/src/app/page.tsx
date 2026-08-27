import React from 'react';

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white selection:bg-blue-500 selection:text-white">
      {/* Navigation */}
      <nav className="fixed w-full z-50 border-b border-white/10 bg-black/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
              계약방패
            </span>
            <span className="text-xs px-2 py-1 bg-white/10 rounded-full text-gray-300">Beta</span>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            <button className="text-gray-300 hover:text-white transition-colors">로그인</button>
            <button className="bg-white text-black px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors">
              시작하기
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/20 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8">
            계약서 사인하기 전,<br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 bg-clip-text text-transparent">
              당신의 권리를 지키세요.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            임대차·근로 계약서를 올리면 숨겨진 위험 조항과 빠진 조항을 찾아내고,
            상대방에게 보낼 협상 메시지까지 AI가 만들어 드립니다.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="group w-full sm:w-auto bg-white text-black px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-100 transition-all flex items-center justify-center gap-2">
              계약서 스캔 시작하기
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
            <button className="w-full sm:w-auto px-8 py-4 rounded-xl font-semibold text-lg border border-white/20 hover:bg-white/5 transition-colors">
              데모 보기
            </button>
          </div>
        </div>
      </section>

      {/* Feature Section */}
      <section className="py-20 px-6 bg-white/5 border-y border-white/10">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-8">
          {[
            {
              title: "위험 조항 탐지",
              desc: "전입신고 금지, 지각 벌금 등 불리한 독소조항을 신호등(🔴🟡🟢)으로 직관적으로 알려줍니다."
            },
            {
              title: "누락 조항 분석",
              desc: "계약서에 꼭 있어야 하지만 빠진 항목(주휴수당 등)을 찾아내 예상 손해액으로 환산해 보여줍니다."
            },
            {
              title: "AI 협상 코치",
              desc: "발견된 문제에 대해 집주인이나 사장님께 보낼 카톡 메시지를 상황에 맞는 톤으로 자동 작성합니다."
            }
          ].map((feature, i) => (
            <div key={i} className="p-8 rounded-2xl bg-black/40 border border-white/10 hover:border-white/20 transition-colors">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-6 text-blue-400 text-2xl font-bold">
                {i + 1}
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
