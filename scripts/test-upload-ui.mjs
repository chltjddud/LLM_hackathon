import { chromium } from "playwright";
import path from "path";

const browser = await chromium.launch();
const page = await browser.newPage();

const logs = [];
page.on("console", (msg) => logs.push(`[console] ${msg.text()}`));
page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}`));

await page.goto("http://localhost:3000");
console.log("페이지 로드됨, 제목:", await page.title());

const dropzoneVisible = await page.getByTestId("dropzone").isVisible();
console.log("드롭존 보임:", dropzoneVisible);

const imagePath = path.resolve("sample/샘플C_근로계약서_정상_대조군.png");
await page.setInputFiles('[data-testid="file-input"]', imagePath);
console.log("파일 선택함 (drop과 동일한 handleFile 경로 실행)");

await page.waitForSelector('[data-testid="loading"]', { timeout: 5000 });
console.log("로딩 상태 표시 확인됨");

await page.waitForSelector('[data-testid="results"], [data-testid="error"]', { timeout: 60000 });

const hasError = await page.getByTestId("error").isVisible().catch(() => false);
if (hasError) {
  console.error("에러 발생:", await page.getByTestId("error").textContent());
} else {
  const resultsText = await page.getByTestId("results").textContent();
  console.log("결과 렌더링됨, 길이:", resultsText.length);
  console.log("결과 일부:", resultsText.slice(0, 200));
}

console.log("--- 콘솔/에러 로그 ---");
logs.forEach((l) => console.log(l));

await browser.close();
