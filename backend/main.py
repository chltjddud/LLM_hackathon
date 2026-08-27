import os
import json
import boto3
import asyncio
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_aws import BedrockEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter

app = FastAPI(title="AI Hackathon Backend API")

# CORS Setup: Allows frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# S3 Configuration
BUCKET_NAME = "hackathon-e1-t05-docs"
S3_FILE_KEY = "s3_test.txt"
FAISS_INDEX_DIR = "faiss_index"

# AWS Clients (Make sure your environment has proper AWS credentials)
s3_client = boto3.client('s3')
bedrock_client = boto3.client(service_name='bedrock-runtime')

def get_embeddings():
    return BedrockEmbeddings(
        client=bedrock_client,
        model_id="amazon.titan-embed-text-v2:0"
    )

def load_vector_db():
    embeddings = get_embeddings()
    try:
        # Load from disk
        db = FAISS.load_local(FAISS_INDEX_DIR, embeddings, allow_dangerous_deserialization=True)
        return db
    except Exception as e:
        print("FAISS Load Error:", e)
        return None

class ChatRequest(BaseModel):
    query: str

async def stream_bedrock_response(prompt_text: str):
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 800,
        "messages": [
            {"role": "user", "content": prompt_text}
        ]
    })
    
    try:
        response = bedrock_client.invoke_model_with_response_stream(
            modelId="global.anthropic.claude-sonnet-5",
            body=body
        )
        for event in response.get('body'):
            chunk = json.loads(event.get('chunk').get('bytes').decode('utf-8'))
            if chunk.get('type') == 'content_block_delta':
                text = chunk.get('delta', {}).get('text', '')
                # Server-Sent Events (SSE) format
                yield f"data: {json.dumps({'text': text})}\n\n"
            await asyncio.sleep(0.001) # Yield to event loop
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    yield "data: [DONE]\n\n"

@app.post("/api/chat")
async def chat(request: ChatRequest):
    query = request.query
    db = load_vector_db()
    
    if db is None:
        raise HTTPException(status_code=400, detail="FAISS index not found. Please upload a document first.")
        
    # Similarity Search
    docs = db.similarity_search(query, k=4)
    context_text = "\n---\n".join([doc.page_content for doc in docs])
    
    augmented_prompt = f"""
당신은 친절한 안내원입니다. 아래 주어진 [참고문서]를 바탕으로 질문에 답하세요.
참고문서에 없는 질문은 모른다고 명확히 답해야 합니다.

[참고문서]
{context_text}

질문: {query}
답변:
"""
    return StreamingResponse(stream_bedrock_response(augmented_prompt), media_type="text/event-stream")

@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):
    try:
        print(f"Uploading file {file.filename} to S3...")
        # 1. S3 Upload
        s3_client.upload_fileobj(file.file, BUCKET_NAME, S3_FILE_KEY)
        
        print("Downloading from S3 for validation...")
        # 2. Download from S3
        local_file_name = "downloaded_context.txt"
        s3_client.download_file(BUCKET_NAME, S3_FILE_KEY, local_file_name)
        
        print("Chunking text...")
        # 3. Read and Chunk
        with open(local_file_name, 'r', encoding='utf-8') as f:
            text = f.read()
            
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
        docs = text_splitter.create_documents([text])
        
        print(f"Creating FAISS index with {len(docs)} chunks...")
        # 4. Create Embeddings & FAISS
        embeddings = get_embeddings()
        db = FAISS.from_documents(docs, embeddings)
        
        print("Saving FAISS index locally...")
        # 5. Save locally
        db.save_local(FAISS_INDEX_DIR)
        
        return {"message": "업로드 및 벡터 DB 갱신 성공", "chunks": len(docs)}
        
    except Exception as e:
        print("Upload Error:", e)
        raise HTTPException(status_code=500, detail=str(e))

import base64
import PyPDF2
from io import BytesIO

@app.post("/api/analyze_contract")
async def analyze_contract(file: UploadFile = File(...)):
    contents = await file.read()
    filename = file.filename.lower()
    
    text_content = ""
    image_blocks = []
    
    if filename.endswith(".pdf"):
        try:
            pdf_reader = PyPDF2.PdfReader(BytesIO(contents))
            for page in pdf_reader.pages:
                text_content += page.extract_text() + "\n"
        except Exception as e:
            raise HTTPException(status_code=400, detail="PDF 파싱 실패")
    elif filename.endswith((".png", ".jpg", ".jpeg")):
        base64_img = base64.b64encode(contents).decode('utf-8')
        mime_type = "image/png" if filename.endswith(".png") else "image/jpeg"
        image_blocks.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": mime_type,
                "data": base64_img
            }
        })
    else:
        raise HTTPException(status_code=400, detail="지원하지 않는 파일 형식입니다. (PDF, PNG, JPG만 가능)")

    messages = []
    content_block = []
    
    if text_content:
        content_block.append({"type": "text", "text": f"다음은 계약서 텍스트입니다:\n\n{text_content}"})
    
    if image_blocks:
        content_block.extend(image_blocks)
        content_block.append({"type": "text", "text": "위 이미지는 계약서 원본입니다."})

    prompt_instructions = """
당신은 대한민국 최고의 노무사 및 부동산 변호사 AI입니다. 제공된 계약서(텍스트 또는 이미지)를 철저히 분석하세요.
분석 후 **반드시 아래 JSON 형식으로만** 응답하세요. 다른 설명이나 마크다운 코드블록(```json 등)은 절대 포함하지 말고 순수 JSON 문자열만 출력하세요.

{
  "summary": {
    "wage": "시급 9,500원 (또는 해당사항 없음)",
    "hours": "주 20시간 (또는 해당사항 없음)",
    "period": "6개월 (또는 해당사항 없음)"
  },
  "risks": [
    {
      "title": "지각 시 1만원 차감",
      "description": "근로기준법상 위약금 예정 금지에 위배될 소지가 있습니다.",
      "level": "yellow"
    }
  ],
  "missing": [
    {
      "title": "주휴수당 조항 누락",
      "description": "주 15시간 이상 근무하므로 주휴수당 지급 대상입니다.",
      "estimated_loss": "약 99만원"
    }
  ],
  "negotiation": {
    "soft": "부드러운 톤의 카톡 메시지...",
    "firm": "단호한 톤의 카톡 메시지...",
    "formal": "공식적인 톤의 카톡 메시지..."
  }
}

규칙:
1. risks의 level은 "red", "yellow", "green" 중 하나여야 합니다.
2. 분석할 내용이 없으면 빈 배열([])을 반환하세요.
3. negotiation 메시지는 사용자가 상대방(사장님/집주인)에게 카카오톡으로 보낼 수 있게 자연스럽게 작성하세요.
"""

    content_block.append({"type": "text", "text": prompt_instructions})
    messages.append({"role": "user", "content": content_block})

    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 2000,
        "messages": messages,
        "temperature": 0.1
    })

    try:
        response = bedrock_client.invoke_model(
            modelId="global.anthropic.claude-sonnet-5",
            body=body
        )
        response_body = json.loads(response.get('body').read())
        result_text = response_body.get("content")[0].get("text")
        
        result_text = result_text.strip()
        if result_text.startswith("```json"):
            result_text = result_text[7:]
        if result_text.endswith("```"):
            result_text = result_text[:-3]
            
        parsed_json = json.loads(result_text.strip())
        return parsed_json
    except Exception as e:
        print("Bedrock Error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

