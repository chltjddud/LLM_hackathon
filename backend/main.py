import os
import json
import base64
import asyncio
from io import BytesIO
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import re

class CoachRequest(BaseModel):
    title: str
    description: str
    tone: str

try:
    import PyPDF2
except ImportError:
    PyPDF2 = None

from PIL import Image
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load environment variables
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("Warning: GEMINI_API_KEY not found in environment.")

app = FastAPI(title="AI Hackathon Backend API (Gemini)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def parse_contract_sync(contents: bytes, filename: str):
    text_content = ""
    image_parts = []
    
    if filename.endswith(".pdf"):
        try:
            if PyPDF2:
                pdf_reader = PyPDF2.PdfReader(BytesIO(contents))
                for page in pdf_reader.pages:
                    extracted = page.extract_text()
                    if extracted:
                        text_content += extracted + "\n"
            else:
                text_content = ""
        except Exception as e:
            print("PDF extraction warning:", e)
            
        if not text_content.strip():
            text_content = "(주의: 이 PDF 파일은 텍스트가 직접 추출되지 않는 스캔본/이미지 기반 문서입니다. 텍스트 추출이 불가능할 경우 관련 사항을 안내해 주세요.)"
            
    elif filename.endswith((".png", ".jpg", ".jpeg", ".webp")):
        try:
            img = Image.open(BytesIO(contents))
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            
            # Gemini supports PIL Images directly
            max_dim = 800
            if max(img.size) > max_dim:
                img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
                
            image_parts.append(img)
        except Exception as img_err:
            print("Image optimization fallback:", img_err)
            raise HTTPException(status_code=400, detail="이미지 처리 중 오류가 발생했습니다.")
    else:
        raise HTTPException(status_code=400, detail="지원하지 않는 파일 형식입니다. (PDF, PNG, JPG만 가능)")

    prompt_instructions = """
당신은 대한민국 최고의 노동법/부동산 전문 법률 AI입니다. 제공된 계약서(텍스트 또는 이미지)를 철저히 검토하고 분석하세요.
반드시 아래 정의된 JSON 구조로만 응답해야 하며, 서론이나 결론, 추가 설명 없이 순수 JSON 문자열만 출력하세요.

{
  "summary": {
    "wage": "시급/월급/보증금 등 금액 관련 명시 내용 (없으면 '확인불가')",
    "hours": "근로시간 또는 거주/계약 조건 (없으면 '확인불가')",
    "period": "계약 기간 (없으면 '확인불가')"
  },
  "risks": [
    {
      "title": "위험/불리한 조항 제목",
      "description": "이 조항이 왜 문제인지 친한 노무사나 멘토가 조언해 주듯, 이해하기 쉬운 말투(~해요, ~합니다)로 부드럽게 설명해 주세요.",
      "level": "red"
    }
  ],
  "missing": [
    {
      "title": "누락된 필수/보호 조항",
      "description": "어떤 조항이 빠졌고 이로 인해 어떤 불이익이 생길 수 있는지, 친근하게 충고하는 말투(~해요, ~합니다)로 설명해 주세요.",
      "estimated_loss": "예상 피해/손실액 또는 위험 정도 (예: 약 50만원 손실 우려, 보증금 미반환 위험)"
    }
  ]
}

규칙:
1. risks의 level은 반드시 "red", "yellow", "green" 중 하나여야 합니다.
2. 계약서 내용이 명확하지 않거나 식별이 불가능한 경우에도 JSON 구조를 유지하고 각 항목에 안내 문구를 넣어 완성된 JSON을 반환하세요.
3. 설명(description)은 딱딱한 법률 용어를 최소화하고 일반인이 이해하기 쉬운 자연스러운 조언 톤을 유지하세요.
4. 마크다운 코드블록(```json 등) 없이 JSON만 출력하세요.
5. 응답 내용에 이모티콘(🚨, ⚠️, 😊 등)을 절대 포함하지 마세요.
"""

    gemini_prompt = [prompt_instructions]
    if text_content:
        gemini_prompt.append(f"다음은 계약서 텍스트입니다:\n\n{text_content}")
    if image_parts:
        gemini_prompt.extend(image_parts)
        gemini_prompt.append("위 이미지는 분석할 계약서 문서입니다.")

    try:
        print(f"Calling Gemini for {filename}...")
        client = genai.Client(api_key=GEMINI_API_KEY)
        
        response = client.models.generate_content(
            model='gemini-3.5-flash-lite',
            contents=gemini_prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=3000,
                response_mime_type="application/json"
            )
        )
        result_text = response.text
        if not result_text:
            raise ValueError("No text returned from Gemini API")
            
    except Exception as e:
        print(f"Gemini Error in analyze_contract: {str(e)}")
        raise e
    
    # JSON extraction with robust markdown stripping and regex
    cleaned_text = result_text.strip()
    if cleaned_text.startswith("```json"):
        cleaned_text = cleaned_text[7:]
    if cleaned_text.startswith("```"):
        cleaned_text = cleaned_text[3:]
    if cleaned_text.endswith("```"):
        cleaned_text = cleaned_text[:-3]
    cleaned_text = cleaned_text.strip()

    match = re.search(r'\{[\s\S]*\}', cleaned_text)
    if match:
        json_str = match.group(0)
    else:
        json_str = cleaned_text

    try:
        parsed_json = json.loads(json_str, strict=False)
    except Exception as json_err:
        print("Initial JSON parse failed, cleaning control characters:", json_err)
        cleaned_str = re.sub(r'[\x00-\x1f\x7f-\x9f]', lambda m: ' ' if m.group(0) not in '\r\n\t' else m.group(0), json_str)
        try:
            parsed_json = json.loads(cleaned_str, strict=False)
        except Exception as final_err:
            print("Failed to parse JSON directly. Constructing fallback structure. Error:", final_err)
            parsed_json = {
                "summary": {
                    "wage": "분석 완료",
                    "hours": "본문 참조",
                    "period": "본문 참조"
                },
                "risks": [
                    {
                        "title": "계약서 분석 오류",
                        "description": "분석을 완료했으나 데이터를 구조화하는 데 실패했습니다.",
                        "level": "yellow"
                    }
                ],
                "missing": []
            }
        
    return parsed_json

