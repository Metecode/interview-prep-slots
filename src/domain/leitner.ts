import type { Attempt, Box, QuestionProgress, SelfRating } from "./progress";

/* ------------------------------------------------------------------ */
/* Leitner — kutu geçişi ve deneme kaydı                               */
/* ------------------------------------------------------------------ */

/**
 * Kutu 1..5 için tekrar aralığı, gün cinsinden. Dizin = kutu - 1.
 * Kutu yükseldikçe soru seyrekleşir; çekiliş ağırlığı bu aralığa bakar.
 */
export const BOX_INTERVALS_DAYS = [1, 2, 4, 8, 16] as const;

/** Tavan kutu. Buradan yukarısı yok. */
export const MAX_BOX: Box = 5;

/** Tutulan deneme sayısı. Şemadaki `attempts` üst sınırıyla aynı olmalı. */
export const MAX_ATTEMPTS = 10;

/**
 * Bir denemeden sonra sorunun gideceği kutu.
 * Kararı kullanıcının öz-değerlendirmesi verir, makine skoru değil.
 */
export function nextBox(
  currentBox: Box,
  rating: SelfRating,
  passed: boolean,
): Box {
  // Pas geçmek "bilmiyordum" ile aynı sonucu verir: soru en başa döner.
  if (passed || rating === 0) return 1;

  // Kısmen bilindi — kutu korunur, aralık değişmez.
  if (rating === 1) return currentBox;

  // Bilindi — bir kutu ilerler, ama tavanı aşmaz.
  return Math.min(currentBox + 1, MAX_BOX) as Box;
}

/* ------------------------------------------------------------------ */
/* Aşama — kutunun kullanıcıya gösterilen adı                          */
/*                                                                     */
/* Kodda kavramın adı box olarak kalır; "Kutu N" yalnızca arayüzden     */
/* kalkar. Kullanıcı için anlamlı olan kutunun numarası değil, soruyu   */
/* ne kadar oturttuğu.                                                  */
/* ------------------------------------------------------------------ */

export type StageName = "Yeni" | "Öğreniliyor" | "Pekişiyor" | "İyi biliniyor" | "Oturdu";

export type Stage = {
  /** Dolu nokta sayısı; kutuyla birebir. */
  level: Box;
  name: StageName;
};

/** Aşama rozetindeki toplam nokta sayısı. */
export const STAGE_COUNT = MAX_BOX;

/**
 * Kutu ve deneme sayısından aşama. Kutu 1 iki aşamaya ayrılır: hiç
 * denenmemiş soru "Yeni", denenip kutu 1'de kalmış (ya da oraya
 * düşmüş) soru "Öğreniliyor" — ikisi aynı kutuda ama kullanıcı için
 * farklı durumlar.
 */
export function stageOf(box: Box, attemptCount: number): Stage {
  switch (box) {
    case 1:
      return { level: 1, name: attemptCount > 0 ? "Öğreniliyor" : "Yeni" };
    case 2:
      return { level: 2, name: "Öğreniliyor" };
    case 3:
      return { level: 3, name: "Pekişiyor" };
    case 4:
      return { level: 4, name: "İyi biliniyor" };
    case 5:
      return { level: 5, name: "Oturdu" };
  }
}

/** Tek gün "1 gün sonra" değil "yarın" diye yazılır. */
function daysAheadText(days: number): string {
  return days === 1 ? "yarın" : `${days} gün sonra`;
}

/**
 * Sorunun şu anki kutusuna göre bir sonraki tekrarı. Sonuç ekranının
 * alt çubuğu bunu yazar: sıklığı ("4 günde bir") değil, ne zaman
 * döneceğini söyler.
 */
export function nextReviewInLabel(box: Box): string {
  return `Sonraki tekrar: ${daysAheadText(BOX_INTERVALS_DAYS[box - 1])}`;
}

/**
 * Bir öz-değerlendirme seçilirse sorunun bir sonraki tekrarı kaç gün
 * sonraya düşer. Düğmelerin altındaki gün sayısı buradan geliyor.
 *
 * Hesap doğrudan aralık tablosundan okunmaz, nextBox üzerinden yapılır:
 * ekranda yazan gün ile sorunun gerçekten gideceği kutu ayrışmasın.
 * Kutu 1'de "biliyordum" kutu 2'ye taşır, yani 2 gün — tablodan sabit
 * bir sayı okunsaydı bu ilişki ilk kutu değişikliğinde bozulurdu.
 */
export function reviewIntervalDays(
  currentBox: Box,
  rating: SelfRating,
  passed = false,
): number {
  return BOX_INTERVALS_DAYS[nextBox(currentBox, rating, passed) - 1];
}

/**
 * Bir öz-değerlendirmenin SONUCU, tek satırda: soru hangi aşamaya geçer
 * ve bir sonraki tekrar ne zaman. Öz-değerlendirme düğmelerinin altındaki
 * satır bunu yazar: "Pekişiyor · 4 gün sonra".
 *
 * Yalnızca gün sayısı yazınca alt çubuktaki "sonraki tekrar" ile
 * çelişiyormuş gibi okunuyordu: biri seçimin sonucunu, diğeri sorunun
 * ŞU ANKİ durumunu anlatıyor. Hedef aşamayı da yazmak o bağı kuruyor.
 *
 * Aşama stageOf'tan gelir. Deneme sayısı 1 verilir: değerlendirme
 * kaydedildiği anda soru en az bir kez denenmiş olur, yani kutu 1'e
 * düşen soru "Yeni" değil "Öğreniliyor"dur.
 */
export function nextReviewLabel(
  currentBox: Box,
  rating: SelfRating,
  passed = false,
): string {
  const stage = stageOf(nextBox(currentBox, rating, passed), 1);
  const days = reviewIntervalDays(currentBox, rating, passed);
  return `${stage.name} · ${daysAheadText(days)}`;
}

/**
 * Denemeyi ilerlemeye işler.
 * Saf: gelen nesneyi değiştirmez, yeni bir kayıt döner.
 */
export function applyAttempt(
  progress: QuestionProgress,
  attempt: Attempt,
): QuestionProgress {
  return {
    ...progress,
    box: nextBox(progress.box, attempt.selfRating, attempt.passed),
    // Zaman dışarıdan gelir; burada Date.now() çağrılmaz.
    lastSeenAt: attempt.at,
    // Son MAX_ATTEMPTS kayıt tutulur, eskiler baştan düşer.
    attempts: [...progress.attempts, attempt].slice(-MAX_ATTEMPTS),
  };
}
