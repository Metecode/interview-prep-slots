import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.meteucar.slot",
  appName: "Slot",
  // Vite'ın çıktı klasörü (vite.config.ts'te build.outDir yok, varsayılan).
  webDir: "dist",
  server: {
    /*
      Varsayılan zaten "https"; açıkça yazıldı çünkü origin'i belirliyor
      (https://localhost) ve IndexedDB'deki ilerleme origin'e bağlı.
      Değişirse kullanıcının cihazdaki ilerlemesi görünmez olur.
      server.url BİLEREK yok: uygulama paketlenmiş varlıklarla çalışır,
      uzak bir adresten yüklenmez.
    */
    androidScheme: "https",
  },
};

export default config;
