import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getUserFromRequest } from "@/lib/auth";

// 로그인한 사용자가 세입자 또는 집주인으로 연결된 모든 계약 세션 목록을 반환합니다.
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { data: sessions, error } = await supabase
    .from("sessions")
    .select()
    .or(`tenant_user_id.eq.${user.id},landlord_user_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sessions });
}
