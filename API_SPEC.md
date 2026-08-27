# API 명세 (프론트엔드용)

세입자가 사진을 올리면 세션이 생기고, 그 세션 안에서 세입자/집주인이 채팅으로 조항을 협상하고, 합의되면 전자서명 후 완료됩니다.

역할 구분은 로그인 없이 URL로만: `/session/{id}?role=tenant` 또는 `?role=landlord`

---

## 1. 세션 생성 (사진 업로드)

`POST /api/session`

**요청**
```json
{ "imageBase64": "base64문자열", "mediaType": "image/jpeg" }
```

**응답 (200)**
```json
{
  "session": { "id": "uuid", "status": "negotiating", "created_at": "..." },
  "clauses": [
    {
      "id": "uuid",
      "clause_text": "원문 조항",
      "risk_level": "위험 | 주의 | 안전",
      "category": "카테고리명 또는 null",
      "law_basis": "법적 근거 또는 null",
      "explanation": "설명 또는 null",
      "simulation": "이대로 진행되면 벌어질 상황",
      "message_draft": "상대방에게 보낼 메시지 초안",
      "resolved_by_tenant": false,
      "resolved_by_landlord": false
    }
  ]
}
```
업로드~응답까지 15~40초 걸림 → 반드시 로딩 UI 필요.

세입자용 링크는 `/session/{session.id}?role=tenant`, 집주인 공유용은 `/session/{session.id}?role=landlord`.

---

## 2. 세션 상태 조회 (폴링용, 2~3초 간격 추천)

`GET /api/session/{id}`

**응답 (200)**
```json
{
  "session": { "id": "uuid", "status": "negotiating | ready_to_sign | completed" },
  "clauses": [ /* 위와 동일한 조항 배열, 최신 상태 */ ],
  "messages": [
    { "id": "uuid", "clause_id": "uuid 또는 null", "sender_role": "tenant | landlord", "text": "...", "created_at": "..." }
  ],
  "signatures": [
    { "id": "uuid", "role": "tenant | landlord", "signature_image": "base64", "signed_at": "..." }
  ]
}
```

- `session.status`가 `"ready_to_sign"`이 되면 → 서명 화면으로 넘어갈 수 있게 버튼 활성화
- `session.status`가 `"completed"`가 되면 → 완료 화면으로 전환

---

## 3. 채팅 메시지 보내기

`POST /api/session/{id}/message`

**요청**
```json
{ "sender_role": "tenant", "text": "이 조항 고쳐주세요", "clause_id": "uuid (선택, 특정 조항 태그 시)" }
```

**응답 (200)**: 생성된 메시지 객체

---

## 4. 조항 동의 / 텍스트 수정

`POST /api/session/{id}/clause/{clauseId}/resolve`

**동의할 때**
```json
{ "role": "tenant", "resolved": true }
```

**집주인이 조항 텍스트를 수정할 때** (텍스트 수정 시 양쪽 동의 상태는 자동으로 초기화됨 — 재합의 필요)
```json
{ "role": "landlord", "updated_text": "수정된 조항 텍스트" }
```

**응답 (200)**: 갱신된 조항 객체

- 위험/주의 조항이 전부 양쪽(`resolved_by_tenant`, `resolved_by_landlord`) 합의되면 `session.status`가 자동으로 `ready_to_sign`으로 바뀝니다 (프론트에서 별도 처리 불필요, 폴링으로 감지됨)

---

## 5. 서명 제출

`POST /api/session/{id}/sign`

**요청**
```json
{ "role": "tenant", "signature_image": "base64 PNG (캔버스에서 그린 서명)" }
```

**응답 (200)**: 저장된 서명 객체

- 양쪽 다 서명하면 `session.status`가 자동으로 `completed`로 바뀝니다

---

## 화면별 필요한 API 조합

| 화면 | 사용 API |
|---|---|
| 업로드 | 1 |
| 협상 (조항+채팅) | 2 (폴링), 3, 4 |
| 서명 | 2 (폴링), 5 |
| 완료 | 2 |
