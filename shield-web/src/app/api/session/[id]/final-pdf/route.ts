import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateSignedPdf, SignatureRow } from "@/lib/generateSignedPdf";

export const runtime = "nodejs";

// 양쪽(세입자/집주인)이 모두 서명한 경우, 원본 계약서 뒤에 서명 페이지를 붙인
// 최종 계약서 PDF를 즉석에서 생성해 다운로드로 응답합니다.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 원본 계약서(base64 data URL), 서명, 조항(협상 반영 내역용)을 조회
  const [{ data: session, error: sessionError }, { data: signatures }, { data: clauses }] = await Promise.all([
    supabase.from("sessions").select("id, image_url").eq("id", id).single(),
    supabase.from("signatures").select("role, signature_image, signed_at").eq("session_id", id),
    supabase.from("clauses").select().eq("session_id", id).order("created_at"),
  ]);

  if (sessionError || !session) {
    return NextResponse.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
  }
  if (!session.image_url) {
    return NextResponse.json({ error: "원본 계약서를 찾을 수 없습니다." }, { status: 400 });
  }

  const rows = (signatures ?? []) as SignatureRow[];
  const roles = new Set(rows.map((s) => s.role));
  if (!roles.has("tenant") || !roles.has("landlord")) {
    return NextResponse.json(
      { error: "양쪽 당사자의 서명이 모두 완료되어야 최종 계약서를 받을 수 있습니다." },
      { status: 400 }
    );
  }

  const revisedClauses = (clauses ?? []).map((c) => ({
    category: c.category ?? null,
    original_text: c.original_text ?? c.clause_text ?? "",
    final_text: c.clause_text ?? "",
    changed: (c.original_text ?? c.clause_text) !== c.clause_text,
    risk_level: c.risk_level ?? "",
  }));

  try {
    const pdf = await generateSignedPdf(session.image_url, rows, revisedClauses);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        // inline: 브라우저 뷰어로 열기(다운로드가 아니라 "보기"로 처리 -> HTTP insecure download 경고 회피)
        "Content-Disposition": `inline; filename="signed-contract-${id}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[final-pdf] 생성 실패:", (err as Error).message);
    return NextResponse.json(
      { error: "최종 계약서 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
