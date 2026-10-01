import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages(https://<계정>.github.io/<저장소>/)처럼 하위 경로에 올려도
  // 에셋/모델 경로가 깨지지 않도록 상대 경로로 빌드한다.
  base: "./",
  server: {
    host: true, // 같은 Wi-Fi의 휴대폰에서 접속 확인용 (단, 자이로/VR은 HTTPS가 필요해 배포본에서 확인)
  },
  build: {
    chunkSizeWarningLimit: 1200, // three.js 포함 단일 번들이라 경고 기준을 올림
  },
});
