import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateWithGemini(
  prompt: string,
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
        parts: [{ text: prompt }]
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
      temperature: 0.7
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

export async function POST(req: NextRequest) {
  try {
    const { title, description, tone } = await req.json();

    if (!title || !description || !tone) {
      return NextResponse.json(
        { error: "title, description, tone이 모두 필요합니다." },
        { status: 400 }
      );
    }

    const toneText =
      tone === "soft"
        ? "질문형으로 부드럽고 완곡하게 (~요, ~일까요?)"
        : tone === "firm"
        ? "정중하지만 사실에 기반하여 분명하게 (~합니다, ~바랍니다)"
        : "단호하고 공식적인 통보형 (~조치해 주시기 바랍니다, ~규정되어 있습니다)";

    const prompt = `당신은 대한민국 최고의 노동법/부동산 전문 법률 AI이자 협상 코치입니다.
사용자가 다음 계약서 조항(문제점)에 대해 상대방(집주인/사장님)과 협상하려고 합니다.

문제 조항: ${title}
상세 내용: ${description}
원하는 어투(톤): ${tone} (${toneText})

반드시 아래 정의된 JSON 구조로만 응답해야 하며, 마크다운 코드블록(\`\`\`json 등)이나 추가 설명 없이 순수 JSON 문자열만 출력하세요:
{
  "message": "상대방에게 카카오톡이나 문자로 직접 보낼 수 있는 협상 메시지 (3~5문장 내외)",
  "rebuttals": [
    {
      "if_they_say": "상대방의 예상 부정적 반응 1",
      "reply": "그에 대한 사용자의 재반박/답변"
    },
    {
      "if_they_say": "상대방의 예상 부정적 반응 2",
      "reply": "그에 대한 사용자의 재반박/답변"
    }
  ]
}`;

    let rawText = "";

    if (process.env.GEMINI_API_KEY) {
      try {
        rawText = await generateWithGemini(
          prompt,
          "반드시 다른 설명 텍스트 없이 유효한 JSON 형식으로만 응답해야 합니다.",
          true
        );
      } catch (err: any) {
        console.error("Gemini API call failed in coach, falling back to Anthropic:", err.message);
      }
    }

    if (!rawText) {
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1500,
        system: "반드시 다른 설명 텍스트 없이 유효한 JSON 형식으로만 응답해야 합니다.",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      rawText = textBlock?.type === "text" ? textBlock.text : "{}";
    }
    
    // JSON parsing with fallback
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : rawText;
    
    try {
      const parsedJson = JSON.parse(jsonStr);
      return NextResponse.json(parsedJson);
    } catch (parseErr) {
      console.error("Failed to parse JSON response from LLM:", rawText);
      return NextResponse.json(
        {
          message: `안녕하세요 사장님/임대인님, 계약서의 ${title} 조항과 관련하여 조율하고 싶은 부분이 있어서 연락드렸습니다. 확인 부탁드립니다.`,
          rebuttals: [
            {
              if_they_say: "기존 양식대로 진행해야 합니다.",
              reply: "법적인 기준에 맞춰 상호 보완하는 차원에서의 조율을 정중히 제안드립니다."
            }
          ]
        }
      );
    }
  } catch (err: any) {
    console.error("Error in /api/coach:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
