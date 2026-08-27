import { NextRequest, NextResponse } from "next/server";
import { analyzeContractImage } from "@/lib/analyzeContract";

export async function POST(req: NextRequest) {
  const { imageBase64, mediaType } = await req.json();

  if (!imageBase64) {
    return NextResponse.json({ error: "imageBase64가 필요합니다." }, { status: 400 });
  }

  try {
    const clauses = await analyzeContractImage(imageBase64, mediaType);
    return NextResponse.json({ clauses });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
