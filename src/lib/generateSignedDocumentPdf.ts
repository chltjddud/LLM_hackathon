import { chromium } from "playwright";

type DocumentClause = {
  original_text: string;
  final_text: string;
  changed: boolean;
  risk_level: string;
};

type SignatureRow = {
  role: string;
  signature_image: string; // base64 PNG
  signed_at: string;
};

const RISK_COLOR: Record<string, string> = {
  위험: "#dc2626",
  주의: "#d97706",
  안전: "#71717a",
};

function buildHtml(
  sessionId: string,
  document: DocumentClause[],
  signatures: SignatureRow[]
): string {
  const clauseRows = document
    .map(
      (c, i) => `
      <div style="margin-bottom:14px; padding:12px 14px; border:1px solid #e4e4e7; border-radius:8px;">
        <div style="font-size:11px; font-weight:700; color:${RISK_COLOR[c.risk_level] ?? "#71717a"}; margin-bottom:6px;">
          ${i + 1}. ${c.risk_level}${c.changed ? " · 협상으로 수정됨" : ""}
        </div>
        ${
          c.changed
            ? `<div style="font-size:12px; color:#a1a1aa; text-decoration:line-through; margin-bottom:4px;">${c.original_text}</div>`
            : ""
        }
        <div style="font-size:13px; color:#18181b;">${c.final_text}</div>
      </div>`
    )
    .join("\n");

  const tenantSig = signatures.find((s) => s.role === "tenant");
  const landlordSig = signatures.find((s) => s.role === "landlord");

  const sigBlock = (label: string, sig?: SignatureRow) => `
    <div style="flex:1; text-align:center;">
      <div style="font-size:12px; color:#71717a; margin-bottom:8px;">${label}</div>
      ${
        sig
          ? `<img src="data:image/png;base64,${sig.signature_image}" style="height:70px; object-fit:contain;" />
             <div style="font-size:10px; color:#a1a1aa; margin-top:4px;">${new Date(sig.signed_at).toLocaleString("ko-KR")}</div>`
          : `<div style="height:70px; display:flex; align-items:center; justify-content:center; color:#d4d4d8;">서명 없음</div>`
      }
    </div>`;

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: "Malgun Gothic", "Noto Sans KR", sans-serif; padding: 40px; color: #18181b; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .meta { font-size: 12px; color: #71717a; margin-bottom: 24px; }
      </style>
    </head>
    <body>
      <h1>계약 협상 완료본</h1>
      <div class="meta">세션 ID: ${sessionId} · 생성일: ${new Date().toLocaleString("ko-KR")}</div>
      ${clauseRows}
      <div style="display:flex; gap:24px; margin-top:32px; padding-top:24px; border-top:1px solid #e4e4e7;">
        ${sigBlock("세입자 서명", tenantSig)}
        ${sigBlock("집주인 서명", landlordSig)}
      </div>
    </body>
  </html>`;
}

export async function generateSignedDocumentPdf(
  sessionId: string,
  document: DocumentClause[],
  signatures: SignatureRow[]
): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(buildHtml(sessionId, document, signatures));
    const pdf = await page.pdf({ format: "A4", margin: { top: "10mm", bottom: "10mm" } });
    return pdf;
  } finally {
    await browser.close();
  }
}
