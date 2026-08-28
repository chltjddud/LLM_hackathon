import { NextRequest } from "next/server";
import { supabase } from "./supabase";

// 프론트에서 Supabase Auth로 로그인 후 발급받은 access token을
// "Authorization: Bearer <token>" 헤더로 보내면 그 사용자를 식별한다.
// 헤더가 없거나 토큰이 유효하지 않으면 null(비로그인/게스트로 취급).
export async function getUserFromRequest(
  req: NextRequest
): Promise<{ id: string; email: string | undefined } | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return { id: data.user.id, email: data.user.email };
}
