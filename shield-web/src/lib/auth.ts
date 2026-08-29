import { NextRequest } from "next/server";
import crypto from "crypto";

type JwtPayload = { sub: string; email?: string; exp?: number };

// ---- JWKS 캐시 (Supabase의 ES256 공개키) ----
type Jwk = { kid: string; kty: string; crv?: string; x?: string; y?: string; alg?: string };
let jwksCache: { keys: Jwk[]; fetchedAt: number } | null = null;
const JWKS_TTL_MS = 10 * 60 * 1000; // 10분 캐시

async function getJwks(): Promise<Jwk[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  const base = process.env.SUPABASE_URL;
  if (!base) return [];
  try {
    const res = await fetch(`${base}/auth/v1/.well-known/jwks.json`, {
      headers: process.env.SUPABASE_ANON_KEY ? { apikey: process.env.SUPABASE_ANON_KEY } : {},
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return jwksCache?.keys ?? [];
    const json = (await res.json()) as { keys?: Jwk[] };
    jwksCache = { keys: json.keys ?? [], fetchedAt: Date.now() };
    return jwksCache.keys;
  } catch {
    return jwksCache?.keys ?? [];
  }
}

function b64urlToBuf(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

// JWS ES256 서명(R||S, 64바이트)을 DER로 변환해서 crypto.verify에 넘긴다
function joseToDer(sig: Buffer): Buffer {
  const r = sig.subarray(0, 32);
  const s = sig.subarray(32, 64);
  const trim = (b: Buffer) => {
    let i = 0;
    while (i < b.length - 1 && b[i] === 0) i++;
    let out = b.subarray(i);
    if (out[0] & 0x80) out = Buffer.concat([Buffer.from([0]), out]);
    return out;
  };
  const rt = trim(r);
  const st = trim(s);
  const seqLen = 2 + rt.length + 2 + st.length;
  return Buffer.concat([
    Buffer.from([0x30, seqLen]),
    Buffer.from([0x02, rt.length]),
    rt,
    Buffer.from([0x02, st.length]),
    st,
  ]);
}

async function verifyEs256(
  headerB64: string,
  payloadB64: string,
  signatureB64: string,
  kid: string
): Promise<boolean> {
  const keys = await getJwks();
  const jwk = keys.find((k) => k.kid === kid) ?? keys.find((k) => k.kty === "EC");
  if (!jwk || jwk.kty !== "EC" || !jwk.x || !jwk.y) return false;
  try {
    const keyObject = crypto.createPublicKey({
      key: { kty: "EC", crv: jwk.crv || "P-256", x: jwk.x, y: jwk.y },
      format: "jwk",
    });
    const der = joseToDer(b64urlToBuf(signatureB64));
    return crypto.verify(
      "sha256",
      Buffer.from(`${headerB64}.${payloadB64}`),
      { key: keyObject, dsaEncoding: "der" },
      der
    );
  } catch {
    return false;
  }
}

function verifyHs256(headerB64: string, payloadB64: string, signatureB64: string): boolean {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) return false;
  const data = `${headerB64}.${payloadB64}`;
  // Supabase JWT secret은 보통 원문 문자열 그대로 HMAC 키로 쓰인다
  const raw = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  if (raw === signatureB64) return true;
  // 혹시 base64 인코딩된 시크릿인 경우도 시도
  try {
    const b64 = crypto
      .createHmac("sha256", Buffer.from(secret, "base64"))
      .update(data)
      .digest("base64url");
    return b64 === signatureB64;
  } catch {
    return false;
  }
}

async function verifySupabaseJWT(token: string): Promise<JwtPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg?: string; kid?: string };
  let payload: JwtPayload;
  try {
    header = JSON.parse(b64urlToBuf(headerB64).toString("utf-8"));
    payload = JSON.parse(b64urlToBuf(payloadB64).toString("utf-8"));
  } catch {
    return null;
  }

  // 만료 확인
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (!payload.sub) return null;

  let ok = false;
  if (header.alg === "ES256") {
    ok = await verifyEs256(headerB64, payloadB64, signatureB64, header.kid || "");
  } else if (header.alg === "HS256") {
    ok = verifyHs256(headerB64, payloadB64, signatureB64);
  } else {
    // 알 수 없는 alg: ES256 -> HS256 순으로 시도
    ok =
      (await verifyEs256(headerB64, payloadB64, signatureB64, header.kid || "")) ||
      verifyHs256(headerB64, payloadB64, signatureB64);
  }

  if (!ok) return null;
  return { sub: payload.sub, email: payload.email };
}

// 프론트에서 Supabase Auth로 로그인 후 발급받은 access token을
// "Authorization: Bearer <token>" 헤더로 보내면 그 사용자를 식별한다.
export async function getUserFromRequest(
  req: NextRequest
): Promise<{ id: string; email: string | undefined } | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length);
  const payload = await verifySupabaseJWT(token);
  if (!payload) return null;

  return { id: payload.sub, email: payload.email };
}
