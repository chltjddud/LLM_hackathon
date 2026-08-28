import { chromium } from "playwright";

const browser = await chromium.launch();

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.goto("http://localhost:3000");
await mobile.screenshot({ path: "scripts/screenshot-mobile.png" });
console.log("모바일(390x844) 스크린샷 저장됨");

const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await desktop.goto("http://localhost:3000");
await desktop.screenshot({ path: "scripts/screenshot-desktop.png" });
console.log("데스크탑(1440x900) 스크린샷 저장됨");

await browser.close();
