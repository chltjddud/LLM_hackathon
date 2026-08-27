import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// 세입자/집주인이 채팅 메시지를 보냅니다. clause_id를 붙이면 특정 조항에 대한 메시지로 표시됩니다.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { sender_role, text, clause_id } = await req.json();

  if (!sender_role || !text) {
    return NextResponse.json({ error: "sender_role, text가 필요합니다." }, { status: 400 });
  }
  if (sender_role !== "tenant" && sender_role !== "landlord") {
    return NextResponse.json({ error: "sender_role은 tenant 또는 landlord여야 합니다." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({ session_id: id, sender_role, text, clause_id: clause_id ?? null })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: data });
}
