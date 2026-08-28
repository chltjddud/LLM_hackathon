import { readFileSync } from "fs";

const base = process.argv[2];
const imageBase64 = readFileSync("sample/샘플C_근로계약서_정상_대조군.png").toString("base64");

const start = Date.now();
const res = await fetch(`${base}/api/session`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ imageBase64, mediaType: "image/png" }),
});
const elapsed = Date.now() - start;
const json = await res.json();
console.log("status:", res.status, "elapsed:", elapsed, "ms");
console.log("clauses length:", json.clauses?.length);
console.log("session:", json.session);
console.log("full body:", JSON.stringify(json).slice(0, 1000));
