import type { Question } from "./question";

/* ------------------------------------------------------------------ */
/* "Kendi yapay zekâna sor" — panoya kopyalanacak metin                */
/*                                                                     */
/* Uygulama yapay zekâ çağırmaz (bkz. CLAUDE.md, "Yapay zekâ            */
/* değerlendirmesi — denendi, kaldırıldı"). Kullanıcı bu metni kendi    */
/* kullandığı araca yapıştırır.                                         */
/* ------------------------------------------------------------------ */

const CLOSING_REQUEST =
  "Cevabımı bu kriterlere göre değerlendir: hangilerini karşıladım, hangilerini kaçırdım? " +
  "En önemli eksiğimi, mülakatta neden önemli olduğuyla birlikte açıkla. " +
  "Sonra bana bir devam sorusu sor.";

/**
 * Soru, kullanıcının cevabı ve kriterler (her kavramın adı ve ilk çapa
 * cümlesi). Model cevap bilerek yok: prompt kısa kalsın; isteyen onu
 * zaten ekranda yanında görüyor.
 *
 * İlk çapa yeterli: kavramın neyi kapsadığını tek cümlede söylüyor,
 * hepsini koymak metni uzatır ve cevabı ele verir.
 */
export function buildOwnAiPrompt(question: Question, answer: string): string {
  const criteria = question.keyConcepts
    .map((concept) => {
      const anchor = concept.anchors[0];
      return anchor ? `- ${concept.label}: ${anchor}` : `- ${concept.label}`;
    })
    .join("\n");

  return [
    "Teknik mülakat sorusu:",
    question.prompt.trim(),
    "",
    "Benim cevabım:",
    answer.trim(),
    "",
    "Değerlendirme kriterleri (iyi bir cevapta olması beklenenler):",
    criteria,
    "",
    CLOSING_REQUEST,
  ].join("\n");
}
