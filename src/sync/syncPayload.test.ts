import { describe, expect, it } from "vitest";

import { MAX_ANSWER_LENGTH } from "../domain/progress";
import type { QuestionProgress } from "../domain/progress";
import { toSyncAnswer, toSyncRecord } from "./syncPayload";

/* ------------------------------------------------------------------ */
/* Senkron payload'u — sunucunun reddedeceği cevaplar temizlenir       */
/* ------------------------------------------------------------------ */

const EMOJI = "\u{1F600}"; // iki UTF-16 birimi

function recordWith(answer: string): QuestionProgress {
  return {
    questionId: "soru",
    box: 2,
    lastSeenAt: "2026-01-01T10:00:00.000Z",
    attempts: [
      {
        at: "2026-01-01T10:00:00.000Z",
        answer,
        hitCount: 1,
        totalConcepts: 3,
        selfRating: 1,
        passed: false,
      },
    ],
  };
}

describe("toSyncAnswer", () => {
  it("sınırın altındaki cevaba dokunmaz", () => {
    expect(toSyncAnswer("kısa cevap")).toBe("kısa cevap");
  });

  it("sınırdaki cevabı olduğu gibi bırakır", () => {
    const atLimit = "a".repeat(MAX_ANSWER_LENGTH);

    expect(toSyncAnswer(atLimit)).toBe(atLimit);
  });

  it("uzun cevabı sınıra keser", () => {
    const result = toSyncAnswer("a".repeat(MAX_ANSWER_LENGTH + 100));

    expect(result).toHaveLength(MAX_ANSWER_LENGTH);
  });

  it("kesme bir emojinin ortasına denk gelirse yarım kalanı atar", () => {
    // Emoji tam sınırda başlıyor: ilk yarısı içeride, ikinci yarısı dışarıda kalırdı.
    const answer = "a".repeat(MAX_ANSWER_LENGTH - 1) + EMOJI + "sonrası";

    const result = toSyncAnswer(answer);

    expect(result).toBe("a".repeat(MAX_ANSWER_LENGTH - 1));
  });

  it("sınıra tam sığan emojiyi korur", () => {
    const answer = "a".repeat(MAX_ANSWER_LENGTH - 2) + EMOJI + "sonrası";

    expect(toSyncAnswer(answer)).toBe("a".repeat(MAX_ANSWER_LENGTH - 2) + EMOJI);
  });

  it("NUL karakterlerini çıkarır", () => {
    expect(toSyncAnswer("önce\u0000sonra\u0000")).toBe("öncesonra");
  });

  it("eşi olmayan surrogate'leri U+FFFD yapar, geçerli çifti korur", () => {
    const answer = `a\uD83Db\uDE00c${EMOJI}`;

    expect(toSyncAnswer(answer)).toBe(`a�b�c${EMOJI}`);
  });
});

describe("toSyncRecord", () => {
  it("cevabı temizler, diğer alanlara dokunmaz", () => {
    const record = recordWith("a".repeat(MAX_ANSWER_LENGTH + 1));

    const synced = toSyncRecord(record);

    expect(synced.attempts[0].answer).toHaveLength(MAX_ANSWER_LENGTH);
    expect({ ...synced.attempts[0], answer: "" }).toEqual({ ...record.attempts[0], answer: "" });
    expect({ ...synced, attempts: [] }).toEqual({ ...record, attempts: [] });
  });

  it("yereldeki kaydı değiştirmez", () => {
    const long = "a".repeat(MAX_ANSWER_LENGTH + 1);
    const record = recordWith(long);

    toSyncRecord(record);

    expect(record.attempts[0].answer).toBe(long);
  });
});
