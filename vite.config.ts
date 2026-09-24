import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

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
// Yalnızca sunucunun cevaplayabileceği yollar: bu yollara giden sayfa
// geçişleri service worker'ın SPA yedeğine (önbellekteki index.html)
// düşmemeli. /oauth2 ve /login GitHub girişinin gidiş ve dönüşü; önbellekten
// index.html verilseydi giriş sunucuya hiç ulaşmazdı.
const serverOnlyPaths = [/^\/api\//, /^\/oauth2\//, /^\/login\//];

const pwa = VitePWA({
  /*
    Güncelleme: yeni sürüm arka planda iner ve BEKLER; açık sekmelerin
    hepsi kapanınca, yani bir sonraki açılışta devreye girer. "prompt"
    tipi skipWaiting/clientsClaim'i kapalı tutuyor, onay isteyen bir
    arayüz de bilerek yok — oturum ortasında sayfa asla yenilenmez.
  */
  registerType: "prompt",
  // Kayıt betiği index.html'e eklenir; uygulama kodu service worker bilmez.
  injectRegister: "script",
  // İkonlar zaten globPatterns'te; eklenti ayrıca eklerse listede iki kez çıkıyor.
  includeManifestIcons: false,
  manifest: {
    name: "Slot",
    short_name: "Slot",
    description: "Teknik mülakatlar için teorik soru pratiği.",
    lang: "tr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // tokens.css --bg: üst çubuk ve açılış ekranı aynı zeminde.
    theme_color: "#0b0f14",
    background_color: "#0b0f14",
    icons: [
      { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
      { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  },
  workbox: {
    // Uygulama kabuğu, JS/CSS (soru içeriği JS'e gömülü), fontlar, ikonlar.
    // Sesler dosya değil, Web Audio ile üretiliyor.
    globPatterns: ["**/*.{html,js,css,woff2,svg,png}"],
    navigateFallback: "/index.html",
    navigateFallbackDenylist: serverOnlyPaths,
    runtimeCaching: [
      {
        // API hiçbir zaman önbellekten cevaplanmaz: çevrimdışıyken istek
        // bugünkü gibi ağ hatasıyla düşer, auth ve senkron sessiz kalır.
        // GET dışındaki istekleri (POST/PUT) service worker zaten
        // önbelleğe almıyor, doğrudan ağa gidiyorlar.
        urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
        handler: "NetworkOnly",
      },
    ],
  },
});

export default defineConfig({
  plugins: [react(), pwa],
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
