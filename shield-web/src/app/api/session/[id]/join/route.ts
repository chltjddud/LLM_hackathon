import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getUserFromRequest } from "@/lib/auth";

// 로그인한 사용자가 "집주인" 또는 "세입자"로 이 세션에 들어왔을 때, 본인 계정을 세션에 연결합니다.
// (세입자는 세션 생성 시점에 이미 연결되므로, 주로 집주인이 초대 링크를 열 때 씀)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { role } = await req.json();

  if (role !== "tenant" && role !== "landlord") {
    return NextResponse.json({ error: "role은 tenant 또는 landlord여야 합니다." }, { status: 400 });
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const column = role === "tenant" ? "tenant_user_id" : "landlord_user_id";

  const { data: session, error } = await supabase
    .from("sessions")
    .update({ [column]: user.id })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ session });
}
