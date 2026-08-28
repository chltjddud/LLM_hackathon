with open(r'shield-web/src/app/session/[id]/page.tsx', encoding='utf-8') as f:
    content = f.read()

# 1. Add state variable
state_var = "  const [showWebPreview, setShowWebPreview] = useState(false);\n"
if "showWebPreview" not in content:
    idx = content.find("const [selectedClause, setSelectedClause] = useState<any>(null);")
    content = content[:idx] + state_var + content[idx:]

# 2. Replace button inside showPreviewModal
old_btn = """                    <div className="flex gap-2 mt-2">
                      <button onClick={handlePreviewPDF} className="flex-1 py-4 bg-white border border-gray-200 text-gray-800 font-bold rounded-[16px] shadow-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
                         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                         수정된 PDF 바로보기
                      </button>
                    </div>"""

new_btn = """                    <div className="flex gap-2 mt-2">
                      <button onClick={() => setShowWebPreview(true)} className="flex-1 py-4 bg-[#6542F1] text-white font-bold rounded-[16px] shadow-sm flex items-center justify-center gap-2 hover:bg-[#5233c8] transition-colors">
                         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                         수정된 계약서 보기 (웹)
                      </button>
                    </div>"""

content = content.replace(old_btn, new_btn)

# 3. Add showWebPreview modal block at the bottom, just before ending tags
web_modal = """
          {showWebPreview && (
            <div className="fixed inset-0 bg-black/85 z-[110] flex flex-col justify-between">
              {/* Header */}
              <div className="p-4 bg-white flex justify-between items-center border-b border-gray-200">
                <h2 className="text-[17px] font-extrabold text-gray-900">수정된 계약서 미리보기</h2>
                <button onClick={() => setShowWebPreview(false)} className="p-1 text-gray-500 hover:text-gray-700">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>

              {/* PDF Web View area */}
              <div className="flex-1 overflow-auto flex items-start justify-center p-4 bg-gray-900">
                <div className="relative w-[320px] h-[450px] overflow-hidden bg-white border border-gray-700 shadow-2xl rounded-xl shrink-0 mt-4">
                  <div className="origin-top-left" style={{ transform: 'scale(0.4)', width: '210mm', height: '297mm' }}>
                    <RevisedContractDocument clauses={clauses} sessionDate={session?.created_at} imageUrl={session?.image_url} hidden={false} previewMode={true} />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-6 bg-white border-t border-gray-200 flex flex-col gap-3">
                <button 
                  onClick={handleDownloadPDF} 
                  className="w-full py-3.5 bg-white border-2 border-[#6542F1] text-[#6542F1] text-[16px] font-bold rounded-[20px] shadow-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  수정된 계약서 다운로드 (PDF)
                </button>
                <button 
                  onClick={() => {
                    setShowWebPreview(false);
                    setShowPreviewModal(false);
                    handleResolveAllAndSign();
                  }} 
                  className="w-full py-4 bg-[#6542F1] text-white text-[17px] font-bold rounded-[20px] shadow-lg shadow-indigo-200 hover:bg-[#5233c8] transition-colors"
                >
                  모두 동의하고 서명 진행
                </button>
              </div>
            </div>
          )}
"""

# Insert web_modal just before the end of the return statement
insert_idx = content.rfind("      </main>")
if insert_idx != -1:
    content = content[:insert_idx] + web_modal + content[insert_idx:]

with open(r'shield-web/src/app/session/[id]/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Web preview overlay modal implemented successfully.")
