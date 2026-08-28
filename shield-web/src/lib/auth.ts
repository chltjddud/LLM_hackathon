import { NextRequest } from "next/server";
import crypto from "crypto";

// JWT 토큰을 Supabase JWT Secret으로 로컬에서 직접 검증합니다.
// 네트워크 호출이 없으므로 타임아웃 문제가 발생하지 않습니다.
function verifySupabaseJWT(token: string): { sub: string; email?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) {
      console.error("[verifyJWT] SUPABASE_JWT_SECRET is not set!");
      return null;
    }

    // Base64로 인코딩된 시크릿을 버퍼로 변환
    const secretBuffer = Buffer.from(secret, "base64");

    // HMAC-SHA256으로 서명 검증
    const data = `${headerB64}.${payloadB64}`;
    const expectedSig = crypto
      .createHmac("sha256", secretBuffer)
      .update(data)
      .digest("base64url");

    if (expectedSig !== signatureB64) {
      console.log("[verifyJWT] Signature mismatch");
      return null;
    }

    // 페이로드 디코딩
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));

    // 만료 시간 확인
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      console.log("[verifyJWT] Token expired");
      return null;
    }

    if (!payload.sub) return null;

    return { sub: payload.sub, email: payload.email };
  } catch (err) {
    console.error("[verifyJWT] Error verifying token:", err);
    return null;
  }
}

// 프론트에서 Supabase Auth로 로그인 후 발급받은 access token을
// "Authorization: Bearer <token>" 헤더로 보내면 그 사용자를 식별한다.
// 네트워크 호출 없이 로컬에서 JWT를 검증하므로 타임아웃 문제가 없다.
export async function getUserFromRequest(
  req: NextRequest
): Promise<{ id: string; email: string | undefined } | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length);
  const payload = verifySupabaseJWT(token);

  if (!payload) return null;

  return { id: payload.sub, email: payload.email };
}
