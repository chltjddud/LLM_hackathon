import { readFileSync, writeFileSync } from "fs";

const filePath = process.argv[2];
const imageBase64 = readFileSync(filePath).toString("base64");

const res = await fetch("http://localhost:3000/api/analyze", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ imageBase64, mediaType: "image/png" }),
});

const json = await res.json();
console.log("status:", res.status);
console.log(JSON.stringify(json, null, 2));
writeFileSync("scripts/last-result.json", JSON.stringify(json, null, 2));
