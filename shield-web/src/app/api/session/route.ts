import { NextRequest, NextResponse } from "next/server";
import { analyzeContractImage } from "@/lib/analyzeContract";
import { supabase } from "@/lib/supabase";
import { getUserFromRequest } from "@/lib/auth";
import { uploadToS3 } from "@/lib/s3";

// 세입자가 사진을 올려서 새 협상 세션을 만듭니다. 로그인 상태면 세션이 계정에 연결됩니다.
export async function POST(req: NextRequest) {
  const { imageBase64, mediaType, filename, fileSize } = await req.json();

  if (!imageBase64) {
    return NextResponse.json({ error: "imageBase64가 필요합니다." }, { status: 400 });
  }

  const user = await getUserFromRequest(req);

  // 1. 세션을 먼저 'analyzing' 상태로 생성하여 즉시 응답합니다.
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({ status: "analyzing", filename, file_size: fileSize, tenant_user_id: user?.id ?? null })
    .select()
    .single();

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  // 원본 계약서 사진을 S3에 보관 (best-effort)
  const ext = (mediaType || "image/jpeg").split("/")[1] || "jpg";
  uploadToS3(`contract-photos/${session.id}.${ext}`, Buffer.from(imageBase64, "base64"), mediaType)
    .then((url) => supabase.from("sessions").update({ image_s3_url: url }).eq("id", session.id))
    .catch((err) => console.error("[S3] 계약서 사진 업로드 실패(무시하고 계속 진행):", err.message));

  // 2. 백그라운드에서 AI 분석 수행 (응답을 블로킹하지 않음)
  setTimeout(async () => {
    try {
      const clauses = await analyzeContractImage(imageBase64, mediaType);
      
      const rows = clauses.map((c) => ({
        session_id: session.id,
        clause_text: c.clause_text,
        original_text: c.clause_text,
        category_id: c.category_id,
        risk_level: c.risk_level,
        category: c.category,
        law_basis: c.law_basis,
        explanation: c.explanation,
        simulation: c.simulation,
        message_draft: c.message_draft,
      }));

      // 조항 삽입
      await supabase.from("clauses").insert(rows);
      
      // 분석 완료: 상태 업데이트
      await supabase.from("sessions").update({ status: "negotiating" }).eq("id", session.id);
    } catch (err) {
      console.error("[/api/session] Background analysis failed:", err);
      // 에러 상태로 업데이트
      await supabase.from("sessions").update({ status: "error" }).eq("id", session.id);
    }
  }, 0);

  // 3. 우선 생성된 세션 ID를 클라이언트에게 즉시 반환
  return NextResponse.json({ session, clauses: [] });
}
