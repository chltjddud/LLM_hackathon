import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// 세입자/집주인이 서명 이미지(base64 PNG)를 제출합니다. 양쪽 다 서명되면 세션을 완료 처리합니다.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { role, signature_image } = await req.json();

  if (role !== "tenant" && role !== "landlord") {
    return NextResponse.json({ error: "role은 tenant 또는 landlord여야 합니다." }, { status: 400 });
  }
  if (!signature_image) {
    return NextResponse.json({ error: "signature_image가 필요합니다." }, { status: 400 });
  }

  const { data: signature, error } = await supabase
    .from("signatures")
    .upsert(
      { session_id: id, role, signature_image, signed_at: new Date().toISOString() },
      { onConflict: "session_id,role" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: allSignatures } = await supabase
    .from("signatures")
    .select("role")
    .eq("session_id", id);

  const roles = new Set(allSignatures?.map((s) => s.role));
  if (roles.has("tenant") && roles.has("landlord")) {
    await supabase.from("sessions").update({ status: "completed" }).eq("id", id);
  }

  return NextResponse.json({ signature });
}
