with open(r'shield-web/src/app/session/[id]/page.tsx', encoding='utf-8') as f:
    content = f.read()

# 1. Replace the "PDF 원본으로 바로 보기" button section with the inline preview
old_button_section = """                   <div className="flex gap-2 mt-2">
                     <button onClick={handlePreviewPDF} className="flex-1 py-4 bg-white border border-gray-200 text-gray-800 font-bold rounded-[16px] shadow-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        수정된 PDF 바로보기
                     </button>
                   </div>"""

new_preview_section = """                   <h3 className="font-bold text-gray-900 mb-3">수정된 계약서 (PDF 미리보기)</h3>
                   <div className="relative w-full h-[400px] overflow-hidden bg-gray-200 border border-gray-300 shadow-inner rounded-[12px] flex items-start justify-center pt-2">
                     <div className="pointer-events-none origin-top" style={{ transform: 'scale(0.35)', width: '210mm', height: '297mm' }}>
                       <RevisedContractDocument clauses={clauses} sessionDate={session?.created_at} imageUrl={session?.image_url} hidden={false} previewMode={true} />
                     </div>
                   </div>"""

content = content.replace(old_button_section, new_preview_section)

with open(r'shield-web/src/app/session/[id]/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

# 2. Modify RevisedContractDocument.tsx to move the overlay up to top: 55%
with open(r'shield-web/src/components/RevisedContractDocument.tsx', encoding='utf-8') as f:
    doc_content = f.read()

doc_content = doc_content.replace('top: "70%", // placing at bottom 30%', 'top: "55%", // placing right beneath the rules')
doc_content = doc_content.replace('backgroundColor: "rgba(255, 255, 255, 0.95)"', 'backgroundColor: "rgba(255, 255, 255, 1)"')

with open(r'shield-web/src/components/RevisedContractDocument.tsx', 'w', encoding='utf-8') as f:
    f.write(doc_content)

print("Restored inline preview and adjusted overlay position.")
