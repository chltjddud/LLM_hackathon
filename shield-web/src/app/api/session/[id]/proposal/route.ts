import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { diffProposedDocument } from "@/lib/diffProposedDocument";

// 상대방이 수정된 계약서 PDF를 채팅으로 보내면, 현재 조항들과 비교해서
// 어떤 조항이 어떻게 바뀌었는지 찾아내고 "제안" 상태로 저장합니다.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { role, fileBase64, filename } = await req.json();

  if (role !== "tenant" && role !== "landlord") {
    return NextResponse.json({ error: "role은 tenant 또는 landlord여야 합니다." }, { status: 400 });
  }
  if (!fileBase64) {
    return NextResponse.json({ error: "fileBase64가 필요합니다." }, { status: 400 });
  }

  const { data: clauses, error: clauseError } = await supabase
    .from("clauses")
    .select("id, clause_text")
    .eq("session_id", id);

  if (clauseError) {
    return NextResponse.json({ error: clauseError.message }, { status: 500 });
  }

  let changes;
  try {
    changes = await diffProposedDocument(clauses ?? [], fileBase64);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .insert({ session_id: id, proposed_by: role, filename, changes })
    .select()
    .single();

  if (proposalError) {
    return NextResponse.json({ error: proposalError.message }, { status: 500 });
  }

  // 채팅에 "수정안 보냄" 메시지 남기기 (프론트에서 proposal_id로 특수 카드 렌더링)
  await supabase.from("messages").insert({
    session_id: id,
    sender_role: role,
    text: `[수정안 제안] ${filename || "수정된 계약서.pdf"} — ${changes.length}개 조항 변경`,
    proposal_id: proposal.id,
  });

  return NextResponse.json({ proposal });
}
