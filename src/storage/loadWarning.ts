import type { LoadResult } from "./db";

/* ------------------------------------------------------------------ */
/* Açılış uyarısı — okumanın sonucunu kullanıcıya söyler               */
/* ------------------------------------------------------------------ */

/*
  Arayüz metinleri henüz tek dilde ve bileşenlerde sabit; settings.lang
  şemada var ama hiçbir yerde okunmuyor. Çeviri yapısı geldiğinde bu
  metinler de oraya taşınır.
*/

/** Gösterilecek uyarı; her şey yolundaysa null. */
export function loadWarning(result: LoadResult): string | null {
  switch (result.status) {
    case "ok":
    case "empty":
      return null;
    case "failed":
      return "İlerlemen bu oturumda kaydedilemiyor.";
    case "recovered":
      switch (result.loss) {
        case "allProgress":
          return "Kayıtlı ilerlemen okunamadı, sıfırdan başlıyorsun.";
        case "someProgress":
          return "Kayıtlı ilerlemenin bir kısmı okunamadı; okunabilenler korundu.";
        case "settingsOnly":
          return "Bazı ayarların okunamadı, varsayılana döndürüldü.";
      }
  }
}
