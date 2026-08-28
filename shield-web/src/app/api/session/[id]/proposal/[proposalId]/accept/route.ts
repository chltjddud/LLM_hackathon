import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type Change = { clause_id: string; old_text: string; new_text: string };

// 세입자/집주인이 제안(proposal)에 동의합니다. 양쪽 다 동의하면 제안에 담긴 모든 조항 변경을
// 한꺼번에 반영하고, 그 조항들은 "합의 완료" 처리합니다.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; proposalId: string }> }
) {
  const { id, proposalId } = await params;
  const { role } = await req.json();

  if (role !== "tenant" && role !== "landlord") {
    return NextResponse.json({ error: "role은 tenant 또는 landlord여야 합니다." }, { status: 400 });
  }

  const column = role === "tenant" ? "accepted_by_tenant" : "accepted_by_landlord";

  const { data: proposal, error } = await supabase
    .from("proposals")
    .update({ [column]: true })
    .eq("id", proposalId)
    .eq("session_id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (proposal.accepted_by_tenant && proposal.accepted_by_landlord && proposal.status === "pending") {
    const changes = proposal.changes as Change[];

    // 제안에 담긴 조항들을 한꺼번에 반영하고 합의 완료 처리
    await Promise.all(
      changes.map((c) =>
        supabase
          .from("clauses")
          .update({ clause_text: c.new_text, resolved_by_tenant: true, resolved_by_landlord: true })
          .eq("id", c.clause_id)
          .eq("session_id", id)
      )
    );

    await supabase.from("proposals").update({ status: "accepted" }).eq("id", proposalId);

    // 위험/주의 조항이 전부 합의됐는지 확인해서 서명 단계로 넘길지 판단
    const { data: allClauses } = await supabase
      .from("clauses")
      .select("risk_level, resolved_by_tenant, resolved_by_landlord")
      .eq("session_id", id);

    const needsResolution = (allClauses ?? []).filter((c) => c.risk_level !== "안전");
    const allResolved =
      needsResolution.length > 0 &&
      needsResolution.every((c) => c.resolved_by_tenant && c.resolved_by_landlord);

    if (allResolved) {
      await supabase.from("sessions").update({ status: "ready_to_sign" }).eq("id", id);
    }
  }

  return NextResponse.json({ proposal });
}
