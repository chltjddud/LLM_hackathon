import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300; // 300s (5 minutes) timeout

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    
    // Set up AbortController with 5 min timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 290000);

    try {
      // Forward to FastAPI backend on localhost:8000
      const backendRes = await fetch('http://127.0.0.1:8000/api/analyze_contract', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!backendRes.ok) {
        const errText = await backendRes.text();
        console.error('Backend error response:', backendRes.status, errText);
        return NextResponse.json({ error: errText || '백엔드 분석 서버 오류' }, { status: backendRes.status });
      }

      const data = await backendRes.json();
      return NextResponse.json(data);
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        return NextResponse.json({ error: '계약서 분석 시간이 초과되었습니다 (타임아웃).' }, { status: 504 });
      }
      throw fetchErr;
    }
  } catch (error: any) {
    console.error('API proxy error:', error);
    return NextResponse.json({ error: error.message || '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
