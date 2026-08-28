import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { uploadToS3 } from "@/lib/s3";
import { generateSignedDocumentPdf } from "@/lib/generateSignedDocumentPdf";

// 세입자/집주인이 서명 이미지(base64 PNG)를 제출합니다. 양쪽 다 서명되면 세션을 완료 처리하고
// 서명이 합성된 최종 계약서 PDF를 만들어 S3에 저장합니다.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { role, signature_image } = await req.json();

  if (role !== "tenant" && role !== "landlord") {
    return NextResponse.json({ error: "role은 tenant 또는 landlord여야 합니다." }, { status: 400 });
  }
  if (!signature_image) {
    return NextResponse.json({ error: "signature_image가 필요합니다." }, { status: 400 });
  }

  const { data: signature, error } = await supabase
    .from("signatures")
    .upsert(
      { session_id: id, role, signature_image, signed_at: new Date().toISOString() },
      { onConflict: "session_id,role" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 서명 이미지도 S3에 보관 (best-effort)
  uploadToS3(`signatures/${id}-${role}.png`, Buffer.from(signature_image, "base64"), "image/png")
    .then((url) =>
      supabase.from("signatures").update({ signature_s3_url: url }).eq("id", signature.id)
    )
    .catch((err) => console.error("[S3] 서명 이미지 업로드 실패(무시하고 계속 진행):", err.message));

  const { data: allSignatures } = await supabase
    .from("signatures")
    .select("role, signature_image, signed_at")
    .eq("session_id", id);

  const roles = new Set(allSignatures?.map((s) => s.role));
  if (roles.has("tenant") && roles.has("landlord")) {
    await supabase.from("sessions").update({ status: "completed" }).eq("id", id);

    // 양쪽 다 서명됨 → 최종 계약서 PDF 생성 후 S3 업로드 (best-effort, 실패해도 계약 완료 처리는 유지)
    (async () => {
      try {
        const { data: clauses } = await supabase
          .from("clauses")
          .select()
          .eq("session_id", id)
          .order("created_at");

        const document = (clauses ?? []).map((c) => ({
          original_text: c.original_text ?? c.clause_text,
          final_text: c.clause_text,
          changed: (c.original_text ?? c.clause_text) !== c.clause_text,
          risk_level: c.risk_level,
        }));

        const pdfBuffer = await generateSignedDocumentPdf(id, document, allSignatures ?? []);
        const url = await uploadToS3(`signed-contracts/${id}.pdf`, pdfBuffer, "application/pdf");
        await supabase.from("sessions").update({ signed_document_url: url }).eq("id", id);
      } catch (err) {
        console.error("[PDF] 최종 계약서 생성/업로드 실패(무시하고 계속 진행):", (err as Error).message);
      }
    })();
  }

  return NextResponse.json({ signature });
}
