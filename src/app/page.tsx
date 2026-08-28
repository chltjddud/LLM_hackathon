"use client";

import { useCallback, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";

type Clause = {
  clause_text: string;
  risk_level: string;
  category: string | null;
  law_basis: string | null;
  explanation: string | null;
};

const RISK_STYLES: Record<string, string> = {
  위험: "bg-red-50 border-red-300 text-red-800",
  주의: "bg-amber-50 border-amber-300 text-amber-800",
  안전: "bg-zinc-50 border-zinc-200 text-zinc-500",
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [clauses, setClauses] = useState<Clause[] | null>(null);

  const pollForClauses = async (id: string) => {
    for (let i = 0; i < 30; i++) {
      const res = await fetch(`/api/session/${id}`);
      const data = await res.json();
      if (data.clauses?.length > 0) {
        setClauses(data.clauses);
        return;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    setError("분석이 너무 오래 걸리고 있어요. 잠시 후 다시 시도해주세요.");
  };

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 업로드할 수 있어요.");
      return;
    }
    setError(null);
    setClauses(null);
    setSessionId(null);
    setPreviewUrl(URL.createObjectURL(file));
    setLoading(true);
    try {
      const imageBase64 = await fileToBase64(file);
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64, mediaType: file.type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "분석에 실패했습니다.");
      setSessionId(data.session.id);
      await pollForClauses(data.session.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const riskCounts = clauses?.reduce((acc, c) => {
    acc[c.risk_level] = (acc[c.risk_level] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-16">
      <main className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-zinc-900">자취 계약서 리스크 도우미</h1>
        <p className="mt-2 text-zinc-600">임대차/알바 계약서 사진을 올리면 위험 조항을 찾아드려요.</p>

        <label
          htmlFor="file-input"
          data-testid="dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`mt-8 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
            isDragging
              ? "border-blue-500 bg-blue-50"
              : "border-zinc-300 bg-white hover:border-zinc-400"
          }`}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="업로드한 계약서 미리보기"
              className="max-h-64 rounded-lg object-contain"
            />
          ) : (
            <>
              <svg
                className="h-10 w-10 text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 7.5m0 0L7.5 12m4.5-4.5v13.5"
                />
              </svg>
              <p className="font-medium text-zinc-700">여기에 사진을 끌어다 놓으세요</p>
              <p className="text-sm text-zinc-400">또는 클릭해서 파일 선택 (JPG, PNG)</p>
            </>
          )}
          <input
            id="file-input"
            data-testid="file-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileInput}
          />
        </label>

        {loading && (
          <div className="mt-6 flex items-center gap-3 text-zinc-600" data-testid="loading">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
            계약서를 분석하고 있어요... (최대 40초 정도 걸릴 수 있어요)
          </div>
        )}

        {error && (
          <p
            className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            data-testid="error"
          >
            {error}
          </p>
        )}

        {clauses && (
          <div className="mt-8" data-testid="results">
            <div className="flex gap-3 text-sm font-medium">
              <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">
                위험 {riskCounts?.["위험"] ?? 0}
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                주의 {riskCounts?.["주의"] ?? 0}
              </span>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-600">
                안전 {riskCounts?.["안전"] ?? 0}
              </span>
            </div>

            <ul className="mt-4 space-y-3">
              {clauses.map((c, i) => (
                <li
                  key={i}
                  className={`rounded-xl border p-4 ${
                    RISK_STYLES[c.risk_level] ?? RISK_STYLES["안전"]
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
                    <span>{c.risk_level}</span>
                    {c.category && <span className="opacity-70">· {c.category}</span>}
                  </div>
                  <p className="mt-1 text-sm text-zinc-800">{c.clause_text}</p>
                  {c.explanation && <p className="mt-2 text-sm">{c.explanation}</p>}
                  {c.law_basis && (
                    <p className="mt-1 text-xs opacity-70">근거: {c.law_basis}</p>
                  )}
                </li>
              ))}
            </ul>

            {sessionId && (
              <p className="mt-6 text-sm text-zinc-500">
                세션 ID: <code className="rounded bg-zinc-100 px-1.5 py-0.5">{sessionId}</code>
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
