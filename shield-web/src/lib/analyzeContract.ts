import Anthropic from "@anthropic-ai/sdk";
import path from "path";
import fs from "fs";

// Suppress annoying pdf.js font warnings globally
if (typeof console !== "undefined") {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (
      args[0] &&
      typeof args[0] === "string" &&
      args[0].includes("Ran out of space in font private use area")
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };
}

// pdf-parse v1 — import from internal path to avoid the test-PDF auto-load bug
// (the package root tries to open test/data/05-versions-space.pdf on import)
// @ts-ignore
import pdfParse from "pdf-parse/lib/pdf-parse.js";

// Load risk criteria from the data folder relative to the project root (shield-web/)
const riskCriteria = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "data", "risk-criteria.json"), "utf-8")
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CATEGORY_IDS = riskCriteria.map((c: any) => c.id).join(", ");

const SYSTEM_PROMPT = `당신은 자취/알바 계약서의 위험 조항을 찾아주는 도우미입니다.
제공된 계약서(텍스트 또는 사진)에서 개별 조항을 추출하고, 아래 카테고리 중 "실제로 위반하거나 실질적으로 불리한" 조항에만 category_id를 매칭하세요.

중요: 조항이 카테고리와 같은 주제를 다룬다는 이유만으로 매칭하지 마세요. 반드시 그 조항의 구체적인 수치·조건을 확인해서 실제로 법 기준을 위반하거나 근로자/임차인에게 불리한 경우에만 매칭합니다.
예: "시급 11,000원"은 최저임금(2026년 기준 시간당 10,320원)보다 높으므로 below_minimum_wage에 매칭하지 않고 category_id를 null, risk_level을 "안전"으로 둡니다. "시급 9,500원"은 최저임금 미만이므로 매칭합니다.
조항 자체가 근로자/임차인에게 유리하거나 법정 기준을 준수한다고 명시하는 경우(예: "주휴수당을 별도 지급한다")도 category_id를 null, risk_level "안전"으로 둡니다.

매칭되는 카테고리가 없으면 category_id를 null로 두고 risk_level을 "안전"으로 표시하세요.

참고 기준값: 2026년 최저임금은 시간당 10,320원입니다.

사용 가능한 카테고리 id: ${CATEGORY_IDS}

각 조항에 대해 다음을 포함한 JSON 배열만 출력하세요.
마크다운 코드블록(\`\`\`) 없이, 설명 텍스트 없이, 순수 JSON 배열 텍스트로만 응답하세요:
[
  {
    "clause_text": "계약서에서 추출한 원문 조항",
    "category_id": "위 카테고리 id 중 하나 또는 null",
    "simulation": "이 조항대로 계약이 진행됐을 때 실제로 벌어질 수 있는 상황 1~2문장",
    "message_draft": "집주인/사장님에게 이 조항 수정을 요청하는 정중한 메시지 초안 (해당 조항이 안전이면 생략 가능)"
  }
]`;

export type AnalyzedClause = {
  clause_text: string;
  category_id: string | null;
  simulation?: string;
  message_draft?: string;
  risk_level: string;
  category: string | null;
  law_basis: string | null;
  explanation: string | null;
};

async function generateWithGemini(
  parts: any[],
  systemInstruction?: string,
  jsonMode: boolean = false
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;

  const body: any = {
    contents: [
      {
        parts: parts
      }
    ]
  };

  if (systemInstruction) {
    body.systemInstruction = {
      parts: [
        {
          text: systemInstruction
        }
      ]
    };
  }

  if (jsonMode) {
    body.generationConfig = {
      responseMimeType: "application/json",
      temperature: 0.1
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Empty response from Gemini API");
  }
  return text;
}

export async function analyzeContractImage(
  imageBase64: string,
  mediaType: string
): Promise<AnalyzedClause[]> {
  let rawText = "";

  if (process.env.GEMINI_API_KEY) {
    let parts: any[] = [];
    if (mediaType === "application/pdf") {
      // Decode base64 to buffer and extract text using pdf-parse v1
      const buffer = Buffer.from(imageBase64, "base64");
      const pdfData = await pdfParse(buffer);
      const textContent = pdfData.text || "";

      parts = [
        {
          text: `다음은 분석할 계약서의 텍스트 본문입니다:\n\n${textContent}\n\n이 계약서 본문을 분석해서 위 형식의 JSON으로만 응답해주세요.`
        }
      ];
    } else {
      parts = [
        {
          inlineData: {
            mimeType: mediaType || "image/jpeg",
            data: imageBase64
          }
        },
        {
          text: "이 계약서 사진을 분석해서 위 형식의 JSON으로만 응답해주세요."
        }
      ];
    }

    try {
      rawText = await generateWithGemini(parts, SYSTEM_PROMPT, true);
    } catch (err: any) {
      console.error("Gemini API call failed, falling back to Anthropic:", err.message);
      // fallback will trigger below
    }
  }

  if (!rawText) {
    let contentPayload: any[];
    if (mediaType === "application/pdf") {
      // Decode base64 to buffer and extract text using pdf-parse v1
      const buffer = Buffer.from(imageBase64, "base64");
      const pdfData = await pdfParse(buffer);
      const textContent = pdfData.text || "";

      contentPayload = [
        {
          type: "text",
          text: `다음은 분석할 계약서의 텍스트 본문입니다:\n\n${textContent}\n\n이 계약서 본문을 분석해서 위 형식의 JSON으로만 응답해주세요.`,
        },
      ];
    } else {
      contentPayload = [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: (mediaType || "image/jpeg") as
              | "image/jpeg"
              | "image/png"
              | "image/gif"
              | "image/webp",
            data: imageBase64,
          },
        },
        {
          type: "text",
          text: "이 계약서 사진을 분석해서 위 형식의 JSON으로만 응답해주세요.",
        },
      ];
    }

    const message = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: contentPayload,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    rawText = textBlock?.type === "text" ? textBlock.text : "[]";
  }

  type RawClause = {
    clause_text: string;
    category_id: string | null;
    simulation?: string;
    message_draft?: string;
  };

  // Robust JSON parsing: try raw, then regex extract array, then strip markdown fences
  let clauses: RawClause[];
  try {
    // Try direct parse first (Gemini JSON mode returns clean JSON)
    const trimmed = rawText.trim();
    if (trimmed.startsWith("[")) {
      clauses = JSON.parse(trimmed);
    } else {
      // Strip markdown code fences if present
      const stripped = trimmed
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();
      const jsonMatch = stripped.match(/\[[\s\S]*\]/);
      clauses = JSON.parse(jsonMatch ? jsonMatch[0] : stripped);
    }
  } catch {
    throw new Error("모델 응답 파싱 실패: " + rawText.slice(0, 500));
  }

  const validClauses = clauses.filter((c: any) => {
    if (c.category_id && !CATEGORY_IDS.includes(c.category_id)) {
      c.category_id = null;
    }
    return c.clause_text;
  });

  return validClauses.map((clause: any) => {
    const criterion = riskCriteria.find((c: any) => c.id === clause.category_id);
    return {
      ...clause,
      risk_level: criterion?.risk_level ?? "안전",
      category: criterion?.category ?? null,
      law_basis: criterion?.law_basis ?? null,
      explanation: criterion?.explanation ?? null,
    };
  });
}

