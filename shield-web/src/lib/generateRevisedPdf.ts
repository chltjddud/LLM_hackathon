import { PDFDocument, rgb, PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { SIGN_FONT_BASE64 } from "./signFontBase64";

export type RevisedClause = {
  category: string | null;
  original_text: string;
  final_text: string;
  changed: boolean;
  risk_level: string;
};

function parseDataUrl(input: string): { bytes: Buffer; mediaType: string } {
  const m = input.match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (m) return { bytes: Buffer.from(m[2], "base64"), mediaType: m[1] };
  return { bytes: Buffer.from(input, "base64"), mediaType: "image/png" };
}

async function loadKoreanFont(pdfDoc: PDFDocument): Promise<PDFFont | null> {
  try {
    return await pdfDoc.embedFont(Buffer.from(SIGN_FONT_BASE64, "base64"), { subset: true });
  } catch {
    return null;
  }
}

async function appendOriginal(doc: PDFDocument, original: { bytes: Buffer; mediaType: string }) {
  if (original.mediaType === "application/pdf") {
    const src = await PDFDocument.load(original.bytes, { ignoreEncryption: true });
    const pages = await doc.copyPages(src, src.getPageIndices());
    pages.forEach((p) => doc.addPage(p));
    return;
  }
  const image =
    original.mediaType === "image/png"
      ? await doc.embedPng(original.bytes)
      : await doc.embedJpg(original.bytes);
  const pw = 595.28, ph = 841.89, margin = 24;
  const scale = Math.min((pw - margin * 2) / image.width, (ph - margin * 2) / image.height);
  const w = image.width * scale, h = image.height * scale;
  const page = doc.addPage([pw, ph]);
  page.drawImage(image, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
}

// 폰트 기준 줄바꿈
function wrapText(text: string, font: PDFFont | null, size: number, maxWidth: number): string[] {
  const words = (text || "").split(/(\s+)/);
  const lines: string[] = [];
  let cur = "";
  const widthOf = (s: string) => {
    try { return font ? font.widthOfTextAtSize(s, size) : s.length * size * 0.5; }
    catch { return s.length * size * 0.5; }
  };
  const pushChar = (chunk: string) => {
    for (const ch of chunk) {
      if (widthOf(cur + ch) > maxWidth) { lines.push(cur); cur = ch; }
      else { cur += ch; }
    }
  };
  for (const w of words) {
    if (widthOf(cur + w) > maxWidth) {
      if (widthOf(w) > maxWidth) pushChar(w);
      else { lines.push(cur); cur = w; }
    } else { cur += w; }
  }
  if (cur.trim().length > 0 || lines.length === 0) lines.push(cur);
  return lines.map((l) => l.replace(/\s+$/, ""));
}

// 문서에 "협상 반영 수정본" 내역 페이지(들)를 추가한다. (revised/signed PDF 공용)
export function appendRevisionPages(
  doc: PDFDocument,
  clauses: RevisedClause[],
  font: PDFFont | null
) {
  const pw = 595.28, ph = 841.89;
  const marginX = 48;
  const contentW = pw - marginX * 2;

  const ink = rgb(0.09, 0.09, 0.11);
  const gray = rgb(0.45, 0.45, 0.5);
  const line = rgb(0.85, 0.85, 0.87);
  const purple = rgb(0.4, 0.26, 0.94);
  const strikeGray = rgb(0.6, 0.6, 0.63);

  let page = doc.addPage([pw, ph]);
  let y = ph - 64;

  const ensureSpace = (needed: number) => {
    if (y - needed < 60) {
      page = doc.addPage([pw, ph]);
      y = ph - 64;
    }
  };
  const drawText = (text: string, x: number, size: number, color = ink) => {
    try {
      if (font) page.drawText(text, { x, y, size, font, color });
      else page.drawText(text, { x, y, size, color });
    } catch { /* skip */ }
  };
  const drawParagraph = (text: string, x: number, size: number, lineH: number, color = ink, maxW = contentW - (x - marginX)) => {
    const lines = wrapText(text, font, size, maxW);
    for (const ln of lines) {
      ensureSpace(lineH);
      try {
        if (font) page.drawText(ln, { x, y, size, font, color });
        else page.drawText(ln, { x, y, size, color });
      } catch { /* skip */ }
      y -= lineH;
    }
  };

  drawText("협상 반영 수정본", marginX, 24);
  y -= 30;
  drawText("아래 내용은 협상을 통해 조정된 조항입니다.", marginX, 11, gray);
  y -= 20;
  page.drawLine({ start: { x: marginX, y }, end: { x: pw - marginX, y }, thickness: 1, color: line });
  y -= 26;

  const changed = clauses.filter((c) => c.changed);
  const targets = changed.length > 0 ? changed : clauses;
  if (targets.length === 0) drawText("표시할 조항이 없습니다.", marginX, 13, gray);

  targets.forEach((c, i) => {
    ensureSpace(90);
    drawText(`${i + 1}. ${c.category || "조항"}`, marginX, 14, ink);
    y -= 22;
    if (c.changed) {
      drawText("[기존]", marginX, 10, strikeGray);
      y -= 15;
      drawParagraph(c.original_text || "내용 없음", marginX + 8, 11, 16, strikeGray);
      y -= 6;
      drawText("[수정]", marginX, 10, purple);
      y -= 15;
      drawParagraph(c.final_text || "내용 없음", marginX + 8, 11, 16, ink);
    } else {
      drawParagraph(c.final_text || c.original_text || "내용 없음", marginX + 8, 11, 16, ink);
    }
    y -= 18;
    ensureSpace(2);
    page.drawLine({ start: { x: marginX, y: y + 6 }, end: { x: pw - marginX, y: y + 6 }, thickness: 0.5, color: line });
    y -= 12;
  });

  ensureSpace(30);
  drawText("SIGNAL · 협상 반영 수정본 (참고용, 최종본은 양측 서명 후 생성됩니다)", marginX, 9, gray);
}

// 원본 계약서 + 협상 반영 수정본 페이지
export async function generateRevisedPdf(
  originalImageUrl: string,
  clauses: RevisedClause[]
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  await appendOriginal(doc, parseDataUrl(originalImageUrl));
  const font = await loadKoreanFont(doc);
  appendRevisionPages(doc, clauses, font);
  const bytes = await doc.save();
  return Buffer.from(bytes);
}
