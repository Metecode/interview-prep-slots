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

/**
 * Kutunun rozette görünen okunur hali. "Kutu N" jargonu yerine kutunun
 * ne anlama geldiğini (ne sıklıkla tekrarlandığını) doğrudan söyler.
 */
export function boxCadenceLabel(box: Box): string {
  const days = BOX_INTERVALS_DAYS[box - 1];
  return days === 1 ? "Her gün tekrar" : `${days} günde bir tekrar`;
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
