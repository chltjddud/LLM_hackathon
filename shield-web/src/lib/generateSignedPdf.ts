import { PDFDocument, rgb, PDFFont, PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { SIGN_FONT_BASE64 } from "./signFontBase64";
import { appendRevisionPages, RevisedClause } from "./generateRevisedPdf";

export type SignatureRow = {
  role: string; // tenant | landlord
  signature_image: string; // base64 PNG (data URL 또는 순수 base64)
  signed_at: string;
};

// data URL 또는 순수 base64에서 { bytes, mediaType } 추출
function parseDataUrl(input: string): { bytes: Buffer; mediaType: string } {
  const m = input.match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (m) {
    return { bytes: Buffer.from(m[2], "base64"), mediaType: m[1] };
  }
  return { bytes: Buffer.from(input, "base64"), mediaType: "image/png" };
}

async function loadKoreanFont(pdfDoc: PDFDocument): Promise<PDFFont | null> {
  try {
    const fontBytes = Buffer.from(SIGN_FONT_BASE64, "base64");
    return await pdfDoc.embedFont(fontBytes, { subset: true });
  } catch {
    return null;
  }
}

async function appendOriginal(
  finalDoc: PDFDocument,
  original: { bytes: Buffer; mediaType: string }
) {
  if (original.mediaType === "application/pdf") {
    const originalDoc = await PDFDocument.load(original.bytes, { ignoreEncryption: true });
    const pages = await finalDoc.copyPages(originalDoc, originalDoc.getPageIndices());
    pages.forEach((p) => finalDoc.addPage(p));
    return;
  }

  const image =
    original.mediaType === "image/png"
      ? await finalDoc.embedPng(original.bytes)
      : await finalDoc.embedJpg(original.bytes);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 24;
  const scale = Math.min(
    (pageWidth - margin * 2) / image.width,
    (pageHeight - margin * 2) / image.height
  );
  const w = image.width * scale;
  const h = image.height * scale;
  const page = finalDoc.addPage([pageWidth, pageHeight]);
  page.drawImage(image, {
    x: (pageWidth - w) / 2,
    y: (pageHeight - h) / 2,
    width: w,
    height: h,
  });
}

async function drawSignatureImage(
  finalDoc: PDFDocument,
  page: PDFPage,
  sig: SignatureRow | undefined,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number
) {
  if (!sig) return;
  try {
    const { bytes } = parseDataUrl(sig.signature_image);
    const png = await finalDoc.embedPng(bytes);
    const scale = Math.min(boxW / png.width, boxH / png.height);
    const w = png.width * scale;
    const h = png.height * scale;
    page.drawImage(png, {
      x: boxX + (boxW - w) / 2,
      y: boxY + (boxH - h) / 2,
      width: w,
      height: h,
    });
  } catch {
    /* 서명 이미지 실패 시 무시 */
  }
}

export async function generateSignedPdf(
  originalImageUrl: string,
  signatures: SignatureRow[],
  clauses: RevisedClause[] = []
): Promise<Buffer> {
  const finalDoc = await PDFDocument.create();
  finalDoc.registerFontkit(fontkit);

  // 1) 원본 계약서 페이지
  await appendOriginal(finalDoc, parseDataUrl(originalImageUrl));

  // 2) 협상 반영 수정본 내역 페이지
  const font = await loadKoreanFont(finalDoc);
  if (clauses.length > 0) {
    appendRevisionPages(finalDoc, clauses, font);
  }

  // 3) 서명 페이지
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const page = finalDoc.addPage([pageWidth, pageHeight]);

  const ink = rgb(0.09, 0.09, 0.11);
  const gray = rgb(0.45, 0.45, 0.5);
  const line = rgb(0.85, 0.85, 0.87);

  const drawText = (text: string, x: number, y: number, size: number, color = ink) => {
    try {
      if (font) page.drawText(text, { x, y, size, font, color });
      else page.drawText(text, { x, y, size, color });
    } catch {
      /* 기본 폰트로 못 그리는 문자는 건너뜀 */
    }
  };

  const tenant = signatures.find((s) => s.role === "tenant");
  const landlord = signatures.find((s) => s.role === "landlord");
  const fmtDate = (iso?: string) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      const p = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}. ${p(d.getMonth() + 1)}. ${p(d.getDate())}. ${p(d.getHours())}:${p(d.getMinutes())}`;
    } catch {
      return iso;
    }
  };

  // 제목 + 안내
  drawText("전자서명 확인서", 48, pageHeight - 80, 24);
  drawText(
    "본 문서는 위 계약서에 대해 양 당사자가 전자적으로 서명하였음을 증명합니다.",
    48,
    pageHeight - 110,
    11,
    gray
  );
  page.drawLine({
    start: { x: 48, y: pageHeight - 130 },
    end: { x: pageWidth - 48, y: pageHeight - 130 },
    thickness: 1,
    color: line,
  });

  const boxInnerH = 110;
  const drawParty = async (
    label: string,
    sig: SignatureRow | undefined,
    labelY: number
  ) => {
    drawText(label, 48, labelY, 14);
    drawText(sig ? `서명일시: ${fmtDate(sig.signed_at)}` : "서명 없음", 48, labelY - 22, 10, gray);
    const boxX = 220;
    const boxW = pageWidth - 48 - boxX;
    const boxY = labelY - boxInnerH + 24;
    page.drawRectangle({
      x: boxX,
      y: boxY,
      width: boxW,
      height: boxInnerH,
      borderColor: line,
      borderWidth: 1,
      color: rgb(0.99, 0.99, 1),
    });
    await drawSignatureImage(finalDoc, page, sig, boxX, boxY, boxW, boxInnerH);
  };

  await drawParty("세입자 (임차인)", tenant, pageHeight - 180);
  await drawParty("집주인 (임대인)", landlord, pageHeight - 180 - boxInnerH - 60);

  drawText(
    "SIGNAL 전자서명 · 본 서명 페이지는 원본 계약서와 함께 하나의 문서로 보관됩니다.",
    48,
    60,
    9,
    gray
  );

  const finalBytes = await finalDoc.save();
  return Buffer.from(finalBytes);
}
