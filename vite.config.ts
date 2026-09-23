import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Alt bilgideki sürüm package.json'dan okunur, elle tekrar yazılmaz.
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf-8"),
) as { version: string };

// Commit kısaltması CI'da GITHUB_SHA'dan gelir (Docker derlemesine build
// arg olarak geçer, bkz. Dockerfile.frontend). Yerelde tanımsız: "dev".
const commitSha = process.env.GITHUB_SHA?.slice(0, 7) || "dev";

// Backend'e giden yollar geliştirmede proxy'lenir: tarayıcı frontend'i ve
// API'yi aynı origin'den (localhost:5173) görür. Refresh cookie'si
// SameSite=Strict olduğu için bu şart; ayrı portlar iki ayrı site sayılır.
const backendProxy = {
  target: "http://localhost:8080",
  // Host başlığı localhost:5173 olarak kalsın: Spring, GitHub'a gönderdiği
  // redirect_uri'yi bu başlıktan üretiyor. changeOrigin: true olsaydı
  // redirect_uri localhost:8080'i gösterir ve tarayıcı origin'den çıkardı.
  changeOrigin: false,
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __COMMIT_SHA__: JSON.stringify(commitSha),
  },
  server: {
    proxy: {
      "/api": backendProxy,
      // GitHub girişinin başladığı ve döndüğü uçlar Spring'in yerleşik uçları.
      "/oauth2": backendProxy,
      "/login": backendProxy,
    },
  },
});
