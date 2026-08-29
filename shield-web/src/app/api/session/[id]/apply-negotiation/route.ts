import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateWithGemini(prompt: string, systemInstruction: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
  };
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Gemini API error: ${response.status} - ${await response.text()}`);
  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini API");
  return text;
}

// 협상 채팅 내용을 반영해서 각 조항의 최종 문구(clause_text)를 갱신합니다.
// 임대인이 "수정본 계약서" 공유 직전에 호출됩니다.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [{ data: clauses }, { data: messages }] = await Promise.all([
    supabase.from("clauses").select().eq("session_id", id).order("created_at"),
    supabase.from("messages").select("sender_role, text, created_at").eq("session_id", id).order("created_at"),
  ]);

  if (!clauses || clauses.length === 0) {
    return NextResponse.json({ error: "조항이 없습니다." }, { status: 400 });
  }

  // 마커성 시스템 메시지([[REVISED_PDF]] 등)는 제외하고 실제 대화만 사용
  const chat = (messages ?? [])
    .filter((m) => typeof m.text === "string" && !m.text.startsWith("[["))
    .map((m) => `${m.sender_role === "tenant" ? "임차인" : "임대인"}: ${m.text}`)
    .join("\n");

  if (!chat.trim()) {
    return NextResponse.json({ updated: 0, message: "협상 대화가 없어 수정할 내용이 없습니다." });
  }

  const clauseList = clauses
    .map((c) => `- id: ${c.id}\n  조항명: ${c.category || "(제목없음)"}\n  현재문구: ${c.clause_text}`)
    .join("\n");

  const prompt = `당신은 대한민국 부동산/노동 계약 전문 법률 AI입니다.
아래는 임차인과 임대인이 계약서 조항을 두고 나눈 협상 대화와, 현재 계약서 조항 목록입니다.
지금은 임대인이 협상 내용을 반영한 "수정본 계약서"를 만드는 단계입니다.
따라서 대화에서 임차인(또는 임대인)이 "요청·제안한 조정 사항"을 해당 조항에 최대한 반영하여 문구를 수정하세요.
- 임대인이 명시적으로 "거절/불가"라고 밝힌 요청은 반영하지 마세요. 그 외의 요청 사항은 수용된 것으로 간주하고 반영합니다.
- 요청 내용이 특정 조항과 관련되면 그 조항을 수정하세요. 어느 조항인지 애매하면 내용상 가장 관련 있는 조항에 반영하세요.
- 수정 시 계약서 문체(공식적인 조항 문장)로 다시 작성하세요.
- 요청과 무관한 조항은 그대로 두세요.
- 마커성 문구([[REVISED_PDF]] 등)나 형식적 인사말은 무시하고, 실제 조정 요청 내용만 반영하세요.

[협상 대화]
${chat}

[현재 조항 목록]
${clauseList}

반드시 아래 JSON 형식으로만 응답하세요. 마크다운 없이 순수 JSON만:
{
  "updates": [
    { "id": "수정할 조항의 id", "revised_text": "수정된 조항 문구", "reason": "무엇이 어떻게 바뀌었는지 한 줄 요약" }
  ]
}
반영할 요청이 전혀 없으면 "updates": [] 로 응답하세요.`;

  let rawText = "";
  if (process.env.GEMINI_API_KEY) {
    try {
      rawText = await generateWithGemini(prompt, "반드시 유효한 JSON 형식으로만 응답합니다.");
    } catch (err) {
      console.error("[apply-negotiation] Gemini 실패, Anthropic 폴백:", (err as Error).message);
    }
  }
  if (!rawText && process.env.ANTHROPIC_API_KEY) {
    try {
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
        system: "반드시 유효한 JSON 형식으로만 응답합니다.",
        messages: [{ role: "user", content: prompt }],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      rawText = textBlock?.type === "text" ? textBlock.text : "";
    } catch (err) {
      console.error("[apply-negotiation] Anthropic 실패:", (err as Error).message);
    }
  }

  if (!rawText) {
    return NextResponse.json({ error: "AI 응답을 받지 못했습니다." }, { status: 502 });
  }

  let updates: { id: string; revised_text: string; reason?: string }[] = [];
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    updates = Array.isArray(parsed.updates) ? parsed.updates : [];
  } catch {
    return NextResponse.json({ error: "AI 응답 파싱 실패" }, { status: 502 });
  }

  const validIds = new Set(clauses.map((c) => c.id));
  let updatedCount = 0;
  const applied: { id: string; reason?: string }[] = [];

  for (const u of updates) {
    if (!u.id || !u.revised_text || !validIds.has(u.id)) continue;
    const current = clauses.find((c) => c.id === u.id);
    if (!current || current.clause_text === u.revised_text) continue;
    // 최초 수정 시 original_text 보존
    const patch: Record<string, unknown> = { clause_text: u.revised_text };
    if (!current.original_text) patch.original_text = current.clause_text;
    const { error } = await supabase.from("clauses").update(patch).eq("id", u.id);
    if (!error) {
      updatedCount++;
      applied.push({ id: u.id, reason: u.reason });
    }
  }

  return NextResponse.json({ updated: updatedCount, applied });
}
