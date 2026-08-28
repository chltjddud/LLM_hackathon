import { writeFileSync, readFileSync } from "fs";
import { chromium } from "playwright";

// generateSignedDocumentPdf.ts는 TS라 여기선 같은 로직을 인라인으로 재현해서 빠르게 눈으로 확인
const tinyPng = readFileSync("sample/샘플B_임대차계약서_함정.png").toString("base64").slice(0, 2000); // 그냥 더미 대용

const html = `
<html><head><meta charset="utf-8" />
<style>body{font-family:"Malgun Gothic","Noto Sans KR",sans-serif;padding:40px;color:#18181b;}
h1{font-size:20px;} .meta{font-size:12px;color:#71717a;margin-bottom:24px;}
.clause{margin-bottom:14px;padding:12px 14px;border:1px solid #e4e4e7;border-radius:8px;}
</style></head>
<body>
<h1>계약 협상 완료본</h1>
<div class="meta">세션 ID: test-1234 · 생성일: 2026-08-28</div>
<div class="clause"><b style="color:#dc2626">위험 · 협상으로 수정됨</b><br/>
<span style="text-decoration:line-through;color:#a1a1aa">전입신고 및 확정일자를 받지 아니하기로 한다</span><br/>
[수정됨] 전입신고 및 확정일자를 받는 것으로 한다</div>
<div style="display:flex;gap:24px;margin-top:32px;padding-top:24px;border-top:1px solid #e4e4e7;">
  <div style="flex:1;text-align:center;">
    <div style="font-size:12px;color:#71717a;margin-bottom:8px;">세입자 서명</div>
    <div style="height:70px;border:1px dashed #ccc;display:flex;align-items:center;justify-content:center;">(서명이미지)</div>
  </div>
  <div style="flex:1;text-align:center;">
    <div style="font-size:12px;color:#71717a;margin-bottom:8px;">집주인 서명</div>
    <div style="height:70px;border:1px dashed #ccc;display:flex;align-items:center;justify-content:center;">(서명이미지)</div>
  </div>
</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html);
const pdf = await page.pdf({ format: "A4", margin: { top: "10mm", bottom: "10mm" } });
writeFileSync("scripts/test-output.pdf", pdf);
console.log("PDF 생성됨:", pdf.length, "bytes");
await browser.close();
