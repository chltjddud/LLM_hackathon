# SIGNAL — AI 계약서 분석·협상·전자서명 서비스

> 자취/임대차 계약의 독소조항을 AI가 잡아주고, 협상부터 전자서명 계약 체결까지 한 흐름으로 지원하는 모바일 웹 서비스.

- **배포 URL**: http://13.207.65.236:8501 (또는 프록시 경유 http://13.207.65.236)
- **한 줄 소개**: 계약서 업로드 → AI 위험 분석 → 협상 코칭 → 조항 자동 수정 → 양측 전자서명 → 최종 계약서 PDF 생성

---

## 1. 핵심 기능

| 단계 | 기능 |
|---|---|
| 업로드 | 계약서(PDF/이미지) 업로드 후 AI 분석 |
| 분석 결과 | 종합 위험 점수(게이지), 위험/주의/누락 조항 분류(막대그래프), 주요 위험 조항 리스트 |
| 상세/코칭 | 조항별 상세 + 관련 법령 근거 + AI 협상 코칭 메시지 생성 |
| 협상 | 임차인 ↔ 임대인 실시간 채팅, "모든 조항 한 번에 협상" |
| 수정 반영 | AI가 협상 채팅을 읽고 조항 문구를 자동 수정 → 수정본 계약서 PDF 공유 |
| 서명 | 양측 전자서명(Canvas) → 최종 계약서 PDF 자동 생성 |
| 관리 | 로그인, 진행 중/완료 계약 목록, 완료 계약 클릭 시 서명본 PDF 열람 |

---

## 2. 기술 스택

**프론트엔드 / 프레임워크**
- Next.js 16 (App Router, API Routes)
- React 19 / TypeScript
- Tailwind CSS v4
- Noto Sans KR (전역 폰트)

**AI / LLM**
- Google Gemini (gemini-3.5-flash-lite) — 계약 분석, 협상 코칭, 조항 자동 수정 (주)
- Anthropic Claude (claude-3-5-sonnet) — 폴백
- Upstage — 문서 처리

**데이터 / 인증**
- Supabase (PostgreSQL + Auth)
- JWT 검증: Supabase ES256(JWKS) 공개키 기반 로컬 검증 (Node crypto)

**PDF / 문서**
- pdf-lib + @pdf-lib/fontkit — 서명본/수정본 PDF 생성
- Noto Sans KR 서브셋(base64 인라인) — PDF 한글 임베드
- pdf-parse — 업로드 PDF 텍스트 추출
- HTML5 Canvas — 전자서명 입력

**인프라 / 배포**
- AWS EC2 (Ubuntu)
- pm2 — Node 프로세스 관리(무중단 재시작)
- AWS S3 — 계약서/서명 이미지 저장(best-effort)

---

## 3. 아키텍처 / 데이터 흐름

```
[사용자] 계약서 업로드
   → /api/session (POST): AI 분석(analyzeContract) → sessions/clauses 저장
   → 세션 화면: 점수/그래프/조항 (Supabase 2초 폴링)
   → 협상 채팅 (/api/session/[id]/message)
   → 임대인 "수정본 공유": /api/session/[id]/apply-negotiation
        (AI가 채팅 반영해 clause_text 수정) → 채팅에 수정본 카드
   → /api/session/[id]/revised-pdf: 원본 + 수정 내역 PDF
   → 양측 전자서명 (/api/session/[id]/sign)
   → /api/session/[id]/final-pdf: 원본 + 수정 내역 + 서명 (5페이지)
```

### 데이터 모델 (Supabase)
- **sessions**: id, image_url(base64 data URL), status, tenant_user_id, landlord_user_id, filename, signed_document_url
- **clauses**: id, session_id, clause_text(현재 문구), original_text(원문), risk_level(위험/주의/안전), category, law_basis, explanation, resolved_by_tenant/landlord
- **messages**: id, session_id, sender_role, text, clause_id
- **signatures**: id, session_id, role, signature_image(base64 PNG), signed_at

---

## 4. 위험 점수 기준

100점 만점에서 감점:
- 위험 조항: **-20점** / 누락 항목: **-10점** / 주의 조항: **-8점**

등급:
| 등급 | 점수 | 색 |
|---|---|---|
| 위험 | < 60 | #FC0303 |
| 주의 | 60~89 | #FFA200 |
| 보통 | 90~99 | #B7F50C |
| 안전 | 100 | #1CE644 |

> 감점 가중치는 피해 심각도(위험 > 누락 > 주의) 기준. 위험 조항은 무효/보증금 손실 등 즉각적 불이익, 누락은 보호장치 부재, 주의는 협상 조정 가능한 수준. `data/risk-criteria.json`에 법령 근거 매핑. 안전은 감점 0(100점)에서만 인정.

---

## 5. PDF 생성 방식

- 원본 계약서는 DB에 base64 data URL로 저장. pdf-lib으로 로드 후 `copyPages`로 새 문서에 병합 (이미지 원본이면 A4 페이지에 embed).
- **수정본 PDF**: 원본 + "협상 반영 수정본" 페이지([기존]/[수정] before-after).
- **최종 PDF**: 원본 + 수정 내역 + 전자서명 페이지 = 5페이지. 양측 서명 완료 시에만 생성.
- 한글: Noto Sans KR 실사용 글자만 서브셋(TTF) → base64로 소스 인라인 → fontkit 임베드 (파일시스템 의존 없음).
- 응답은 `Content-Disposition: inline`으로 브라우저 뷰어에서 열람(HTTP 다운로드 경고 회피).

---

## 6. 배포 방법 (EC2)

> 서버는 pm2가 `shield-web`(next start -p 8501)을 관리. cwd = `~/shield-web`.

```bash
# 1) 로컬에서 빌드 확인
npm run build

# 2) 변경 파일을 EC2로 전송 (예)
scp -i <key.pem> src/app/.../page.tsx ubuntu@<EC2_IP>:/tmp/page.tsx

# 3) EC2에서 배치 + 빌드 + 재시작
ssh -i <key.pem> ubuntu@<EC2_IP>
cd ~/shield-web
cp /tmp/page.tsx src/app/.../page.tsx
npm run build
pm2 restart shield-web --update-env
```

- 포트: **8501** (pm2 관리)
- 재시작은 반드시 `pm2 restart` 사용 (직접 kill 시 pm2가 자동 재기동하여 포트 충돌)

---

## 7. 환경 변수 (.env.local — 값은 커밋 금지)

```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_JWT_SECRET=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
UPSTAGE_API_KEY=...
```

> 실제 키 값은 저장소/노션에 올리지 말 것. EC2 `~/.env.local` 및 `~/shield-web/.env.local`에만 보관.

---

## 8. 주요 API

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | /api/session | 계약서 업로드 + AI 분석 → 세션 생성 |
| GET | /api/session/[id] | 세션/조항/메시지/서명 조회(폴링) |
| POST | /api/session/[id]/message | 채팅 메시지 전송 |
| POST | /api/coach | 조항별 AI 협상 코칭 |
| POST | /api/session/[id]/apply-negotiation | 협상 채팅 반영해 조항 자동 수정 |
| GET | /api/session/[id]/revised-pdf | 수정본 계약서 PDF |
| POST | /api/session/[id]/sign | 전자서명 제출 |
| GET | /api/session/[id]/final-pdf | 최종 계약서 PDF(원본+수정+서명) |
| GET | /api/my-sessions | 로그인 사용자의 계약 목록 |
