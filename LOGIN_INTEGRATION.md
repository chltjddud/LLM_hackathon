# 로그인 연동 가이드 (프론트엔드용)

로그인은 백엔드에 별도 API가 없고, **Supabase Auth를 프론트에서 직접 호출**하는 방식입니다.

## 1. 준비물

`shield-web` 프로젝트에 설치:
```bash
npm install @supabase/supabase-js
```

`.env.local`에 추가 (브라우저에서 쓰는 값이라 `NEXT_PUBLIC_` 접두사 필수):
```
NEXT_PUBLIC_SUPABASE_URL=https://wrtnaddcckhztzlodfwe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xHgf6hC0f-wnmtadPEWZEA_QYWBGA75
```

`lib/supabaseClient.ts` (브라우저용 클라이언트, 새로 만들기):
```ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

## 2. 회원가입 / 로그인

```ts
// 회원가입
const { data, error } = await supabase.auth.signUp({ email, password });

// 로그인
const { data, error } = await supabase.auth.signInWithPassword({ email, password });

// 로그아웃
await supabase.auth.signOut();
```

이메일 인증 확인은 꺼놨으니, 가입하자마자 바로 로그인 상태가 됩니다 (인증 메일 기다릴 필요 없음).

## 3. 로그인 상태 확인 / 토큰 가져오기

```ts
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token; // 없으면 비로그인 상태
const userEmail = session?.user.email;
```

로그인 상태 변화를 실시간으로 감지하려면:
```ts
supabase.auth.onAuthStateChange((event, session) => {
  // session이 null이면 로그아웃 상태
});
```

## 4. 백엔드 API 호출할 때 토큰 붙이기

로그인 여부와 관계없이 쓸 수 있는 API(`/api/session` 생성, 조회, 채팅, 조항합의, 서명)는 토큰 없이도 동작합니다. **다만 로그인 상태에서 토큰을 같이 보내면, 그 계약이 내 계정에 연결**돼서 "내 계약 목록"에 나타납니다.

```ts
const res = await fetch("/api/session", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify({ imageBase64, mediaType }),
});
```

## 5. 로그인 전용 API 2개

| API | 설명 | 인증 |
|---|---|---|
| `GET /api/my-sessions` | 내 계약 목록 (세입자/집주인으로 연결된 것 전부) | **필수** — 토큰 없으면 401 |
| `POST /api/session/{id}/join` | 집주인이 초대 링크 열었을 때 본인 계정을 그 계약에 연결. body: `{ "role": "landlord" }` | **필수** |

둘 다 헤더에 `authorization: Bearer <token>` 넣어서 호출하면 됩니다.

## 6. 화면 흐름 제안

1. 로그인 안 한 상태로도 사진 업로드 → 분석 → 협상 → 서명까지 전부 가능 (게스트 사용)
2. 로그인하면 "내 계약 목록"(`/api/my-sessions`) 화면이 추가로 열림 — 예전에 만든 계약들 다시 볼 수 있음
3. 집주인이 초대 링크로 들어왔을 때 로그인돼 있으면 자동으로(또는 버튼 눌러서) `join` API 호출해서 본인 계정 연결
