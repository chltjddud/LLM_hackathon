with open(r'shield-web/src/app/session/[id]/page.tsx', encoding='utf-8') as f:
    content = f.read()

# 1. Add state variable
state_var = "  const [showPreviewModal, setShowPreviewModal] = useState(false);\n"
if "showPreviewModal" not in content:
    idx = content.find("const [activeTab, setActiveTab]")
    content = content[:idx] + state_var + "  " + content[idx:]

# 2. Add handleResolveAllAndSign function
resolve_all_fn = """  const handleResolveAllAndSign = async () => {
    try {
      const promises = clauses.map(c => 
        fetch(`/api/session/${id}/clause/${c.id}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role, resolved: true })
        })
      );
      await Promise.all(promises);
      
      // optimistic update
      setClauses(prev => prev.map(c => ({
        ...c, 
        [role === 'tenant' ? 'resolved_by_tenant' : 'resolved_by_landlord']: true 
      })));
      
      setShowPreviewModal(false);
      setActiveTab('sign');
    } catch (err) {
      alert('일괄 동의 처리 중 오류가 발생했습니다.');
    }
  };

"""
if "handleResolveAllAndSign" not in content:
    idx = content.find("const handleResolveClause")
    content = content[:idx] + resolve_all_fn + content[idx:]

# 3. Add button at the bottom of the contracts tab
# We find the end of the contracts tab content, just before the floating banner logic
# Currently it looks like:
#                      </div>
#                    </div>
#                  </div>
#                </div>
#
#                  {/* Floating Banner when all resolved */}
target_btn_spot = """                    </div>
                  </div>
                </div>

                  {/* Floating Banner when all resolved */}"""

new_btn_spot = """                    </div>
                  </div>
                  
                  {unresolvedCriticalCount > 0 && !hasSigned && (
                    <div className="px-5 pb-8 pt-2">
                      <button onClick={() => setShowPreviewModal(true)} className="w-full py-4 bg-[#6542F1] text-white text-[17px] font-bold rounded-[20px] shadow-lg shadow-indigo-200">
                         전체 변경사항 미리보기 및 일괄 동의
                      </button>
                    </div>
                  )}
                </div>

                  {/* Floating Banner when all resolved */}"""
if "미리보기 및 일괄 동의" not in content:
    content = content.replace(target_btn_spot, new_btn_spot)

# 4. Add the modal UI just before the end of the main return block
modal_ui = """
         {showPreviewModal && (
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
                   <div className="bg-white border border-gray-200 rounded-[16px] p-4 mb-6 text-[14px] text-gray-600 space-y-2">
                     {clauses.map((c, i) => (
                       <div key={i} className="flex gap-2">
                         <span className="text-[#6542F1] font-bold">•</span>
                         <span>{c.clause_text || '내용 없음'}</span>
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
         )}
"""
if "수정된 계약서 미리보기" not in content:
    idx = content.rfind("      </main>")
    content = content[:idx] + modal_ui + content[idx:]

with open(r'shield-web/src/app/session/[id]/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated page.tsx with modal logic.")
