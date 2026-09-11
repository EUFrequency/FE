import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** 크롬 탭 favicon - 앱 전체에서 쓰는 다크+amber 톤을 작은 사이즈로 압축 */
export default function Icon() {
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
          borderRadius: 7,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
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
