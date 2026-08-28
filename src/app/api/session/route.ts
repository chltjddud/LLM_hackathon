import { NextRequest, NextResponse } from "next/server";
import { analyzeContractImage } from "@/lib/analyzeContract";
import { supabase } from "@/lib/supabase";
import { getUserFromRequest } from "@/lib/auth";

// 세입자가 사진을 올려서 새 협상 세션을 만듭니다. 로그인 상태면 세션이 계정에 연결됩니다.
export async function POST(req: NextRequest) {
  const { imageBase64, mediaType } = await req.json();

  if (!imageBase64) {
    return NextResponse.json({ error: "imageBase64가 필요합니다." }, { status: 400 });
  }

  const user = await getUserFromRequest(req);

  let clauses;
  try {
    clauses = await analyzeContractImage(imageBase64, mediaType);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({ status: "negotiating", tenant_user_id: user?.id ?? null })
    .select()
    .single();

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

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

  const { data: savedClauses, error: clauseError } = await supabase
    .from("clauses")
    .insert(rows)
    .select();

  if (clauseError) {
    return NextResponse.json({ error: clauseError.message }, { status: 500 });
  }

  return NextResponse.json({ session, clauses: savedClauses });
}
