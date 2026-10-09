import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  const logo = await readFile(path.join(process.cwd(), "public", "brand", "miva-logo.png"));
  return new ImageResponse(
    <div style={{ display: "flex", alignItems: "center", width: 64, height: 64, overflow: "hidden" }}>
      {/* Pixel-source crop: show only the supplied logo's left-hand symbol. */}
      <img src={`data:image/png;base64,${logo.toString("base64")}`} alt="" width="232" height="60" style={{ width: 232, height: 60 }} />
    </div>,
    size,
  );
}
