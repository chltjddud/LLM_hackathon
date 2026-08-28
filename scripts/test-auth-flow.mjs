import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}

const base = process.argv[2] || "http://localhost:3000";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const email = `hackathon.test.${Date.now()}@gmail.com`;
const password = "test-password-1234";

console.log("1) 회원가입...");
const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
if (signUpError) {
  console.error("회원가입 실패:", signUpError.message);
  process.exit(1);
}
console.log("   user id:", signUpData.user?.id, "| session 발급됨:", !!signUpData.session);

let token = signUpData.session?.access_token;
if (!token) {
  console.log("1-1) 이메일 확인이 필요한 설정인 듯 — 로그인 시도...");
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    console.error("로그인도 실패 (이메일 확인 필요 설정일 수 있음):", signInError.message);
    process.exit(1);
  }
  token = signInData.session?.access_token;
}
console.log("   토큰 확보됨:", !!token);

console.log("2) 로그인 상태로 세션 생성...");
const imageBase64 = readFileSync("sample/샘플B_임대차계약서_함정.png").toString("base64");
const createRes = await fetch(`${base}/api/session`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
  body: JSON.stringify({ imageBase64, mediaType: "image/png" }),
});
const created = await createRes.json();
console.log("   status:", createRes.status, "| tenant_user_id 연결됨:", !!created.session?.tenant_user_id);
const sessionId = created.session.id;

console.log("3) 비동기 분석 대기...");
let state;
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 1500));
  state = await (await fetch(`${base}/api/session/${sessionId}`)).json();
  if (state.clauses.length > 0) break;
}
console.log("   조항 수:", state.clauses.length, "| original_text 있음:", !!state.clauses[0]?.original_text);

console.log("4) /api/my-sessions 확인...");
const mine = await (await fetch(`${base}/api/my-sessions`, { headers: { authorization: `Bearer ${token}` } })).json();
console.log("   내 세션 수:", mine.sessions?.length, "| 방금 만든 게 포함됨:", mine.sessions?.some((s) => s.id === sessionId));

console.log("5) 비로그인으로 /api/my-sessions 호출 (401 나와야 정상)...");
const noAuth = await fetch(`${base}/api/my-sessions`);
console.log("   status:", noAuth.status);

console.log("6) 집주인 role join (같은 유저로 테스트)...");
const joinRes = await fetch(`${base}/api/session/${sessionId}/join`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
  body: JSON.stringify({ role: "landlord" }),
});
const joined = await joinRes.json();
console.log("   status:", joinRes.status, "| landlord_user_id 연결됨:", !!joined.session?.landlord_user_id);

console.log("7) 조항 하나 수정 (원문 vs 최종본 비교용)...");
const riskyClause = state.clauses.find((c) => c.risk_level === "위험");
await fetch(`${base}/api/session/${sessionId}/clause/${riskyClause.id}/resolve`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ role: "landlord", updated_text: "[수정됨] " + riskyClause.clause_text }),
});

console.log("8) /api/session/[id]/document 확인...");
const doc = await (await fetch(`${base}/api/session/${sessionId}/document`)).json();
const changed = doc.document.find((d) => d.id === riskyClause.id);
console.log("   changed:", changed.changed);
console.log("   original:", changed.original_text.slice(0, 40));
console.log("   final:", changed.final_text.slice(0, 40));
