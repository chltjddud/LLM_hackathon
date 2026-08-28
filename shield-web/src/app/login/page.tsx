"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } =
      mode === "login"
        ? await supabaseBrowser.auth.signInWithPassword({ email, password })
        : await supabaseBrowser.auth.signUp({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen justify-center bg-[#F9FAFC]">
      <main className="flex min-h-screen w-full max-w-md flex-col px-6 pt-16 pb-10">
        <h1
          className="text-[26px] font-extrabold tracking-tight"
          style={{ color: "#6542F1" }}
        >
          SIGNAL
        </h1>

        <div className="mt-10 mb-8">
          <h2 className="text-[24px] font-bold tracking-tight text-gray-900">
            {mode === "login" ? "로그인" : "회원가입"}
          </h2>
          <p className="mt-2 text-[15px] font-medium text-gray-500">
            {mode === "login"
              ? "계정으로 로그인하고 내 계약을 확인하세요."
              : "이메일로 간단하게 가입할 수 있어요."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            required
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-[16px] border border-gray-200 bg-white px-5 py-4 text-[15px] font-medium text-gray-900 outline-none focus:border-[#6542F1]"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="비밀번호 (6자 이상)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-[16px] border border-gray-200 bg-white px-5 py-4 text-[15px] font-medium text-gray-900 outline-none focus:border-[#6542F1]"
          />

          {error && (
            <p className="rounded-[12px] bg-red-50 px-4 py-3 text-[13px] font-medium text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-[20px] py-4 text-[16px] font-bold text-white shadow-lg transition-transform active:scale-[0.98] disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, #6747D5 0%, #573AC2 100%)",
            }}
          >
            {loading ? "처리 중..." : mode === "login" ? "로그인" : "회원가입"}
          </button>
        </form>

        <button
          onClick={() => {
            setError(null);
            setMode(mode === "login" ? "signup" : "login");
          }}
          className="mt-6 text-center text-[14px] font-semibold text-gray-500"
        >
          {mode === "login" ? (
            <>
              계정이 없으신가요? <span style={{ color: "#6542F1" }}>회원가입</span>
            </>
          ) : (
            <>
              이미 계정이 있으신가요? <span style={{ color: "#6542F1" }}>로그인</span>
            </>
          )}
        </button>
      </main>
    </div>
  );
}
