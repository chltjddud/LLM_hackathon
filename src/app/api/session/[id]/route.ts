import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// 프론트에서 2~3초마다 폴링해서 세션 상태를 가져옵니다 (조항/채팅/서명 전부 포함).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [{ data: session, error: sessionError }, { data: clauses }, { data: messages }, { data: signatures }] =
    await Promise.all([
      supabase.from("sessions").select().eq("id", id).single(),
      supabase.from("clauses").select().eq("session_id", id).order("created_at"),
      supabase.from("messages").select().eq("session_id", id).order("created_at"),
      supabase.from("signatures").select().eq("session_id", id),
    ]);

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 404 });
  }

  return NextResponse.json({ session, clauses, messages, signatures });
}
