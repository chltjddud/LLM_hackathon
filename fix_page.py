file_path = r"c:\Users\chltj\Documents\GitHub\LLM_hackathon\shield-web\src\app\session\[id]\page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Emoji replacements
content = content.replace("🔥 위험 조항", "위험 조항")
content = content.replace("⚠️ 주의 조항", "주의 조항")
content = content.replace("⚖️ 관련 법령 근거", "관련 법령 근거")
content = content.replace("💡 AI 협상 가이드", "AI 협상 가이드")

content = content.replace("<div className=\"text-[64px]\">🐶</div>", "")
content = content.replace("<div className=\"absolute bottom-2 left-0 text-[32px]\">🔍</div>", "")
content = content.replace("<div className=\"text-[40px]\">🐶</div>", "")
content = content.replace("🎉 모든 조항 합의 완료!", "모든 조항 합의 완료!")

# 2. Share link fallback
old_share = """    } else {
      const textArea = document.createElement("textarea");
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        alert('상대방에게 공유할 협상 링크가 복사되었습니다!');
      } catch (err) {
        alert('복사에 실패했습니다. 직접 링크를 복사해주세요.');
      }
      document.body.removeChild(textArea);
    }"""
new_share = """    } else {
      window.prompt("아래 링크를 복사하여 공유해주세요.", link);
    }"""
content = content.replace(old_share, new_share)

# 3. Remove showPreviewModal from selectedClause block
old_modal = """         {showPreviewModal && (
           <div className="fixed inset-0 bg-black/60 z-[100] flex flex-col justify-end">
             <div className="bg-white w-full max-w-md mx-auto rounded-t-[32px] overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 pb-4 flex justify-between items-center border-b border-gray-100">
                  <h2 className="text-[20px] font-bold">수정된 계약서 미리보기</h2>
                  <button onClick={() => setShowPreviewModal(false)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
                   <h3 className="font-bold text-gray-900 mb-3">추가되는 특약사항 요약</h3>
                   <div className="bg-white border border-gray-200 rounded-[16px] p-4 mb-6 text-[14px] text-gray-600 space-y-3">
                     {clauses.map((c, i) => (
                       <div key={i} className="flex gap-2">
                         <span className="text-[#6542F1] font-bold mt-0.5">•</span>
                         <div>
                           <span className="font-bold text-gray-800">[{c.category}]</span><br/>
                           <span>{c.explanation}</span>
                         </div>
                       </div>
                     ))}
                   </div>
                   <h3 className="font-bold text-gray-900 mb-3">PDF 적용 예시</h3>
                   <div className="pointer-events-none w-[210mm] origin-top-left border border-gray-300 shadow-md" style={{ transform: 'scale(0.4)', marginBottom: '-180%' }}>
                      <RevisedContractDocument clauses={clauses} sessionDate={session?.created_at} imageUrl={session?.image_url} />
                   </div>
                </div>
                <div className="p-6 bg-white border-t border-gray-100">
                  <button onClick={handleResolveAllAndSign} className="w-full py-4 bg-[#6542F1] hover:bg-[#5233c8] text-white text-[17px] font-bold rounded-[20px] shadow-lg shadow-indigo-200">
                     모두 동의하고 서명 진행
                  </button>
                </div>
             </div>
           </div>
         )}"""
content = content.replace(old_modal, "")

# 4. Insert new showPreviewModal at the end of the file
new_modal = """         {showPreviewModal && (
           <div className="fixed inset-0 bg-black/60 z-[100] flex flex-col justify-end">
             <div className="bg-white w-full max-w-md mx-auto rounded-t-[32px] overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 pb-4 flex justify-between items-center border-b border-gray-100">
                  <h2 className="text-[20px] font-bold">전체 변경사항 미리보기 및 일괄 동의</h2>
                  <button onClick={() => setShowPreviewModal(false)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
                   <h3 className="font-bold text-gray-900 mb-3">추가되는 특약사항 요약</h3>
                   <div className="bg-white border border-gray-200 rounded-[16px] p-4 mb-6 text-[14px] text-gray-600 space-y-3">
                     {clauses.map((c, i) => (
                       <div key={i} className="flex gap-2">
                         <span className="text-[#6542F1] font-bold mt-0.5">•</span>
                         <div>
                           <span className="font-bold text-gray-800">[{c.category}]</span><br/>
                           <span>{c.explanation}</span>
                         </div>
                       </div>
                     ))}
                   </div>
                </div>
                <div className="p-6 bg-white border-t border-gray-100">
                  <button onClick={handleResolveAllAndSign} className="w-full py-4 bg-[#6542F1] hover:bg-[#5233c8] text-white text-[17px] font-bold rounded-[20px] shadow-lg shadow-indigo-200">
                     모두 동의하고 서명 진행
                  </button>
                </div>
             </div>
           </div>
         )}"""
content = content.replace("          <RevisedContractDocument", new_modal + "\n          <RevisedContractDocument")

# 5. Unify colors
content = content.replace("bg-[#FFF5F5] border border-[#FEE2E2]", "bg-gray-50 border border-gray-200")
content = content.replace("bg-[#FFF7ED] border border-[#FFEDD5]", "bg-gray-50 border border-gray-200")
content = content.replace("text-[#EF4444]", "text-[#6542F1]")
content = content.replace("text-[#F97316]", "text-[#6542F1]")
content = content.replace("bg-[#F4F6FC] rounded-[24px] p-6 border border-[#E0E7FF]", "bg-gray-50 rounded-[24px] p-6 border border-gray-200")
content = content.replace("text-[#3B82F6]", "text-[#6542F1]")
content = content.replace("text-[#4F46E5]", "text-gray-900")
content = content.replace("bg-[#F0FDF4] border border-[#DCFCE7]", "bg-gray-50 border border-gray-200")
content = content.replace("text-[#059669]", "text-[#6542F1]")
content = content.replace("stroke=\"#059669\"", "stroke=\"#6542F1\"")

content = content.replace("bg-[#F8F7FF] border border-[#E3DCFA]", "bg-gray-50 border border-gray-200")
content = content.replace("border border-[#FEE2E2]", "border border-gray-200")
content = content.replace("border border-[#FFEDD5]", "border border-gray-200")
content = content.replace("border border-[#E0E7FF]", "border border-gray-200")
content = content.replace("bg-[#F6F8FE] border border-[#E0E7FF]", "bg-gray-50 border border-gray-200")

# Keep the circles' backgrounds unified
content = content.replace("bg-[#EF4444]", "bg-[#6542F1]")
content = content.replace("bg-[#F97316]", "bg-[#6542F1]")
content = content.replace("bg-[#3B82F6]", "bg-[#6542F1]")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Replacement done.")
