import { GoogleGenAI } from "@google/genai";

type CurrentClause = { id: string; clause_text: string };
export type ProposedChange = { clause_id: string; old_text: string; new_text: string };

const GEMINI_MODEL = "gemini-3.5-flash-lite";

const SYSTEM_PROMPT = `상대방이 계약서 수정본(PDF)을 보냈습니다.
아래 "현재 조항 목록"과 첨부된 수정본 PDF를 비교해서, 실제로 문구가 달라진 조항만 찾아주세요.
같은 내용을 다른 표현으로만 살짝 바꾼 것도 "달라짐"으로 판단하되, 완전히 동일한 조항은 포함하지 마세요.

반드시 아래 JSON 배열 형식으로만, 마크다운 코드블록 없이 응답하세요:
[
  { "clause_id": "현재 조항 목록에 있는 id 값 그대로", "new_text": "수정본 PDF에서 찾은 새 조항 텍스트" }
]
변경된 조항이 하나도 없으면 빈 배열 []을 반환하세요.`;

export async function diffProposedDocument(
  currentClauses: CurrentClause[],
  pdfBase64: string
): Promise<ProposedChange[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      { text: SYSTEM_PROMPT },
      { text: `현재 조항 목록:\n${JSON.stringify(currentClauses, null, 2)}` },
      { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
      { text: "위 PDF가 수정본입니다. 비교해서 위 형식의 JSON으로만 응답해주세요." },
    ],
    config: { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: "application/json" },
  });

  const rawText = response.text ?? "[]";
  const jsonMatch = rawText.match(/\[[\s\S]*\]/);

  let raw: { clause_id: string; new_text: string }[];
  try {
    raw = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
  } catch {
    throw new Error("수정안 비교 응답 파싱 실패: " + rawText.slice(0, 500));
  }

  const byId = new Map(currentClauses.map((c) => [c.id, c.clause_text]));
  return raw
    .filter((r) => byId.has(r.clause_id))
    .map((r) => ({
      clause_id: r.clause_id,
      old_text: byId.get(r.clause_id)!,
      new_text: r.new_text,
    }));
}
