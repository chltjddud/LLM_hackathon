import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getUserFromRequest } from "@/lib/auth";

// 로그인한 사용자가 세입자 또는 집주인으로 연결된 모든 계약 세션 목록을 반환합니다.
export async function GET(req: NextRequest) {
  console.log("[API/my-sessions] GET started");
  const user = await getUserFromRequest(req);
  console.log("[API/my-sessions] getUserFromRequest finished, user:", !!user);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  console.log("[API/my-sessions] querying supabase sessions...");
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("id, status, filename, file_size, tenant_user_id, landlord_user_id, created_at")
    .or(`tenant_user_id.eq.${user.id},landlord_user_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  console.log("[API/my-sessions] supabase query finished, error:", error?.message);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sessions });
}
