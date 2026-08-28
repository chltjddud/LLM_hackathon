import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// 협상을 거쳐 최종적으로 어떻게 바뀌었는지 보여주는 "최종 계약서" 뷰.
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
