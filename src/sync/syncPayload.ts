import { MAX_ANSWER_LENGTH } from "../domain/progress";
import type { Attempt, QuestionProgress } from "../domain/progress";

/* ------------------------------------------------------------------ */
/* Sunucuya giden kayıt — yerel kopya değişmez                         */
/* ------------------------------------------------------------------ */

/*
  Sunucu bazı cevapları kabul etmiyor ve o kaydı atlıyor; temizlenmeseler o
  soru hiç senkronlanamazdı:
    - MAX_ANSWER_LENGTH'i aşan cevap (eski kayıtlarda olabilir, bkz. progress.ts)
    - NUL (\u0000) içeren cevap: Postgres JSONB reddediyor
    - eşi olmayan surrogate içeren cevap: geçerli UTF-8'e çevrilemiyor

  Temizlik yalnızca payload'da. Yereldeki kayıt olduğu gibi kalır; sınırı
  depolama şemasına koymamanın sebebi de bu (bkz. MAX_ANSWER_LENGTH).
*/

/** Kaydın sunucuya gidecek kopyası; girdiyi değiştirmez. */
export function toSyncRecord(record: QuestionProgress): QuestionProgress {
  return { ...record, attempts: record.attempts.map(toSyncAttempt) };
}

function toSyncAttempt(attempt: Attempt): Attempt {
  return { ...attempt, answer: toSyncAnswer(attempt.answer) };
}

export function toSyncAnswer(answer: string): string {
  const clean = replaceLoneSurrogates(answer.replaceAll("\u0000", ""));
  if (clean.length <= MAX_ANSWER_LENGTH) return clean;

  // Sınır UTF-16 birimiyle ölçülüyor (sunucu da öyle). Kesme bir emojinin
  // ortasına denk gelirse ilk yarı tek başına kalır; o da atılır.
  const cut = clean.slice(0, MAX_ANSWER_LENGTH);
  return isHighSurrogate(cut.charCodeAt(cut.length - 1)) ? cut.slice(0, -1) : cut;
}

/**
 * for...of kod noktası gezer: geçerli bir çift tek adımda iki birim olarak,
 * eşi olmayan yarı tek başına bir birim olarak gelir. Yalnızca o tek
 * birimlik yarılar U+FFFD olur.
 */
function replaceLoneSurrogates(text: string): string {
  let result = "";
  for (const char of text) {
    const isLoneHalf = char.length === 1 && isSurrogate(char.charCodeAt(0));
    result += isLoneHalf ? "�" : char;
  }
  return result;
}

function isSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdfff;
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}
