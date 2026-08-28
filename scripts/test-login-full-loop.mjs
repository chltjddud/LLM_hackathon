import { chromium } from "playwright";
import { readFileSync } from "fs";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const email = `hackathon.full.${Date.now()}@gmail.com`;
const password = "test-password-1234";

await page.goto("http://localhost:3001/login");
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password);
await page.getByText("회원가입", { exact: false }).last().click();
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password);
await page.getByRole("button", { name: "회원가입" }).click();
await page.waitForURL("http://localhost:3001/", { timeout: 15000 });
console.log("1) 로그인 완료");

// 로그인 상태로 세션 생성 (브라우저 안에서 supabase 토큰 꺼내서 API 직접 호출)
const imageBase64 = readFileSync("sample/샘플A_근로계약서_함정.png").toString("base64");
const result = await page.evaluate(async (imageBase64) => {
  const raw = localStorage.getItem(
    Object.keys(localStorage).find((k) => k.includes("auth-token"))
  );
  const token = JSON.parse(raw).access_token;
  const res = await fetch("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ imageBase64, mediaType: "image/png" }),
  });
  return res.json();
}, imageBase64);
console.log("2) 세션 생성됨:", result.session.id);

await page.waitForTimeout(8000); // 백그라운드 분석 대기

await page.goto("http://localhost:3001/");
await page.waitForTimeout(1500);
const bodyText = await page.textContent("body");
console.log("3) 홈 화면에 '진행 중 계약 1건' 표시됨:", bodyText.includes("진행 중 계약") && bodyText.includes("1건"));
await page.screenshot({ path: "scripts/shieldweb-home-with-contract.png" });

await browser.close();
