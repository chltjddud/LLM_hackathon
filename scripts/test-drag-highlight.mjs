import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("http://localhost:3000");

const dropzone = page.getByTestId("dropzone");
const classBefore = await dropzone.getAttribute("class");
console.log("드래그 전 파란색 하이라이트 있음:", classBefore.includes("border-blue-500"));

await dropzone.dispatchEvent("dragover", { dataTransfer: await page.evaluateHandle(() => new DataTransfer()) });
const classDuring = await dropzone.getAttribute("class");
console.log("dragover 중 파란색 하이라이트 있음:", classDuring.includes("border-blue-500"));

await dropzone.dispatchEvent("dragleave");
const classAfter = await dropzone.getAttribute("class");
console.log("dragleave 후 파란색 하이라이트 있음:", classAfter.includes("border-blue-500"));

await browser.close();
