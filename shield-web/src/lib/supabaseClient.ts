"use client";

import { createClient } from "@supabase/supabase-js";

// 브라우저(클라이언트 컴포넌트)에서 로그인/회원가입할 때 쓰는 Supabase 클라이언트.
// 서버 라우트용 lib/supabase.ts와는 별개 — NEXT_PUBLIC_ 접두사 값을 쓴다.
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
