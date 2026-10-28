import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [preact(), tailwindcss(), viteSingleFile()],
  // プレビュー用ホスト（*.e2b.app など）からアクセスできるようにする
  server: { host: true, allowedHosts: true },
  preview: { host: true, allowedHosts: true },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // React の代わりに Preact を使う（react-dom 比で約 180KB 軽い）。
      // コードは React の API（hooks / createPortal）のまま動く。
      "react-dom/client": "preact/compat/client",
      "react-dom": "preact/compat",
      "react/jsx-runtime": "preact/jsx-runtime",
      "react/jsx-dev-runtime": "preact/jsx-dev-runtime",
      "react": "preact/compat",
    },
  },
});
