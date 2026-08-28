with open(r'shield-web/src/app/session/[id]/page.tsx', encoding='utf-8') as f:
    content = f.read()

# 1. Update the modal summary display
old_modal_summary = """                   <div className="bg-white border border-gray-200 rounded-[16px] p-4 mb-6 text-[14px] text-gray-600 space-y-2">
                     {clauses.map((c, i) => (
                       <div key={i} className="flex gap-2">
                         <span className="text-[#6542F1] font-bold">•</span>
                         <span>{c.clause_text || '내용 없음'}</span>
                       </div>
                     ))}
                   </div>"""

# Show category and explanation instead of the problematic text
new_modal_summary = """                   <div className="bg-white border border-gray-200 rounded-[16px] p-4 mb-6 text-[14px] text-gray-600 space-y-3">
                     {clauses.map((c, i) => (
                       <div key={i} className="flex gap-2">
                         <span className="text-[#6542F1] font-bold mt-0.5">•</span>
                         <div>
                           <span className="font-bold text-gray-800">[{c.category}]</span><br/>
                           <span>{c.explanation}</span>
                         </div>
                       </div>
                     ))}
                   </div>"""

content = content.replace(old_modal_summary, new_modal_summary)

# 2. Add waiting message for signatures
# Find where the download button is
old_download_section = """                      {signatures.length >= 2 && (
                        <button onClick={handleDownloadPDF} className="w-full mt-3 py-4 bg-white border-2 border-[#6542F1] text-[#6542F1] hover:bg-gray-50 transition-colors text-[17px] font-bold rounded-[20px] shadow-sm flex items-center justify-center gap-2">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                          수정된 계약서 (특약사항 덮어쓰기) 다운로드
                        </button>
                      )}"""

new_download_section = """                      {signatures.length >= 2 ? (
                        <button onClick={handleDownloadPDF} className="w-full mt-3 py-4 bg-white border-2 border-[#6542F1] text-[#6542F1] hover:bg-gray-50 transition-colors text-[17px] font-bold rounded-[20px] shadow-sm flex items-center justify-center gap-2">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                          수정된 계약서 (특약사항 덮어쓰기) 다운로드
                        </button>
                      ) : hasSigned ? (
                        <div className="mt-4 p-4 bg-[#F9FAFC] border border-gray-200 rounded-[16px] flex items-center gap-3 text-gray-600">
                          <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center shrink-0">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                          </div>
                          <p className="text-[14px] font-medium leading-relaxed">
                            서명이 완료되었습니다.<br/>
                            <span className="font-bold text-gray-800">상대방이 아직 서명하지 않았습니다. (대기 중)</span>
                          </p>
                        </div>
                      ) : null}"""

content = content.replace(old_download_section, new_download_section)

with open(r'shield-web/src/app/session/[id]/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("page.tsx updated")
