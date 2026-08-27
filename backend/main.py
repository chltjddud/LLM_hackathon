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
