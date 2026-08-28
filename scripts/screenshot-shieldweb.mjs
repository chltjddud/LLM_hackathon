import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const pages = [
  { url: "http://localhost:3001/", name: "home" },
  { url: "http://localhost:3001/upload", name: "upload" },
];

for (const p of pages) {
  await page.goto(p.url, { waitUntil: "networkidle" }).catch(() => {});
  await page.screenshot({ path: `scripts/shieldweb-${p.name}.png` });
  console.log(`${p.name} 스크린샷 저장됨`);
}

await browser.close();
