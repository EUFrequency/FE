import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    serverActions: {
      // 주점 저장 시 소개 이미지(최대 5장) + 메뉴 이미지(최대 30장)를 base64로 한 번에
      // 보내는데, 기본값 1MB로는 이미지 몇 개만 첨부해도 서버 액션이 거부됨(운영 모드에서
      // React 에러 #441로만 보이고 원인이 안 보임) - 넉넉하게 올려둠.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
