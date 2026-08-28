import { readFileSync, writeFileSync } from "fs";

const SCRATCH =
  "C:/Users/seeon/AppData/Local/Temp/claude/C--Users-seeon-Desktop-hackathon/6aa4dcf8-3414-4539-9af2-c5a18c4fceeb/scratchpad";

function loadLaw(file) {
  const d = JSON.parse(readFileSync(`${SCRATCH}/${file}`, "utf8"));
  const law = d["법령"];
  const info = law["기본정보"];
  const units = law["조문"]["조문단위"];
  return { info, units };
}

function extractArticle(units, jomunKeyPrefix) {
  const u = units.find((x) => x["조문키"].startsWith(jomunKeyPrefix));
  if (!u) return null;
  const title = u["조문내용"];
  const paragraphs = (u["항"] || []).map((p) => p["항내용"]).join("\n");
  const fullText = paragraphs ? `${title}\n${paragraphs}` : title;
  return {
    조문키: u["조문키"],
    조문제목: u["조문제목"],
    조문내용: fullText,
    시행일자: u["조문시행일자"],
  };
}

const housing = loadLaw("housing_law.json");
const civil = loadLaw("civil_law.json");
const labor = loadLaw("labor_law.json");
const minwage = loadLaw("minwage_law.json");

function lawMeta(loaded) {
  return {
    법령명: loaded.info["법령명_한글"] || loaded.info["법령명한글"],
    시행일자: loaded.info["시행일자"],
    공포번호: loaded.info["공포번호"],
    소관부처: loaded.info["소관부처"] && loaded.info["소관부처"]["content"],
  };
}

const sources = {
  fetched_at: "2026-08-28",
  source: "국가법령정보센터 공동활용 API (law.go.kr/DRF)",
  laws: {
    주택임대차보호법: {
      meta: lawMeta(housing),
      articles: {
        "제3조": extractArticle(housing.units, "0003001"),
        "제3조의2": extractArticle(housing.units, "0003021"),
        "제6조의3": extractArticle(housing.units, "0006031"),
      },
    },
    민법: {
      meta: lawMeta(civil),
      articles: {
        "제126조": extractArticle(civil.units, "0126001"),
        "제615조": extractArticle(civil.units, "0615001"),
        "제654조": extractArticle(civil.units, "0654001"),
      },
    },
    근로기준법: {
      meta: lawMeta(labor),
      articles: {
        "제20조": extractArticle(labor.units, "0020001"),
        "제55조": extractArticle(labor.units, "0055001"),
      },
    },
    최저임금법: {
      meta: lawMeta(minwage),
      articles: {
        "제6조": extractArticle(minwage.units, "0006001"),
      },
    },
  },
};

writeFileSync(
  "data/law-sources.json",
  JSON.stringify(sources, null, 2),
  "utf8"
);
console.log("생성 완료: data/law-sources.json");

// 빠진 조문 있는지 확인
for (const [lawName, lawData] of Object.entries(sources.laws)) {
  for (const [joNo, content] of Object.entries(lawData.articles)) {
    if (!content) console.error(`누락: ${lawName} ${joNo}`);
    else console.log(`OK: ${lawName} ${joNo} - ${content.조문제목}`);
  }
}
