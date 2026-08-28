import { readFileSync } from "fs";

const base = process.argv[3] || "http://localhost:3000";
const imageBase64 = readFileSync("sample/샘플B_임대차계약서_함정.png").toString("base64");

console.log("1) 세션 생성 (사진 업로드)...");
const createRes = await fetch(`${base}/api/session`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ imageBase64, mediaType: "image/png" }),
});
const created = await createRes.json();
if (!createRes.ok) {
  console.error("세션 생성 실패:", created);
  process.exit(1);
}
const sessionId = created.session.id;
console.log("   session id:", sessionId, "status:", created.session.status);

console.log("1-1) 비동기 분석 완료될 때까지 폴링...");
let state;
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  state = await (await fetch(`${base}/api/session/${sessionId}`)).json();
  console.log(`   [${i}] status: ${state.session.status}, clauses: ${state.clauses.length}`);
  if (state.clauses.length > 0) break;
}
const riskyClause = state.clauses.find((c) => c.risk_level === "위험");
if (!riskyClause) {
  console.error("위험조항을 못 찾음, 분석이 끝나지 않았을 수 있음");
  process.exit(1);
}
console.log("   위험조항 예시:", riskyClause.clause_text.slice(0, 40));

console.log("2) 세입자가 위험조항에 대해 채팅...");
await fetch(`${base}/api/session/${sessionId}/message`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ sender_role: "tenant", text: "이 조항 위험하다는데 고쳐주세요", clause_id: riskyClause.id }),
});

console.log("3) 집주인이 답장...");
await fetch(`${base}/api/session/${sessionId}/message`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ sender_role: "landlord", text: "네 수정하겠습니다", clause_id: riskyClause.id }),
});

console.log("4) GET session 으로 상태 확인...");
state = await (await fetch(`${base}/api/session/${sessionId}`)).json();
console.log("   session status:", state.session.status);
console.log("   messages count:", state.messages.length);

console.log("5) 위험/주의 조항 전부 양쪽 합의 처리...");
const needsResolution = state.clauses.filter((c) => c.risk_level !== "안전");
for (const c of needsResolution) {
  await fetch(`${base}/api/session/${sessionId}/clause/${c.id}/resolve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role: "tenant", resolved: true }),
  });
  await fetch(`${base}/api/session/${sessionId}/clause/${c.id}/resolve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role: "landlord", resolved: true }),
  });
}

const afterResolve = await (await fetch(`${base}/api/session/${sessionId}`)).json();
console.log("   합의 후 session status:", afterResolve.session.status, "(ready_to_sign 이어야 정상)");

console.log("6) 양쪽 서명...");
const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
await fetch(`${base}/api/session/${sessionId}/sign`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ role: "tenant", signature_image: tinyPng }),
});
await fetch(`${base}/api/session/${sessionId}/sign`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ role: "landlord", signature_image: tinyPng }),
});

const final = await (await fetch(`${base}/api/session/${sessionId}`)).json();
console.log("7) 최종 session status:", final.session.status, "(completed 이어야 정상)");
console.log("   signatures:", final.signatures.length);