@app.post("/api/analyze_contract")
async def analyze_contract(file: UploadFile = File(...)):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API Key is missing. Please add it to the .env file.")
        
    contents = await file.read()
    filename = file.filename.lower()
    
    try:
        # Run synchronous blocking genai / PIL / PyPDF2 in a worker thread
        parsed_json = await asyncio.to_thread(parse_contract_sync, contents, filename)
        return parsed_json
    except HTTPException:
        raise
    except Exception as e:
        print("Error in analyze_contract:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/coach")
async def ai_coach(request: CoachRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API Key is missing.")
        
    prompt = f"""
당신은 대한민국 최고의 노동법/부동산 전문 법률 AI이자 협상 코치입니다.
사용자가 다음 계약서 조항(문제점)에 대해 상대방(집주인/사장님)과 협상하려고 합니다.

문제 조항: {request.title}
상세 내용: {request.description}
원하는 어투(톤): {request.tone} 
(soft: 질문형으로 부드럽게, firm: 정중하지만 사실에 기반하여 분명하게, formal: 단호하고 공식적인 통보형)

반드시 아래 정의된 JSON 구조로만 응답해야 하며, 다른 텍스트는 출력하지 마세요.
{{
  "message": "상대방에게 카카오톡이나 문자로 직접 보낼 수 있는 협상 메시지 (3~5문장 내외)",
  "rebuttals": [
    {{
      "if_they_say": "상대방의 예상 부정적 반응 1",
      "reply": "그에 대한 사용자의 재반박/답변"
    }},
    {{
      "if_they_say": "상대방의 예상 부정적 반응 2",
      "reply": "그에 대한 사용자의 재반박/답변"
    }}
  ]
}}
마크다운 코드블록(```json 등) 없이 JSON만 출력하세요.
"""
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = await asyncio.to_thread(
            client.models.generate_content,
            model='gemini-3.5-flash-lite',
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=1000,
                response_mime_type="application/json"
            )
        )
        result_text = response.text
        if not result_text:
            raise ValueError("No text returned from Gemini API")
            
        cleaned_text = result_text.strip()
        if cleaned_text.startswith("```json"):
            cleaned_text = cleaned_text[7:]
        if cleaned_text.startswith("```"):
            cleaned_text = cleaned_text[3:]
        if cleaned_text.endswith("```"):
            cleaned_text = cleaned_text[:-3]
        cleaned_text = cleaned_text.strip()

        match = re.search(r'\{[\s\S]*\}', cleaned_text)
        if match:
            json_str = match.group(0)
        else:
            json_str = cleaned_text

        parsed_json = json.loads(json_str, strict=False)
        return parsed_json
    except Exception as e:
        print("Error in ai_coach:", str(e))
        raise HTTPException(status_code=500, detail="협상 코치 결과를 생성하는 중 오류가 발생했습니다.")
