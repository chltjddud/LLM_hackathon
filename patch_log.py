with open(r'shield-web/src/app/session/[id]/page.tsx', encoding='utf-8') as f:
    content = f.read()

# 1. Restore handlePreviewPDF button and add detailed logging

handle_preview_func = """  const handlePreviewPDF = async () => {
    const previewWindow = window.open('', '_blank');
    if (previewWindow) {
      previewWindow.document.write('<div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;color:#666;flex-direction:column;"><h2>PDF를 생성 중입니다...</h2><p id="log">진행 중...</p></div>');
    }

    const logToWindow = (msg: string) => {
      console.log(msg);
      if (previewWindow) {
        previewWindow.document.getElementById('log')!.innerText = msg;
      }
    };

    const element = document.getElementById('pdf-contract-document');
    if (!element) {
      alert("문서 요소를 찾을 수 없습니다.");
      if (previewWindow) previewWindow.close();
      return;
    }
    element.classList.remove('hidden');
    element.style.display = 'block';
    
    try {
      logToWindow('html2canvas로 이미지 캡처 중...');
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: true, allowTaint: false });
      
      logToWindow('캡처 완료, DataURL 변환 중...');
      const imgData = canvas.toDataURL('image/png');
      
      logToWindow('PDF 객체 생성 중...');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      logToWindow('PDF에 이미지 합성 중...');
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      logToWindow('PDF Blob 생성 중...');
      const blob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      
      logToWindow('완료! 창 띄우기...');
      if (previewWindow) {
        previewWindow.document.body.innerHTML = `<iframe src="${blobUrl}#toolbar=0" width="100%" height="100%" style="border:none;"></iframe>`;
        previewWindow.document.body.style.margin = '0';
      } else {
        window.open(blobUrl, '_blank');
      }
    } catch (error: any) {
      console.error('PDF 생성 오류 상세:', error);
      alert('PDF 생성 오류: ' + (error.message || error.toString()));
      if (previewWindow) previewWindow.close();
    } finally {
      element.classList.add('hidden');
      element.style.display = '';
    }
  };
"""

# Replace the existing handlePreviewPDF
if "const handlePreviewPDF = async () => {" in content:
    start_idx = content.find("const handlePreviewPDF = async () => {")
    end_idx = content.find("const handleDownloadPDF = async () => {")
    content = content[:start_idx] + handle_preview_func + "\n  " + content[end_idx:]


# 2. Revert the inline preview back to the button
inline_preview_section = """                   <h3 className="font-bold text-gray-900 mb-3">수정된 계약서 (PDF 미리보기)</h3>
                   <div className="relative w-full h-[400px] overflow-hidden bg-gray-200 border border-gray-300 shadow-inner rounded-[12px] flex items-start justify-center pt-2">
                     <div className="pointer-events-none origin-top" style={{ transform: 'scale(0.35)', width: '210mm', height: '297mm' }}>
                       <RevisedContractDocument clauses={clauses} sessionDate={session?.created_at} imageUrl={session?.image_url} hidden={false} previewMode={true} />
                     </div>
                   </div>"""

button_section = """                   <div className="flex gap-2 mt-2">
                     <button onClick={handlePreviewPDF} className="flex-1 py-4 bg-white border border-gray-200 text-gray-800 font-bold rounded-[16px] shadow-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        수정된 PDF 바로보기
                     </button>
                   </div>"""

content = content.replace(inline_preview_section, button_section)

with open(r'shield-web/src/app/session/[id]/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Restored button with detailed logging.")
