import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS 홈 화면 추가 시 쓰이는 아이콘 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#171310",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 120,
            fontWeight: 700,
            fontStyle: "italic",
            fontFamily: "Georgia, serif",
            color: "#f59e0b",
          }}
        >
          F
        </div>
      </div>
    ),
    { ...size },
  );
}
