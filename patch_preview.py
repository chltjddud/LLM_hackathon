with open(r'shield-web/src/app/session/[id]/page.tsx', encoding='utf-8') as f:
    content = f.read()

# 1. Add handlePreviewPDF
preview_func = """  const handlePreviewPDF = async () => {
    const element = document.getElementById('pdf-contract-document');
    if (!element) return;
    element.classList.remove('hidden');
    element.style.display = 'block';
    
    // Show some kind of indicator if possible, or just wait (usually takes 1-2s)
    try {
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      const blob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (error) {
      console.error('PDF 생성 오류:', error);
      alert('PDF 미리보기에 실패했습니다.');
    } finally {
      element.classList.add('hidden');
      element.style.display = '';
    }
  };
"""

if "handlePreviewPDF" not in content:
    idx = content.find("const handleDownloadPDF = async () => {")
    content = content[:idx] + preview_func + "\n" + content[idx:]

# 2. Replace the modal preview section with the button
old_preview_section = """                   <h3 className="font-bold text-gray-900 mb-3">PDF 적용 예시</h3>
                   <div className="relative w-full h-[400px] overflow-hidden bg-gray-200 border border-gray-300 shadow-inner rounded-[12px] flex items-start justify-center pt-2">
                     <div className="pointer-events-none origin-top" style={{ transform: 'scale(0.35)', width: '210mm', height: '297mm' }}>
                       <RevisedContractDocument clauses={clauses} sessionDate={session?.created_at} imageUrl={session?.image_url} hidden={false} />
                     </div>
                   </div>"""

new_preview_section = """                   <div className="flex gap-2 mt-2">
                     <button onClick={handlePreviewPDF} className="flex-1 py-4 bg-white border border-gray-200 text-gray-800 font-bold rounded-[16px] shadow-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        PDF 원본으로 바로 보기
                     </button>
                   </div>"""

content = content.replace(old_preview_section, new_preview_section)

with open(r'shield-web/src/app/session/[id]/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("page.tsx updated with PDF preview button.")
