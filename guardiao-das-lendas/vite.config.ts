import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Single self-contained index.html: playable from a link, an artifact, or inside an APK WebView.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: { target: "es2019", assetsInlineLimit: 100000000, chunkSizeWarningLimit: 4000 },
});
