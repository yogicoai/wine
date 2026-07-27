import { NextResponse } from "next/server";
import { uploadImage, makeFilename, ftpConfigured } from "@/lib/ftp";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST { image: "data:image/jpeg;base64,..." 또는 순수 base64 }
// → Cafe24 호스팅에 올리고 공개 URL 반환. 실패 시 클라이언트가 base64 저장으로 폴백한다.
export async function POST(request) {
  if (!ftpConfigured()) return NextResponse.json({ url: null, noFtp: true });

  try {
    const { image, prefix } = await request.json();
    if (!image) return NextResponse.json({ error: "이미지가 없습니다." }, { status: 400 });

    const base64 = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    if (!buffer.length) return NextResponse.json({ error: "빈 이미지" }, { status: 400 });

    const url = await uploadImage(buffer, makeFilename(prefix || "scan"));
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[upload]", err.message);
    return NextResponse.json({ url: null, error: err.message });
  }
}
