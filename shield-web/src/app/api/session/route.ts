import { NextRequest, NextResponse } from "next/server";
import { analyzeContractImage } from "@/lib/analyzeContract";
import { supabase } from "@/lib/supabase";
import { getUserFromRequest } from "@/lib/auth";

// 세입자가 사진을 올려서 새 협상 세션을 만듭니다.
export async function POST(req: NextRequest) {
  const { imageBase64, mediaType, filename, fileSize } = await req.json();

  if (!imageBase64) {
    return NextResponse.json({ error: "imageBase64가 필요합니다." }, { status: 400 });
  }

  const user = await getUserFromRequest(req);

  // 1. 세션을 먼저 'analyzing' 상태로 생성하여 즉시 응답합니다.
  const imageUrl = `data:${mediaType};base64,${imageBase64}`;
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({ status: "analyzing", filename, file_size: fileSize, tenant_user_id: user?.id ?? null, image_url: imageUrl })
    .select()
    .single();

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

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
