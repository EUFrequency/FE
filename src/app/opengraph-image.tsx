import { ImageResponse } from "next/og";

export const alt = "Frequency - 학교 축제 주점 예약";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * 카카오톡·디스코드 등에 링크 공유 시 뜨는 미리보기 이미지 (기본값).
 * 하위 경로(예: /festival)가 자체 opengraph-image를 안 두면 이 파일을 그대로 물려받음.
 * 파이어베이스 데이터(시즌 이름 등)는 안 넣음 - 그건 페이지별 title/description으로 대신 보여줌.
 */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #0b0805 0%, #1f150c 55%, #0b0805 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: 10,
            fontWeight: 600,
            color: "#f59e0b",
          }}
        >
          FESTIVAL BOOTH RESERVATION
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 18,
            fontSize: 148,
            fontWeight: 700,
            fontStyle: "italic",
            fontFamily: "Georgia, serif",
            color: "#fdf6ec",
          }}
        >
          Frequency
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 22,
            fontSize: 34,
            color: "#c9beae",
          }}
        >
          축제편 주점 예약
        </div>
      </div>
    ),
    { ...size },
  );
}
