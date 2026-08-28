import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// 협상을 거쳐 최종적으로 어떻게 바뀌었는지 보여주는 "최종 계약서" 뷰.
// 각 조항의 원문(original_text)과 현재 합의된 문구(clause_text)를 같이 반환해서
// 프론트에서 변경된 조항만 하이라이트(before/after)로 보여줄 수 있게 합니다.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: clauses, error } = await supabase
    .from("clauses")
    .select()
    .eq("session_id", id)
    .order("created_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const document = clauses.map((c) => ({
    id: c.id,
    original_text: c.original_text ?? c.clause_text,
    final_text: c.clause_text,
    changed: (c.original_text ?? c.clause_text) !== c.clause_text,
    risk_level: c.risk_level,
    category: c.category,
  }));

  const full_text = document.map((d) => d.final_text).join("\n\n");

  return NextResponse.json({ document, full_text });
}
