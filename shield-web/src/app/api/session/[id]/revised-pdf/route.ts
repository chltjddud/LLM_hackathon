import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateRevisedPdf, RevisedClause } from "@/lib/generateRevisedPdf";

export const runtime = "nodejs";

// 협상으로 조정된 조항(clause_text)을 원본 계약서 뒤에 "수정 내역" 페이지로 붙인
// 수정본 계약서 PDF를 즉석에서 생성해 브라우저 뷰어로 응답합니다.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [{ data: session, error: sessionError }, { data: clauses }] = await Promise.all([
    supabase.from("sessions").select("id, image_url").eq("id", id).single(),
    supabase.from("clauses").select().eq("session_id", id).order("created_at"),
  ]);

  if (sessionError || !session) {
    return NextResponse.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
  }
  if (!session.image_url) {
    return NextResponse.json({ error: "원본 계약서를 찾을 수 없습니다." }, { status: 400 });
  }

  const rows: RevisedClause[] = (clauses ?? []).map((c) => ({
    category: c.category ?? null,
    original_text: c.original_text ?? c.clause_text ?? "",
    final_text: c.clause_text ?? "",
    changed: (c.original_text ?? c.clause_text) !== c.clause_text,
    risk_level: c.risk_level ?? "",
  }));

  try {
    const pdf = await generateRevisedPdf(session.image_url, rows);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="revised-contract-${id}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[revised-pdf] 생성 실패:", (err as Error).message);
    return NextResponse.json({ error: "수정본 계약서 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
