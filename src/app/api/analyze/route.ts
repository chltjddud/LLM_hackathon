import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import riskCriteria from "../../../../data/risk-criteria.json";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CATEGORY_IDS = riskCriteria.map((c) => c.id).join(", ");

const SYSTEM_PROMPT = `당신은 자취/알바 계약서의 위험 조항을 찾아주는 도우미입니다.
사진 속 계약서에서 개별 조항을 추출하고, 아래 카테고리 중 "실제로 위반하거나 실질적으로 불리한" 조항에만 category_id를 매칭하세요.

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

export async function POST(req: NextRequest) {
  const { imageBase64, mediaType } = await req.json();

  if (!imageBase64) {
    return NextResponse.json({ error: "imageBase64가 필요합니다." }, { status: 400 });
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType || "image/jpeg",
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: "이 계약서 사진을 분석해서 위 형식의 JSON으로만 응답해주세요.",
          },
        ],
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  let clauses: Array<{
    clause_text: string;
    category_id: string | null;
    simulation?: string;
    message_draft?: string;
  }> = [];

  const rawText = textBlock?.type === "text" ? textBlock.text : "[]";
  const jsonMatch = rawText.match(/\[[\s\S]*\]/);

  try {
    clauses = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
  } catch {
    return NextResponse.json({ error: "모델 응답 파싱 실패", raw: textBlock }, { status: 502 });
  }

  const enriched = clauses.map((clause) => {
    const criterion = riskCriteria.find((c) => c.id === clause.category_id);
    return {
      ...clause,
      risk_level: criterion?.risk_level ?? "안전",
      category: criterion?.category ?? null,
      law_basis: criterion?.law_basis ?? null,
      explanation: criterion?.explanation ?? null,
    };
  });

  return NextResponse.json({ clauses: enriched });
}
