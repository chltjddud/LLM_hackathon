import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const email = `hackathon.ui.${Date.now()}@gmail.com`;
const password = "test-password-1234";

await page.goto("http://localhost:3001/login");
await page.screenshot({ path: "scripts/shieldweb-login.png" });
console.log("로그인 화면 스크린샷 저장됨");

await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password);

// 기본은 로그인 모드라 회원가입으로 전환
await page.getByText("회원가입", { exact: false }).last().click();
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password);
await page.getByRole("button", { name: "회원가입" }).click();

await page.waitForURL("http://localhost:3001/", { timeout: 15000 });
console.log("회원가입 후 홈으로 이동됨:", page.url());

await page.waitForTimeout(2000); // my-sessions fetch 대기
await page.screenshot({ path: "scripts/shieldweb-home-loggedin.png" });
console.log("로그인된 홈 화면 스크린샷 저장됨");

const bodyText = await page.textContent("body");
console.log("로그아웃 버튼 있음:", bodyText.includes("로그아웃"));
console.log("이메일 인사말 포함됨:", bodyText.includes(email.split("@")[0]));

await browser.close();
