import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// 조항에 대해 세입자/집주인이 "이제 안전하다"고 동의하거나, 집주인이 조항 텍스트를 수정합니다.
// 텍스트가 수정되면 기존 동의는 초기화됩니다(재합의 필요).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; clauseId: string }> }
) {
  const { id, clauseId } = await params;
  const { role, resolved, updated_text } = await req.json();

  if (role !== "tenant" && role !== "landlord") {
    return NextResponse.json({ error: "role은 tenant 또는 landlord여야 합니다." }, { status: 400 });
  }

  const updatePayload: Record<string, unknown> = {};

  if (typeof updated_text === "string" && updated_text.trim()) {
    updatePayload.clause_text = updated_text;
    updatePayload.resolved_by_tenant = false;
    updatePayload.resolved_by_landlord = false;
  } else {
    updatePayload[role === "tenant" ? "resolved_by_tenant" : "resolved_by_landlord"] = Boolean(resolved);
  }

  const { data: clause, error: clauseError } = await supabase
    .from("clauses")
    .update(updatePayload)
    .eq("id", clauseId)
    .eq("session_id", id)
    .select()
    .single();

  if (clauseError) {
    return NextResponse.json({ error: clauseError.message }, { status: 500 });
  }

  // 위험/주의 조항이 전부 양쪽 동의됐는지 확인해서 세션 상태를 갱신합니다.
  const { data: allClauses, error: listError } = await supabase
    .from("clauses")
    .select("risk_level, resolved_by_tenant, resolved_by_landlord")
    .eq("session_id", id);

  if (!listError && allClauses) {
    const needsResolution = allClauses.filter((c) => c.risk_level !== "안전");
    const allResolved =
      needsResolution.length > 0 &&
      needsResolution.every((c) => c.resolved_by_tenant && c.resolved_by_landlord);

    if (allResolved) {
      await supabase.from("sessions").update({ status: "ready_to_sign" }).eq("id", id);
    }
  }

  return NextResponse.json({ clause });
}
