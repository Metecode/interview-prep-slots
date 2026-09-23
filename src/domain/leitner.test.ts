import { describe, expect, it } from "vitest";

import {
  BOX_INTERVALS_DAYS,
  MAX_ATTEMPTS,
  STAGE_COUNT,
  applyAttempt,
  nextBox,
  nextReviewInLabel,
  nextReviewLabel,
  reviewIntervalDays,
  stageOf,
} from "./leitner";
import type { Attempt, Box, QuestionProgress, SelfRating } from "./progress";

/** Testler tek bir alanı değiştirsin diye varsayılan denemeyi üretir. */
function makeAttempt(over: Partial<Attempt> = {}): Attempt {
  return {
    at: "2026-01-10T09:00:00.000Z",
    answer: "transaction izolasyon seviyeleri",
    hitCount: 2,
    totalConcepts: 3,
    selfRating: 2,
    passed: false,
    ...over,
  };
}

function makeProgress(over: Partial<QuestionProgress> = {}): QuestionProgress {
  return {
    questionId: "sql-index-nedir",
    box: 1,
    lastSeenAt: "2026-01-01T09:00:00.000Z",
    attempts: [],
    ...over,
  };
}

const ALL_BOXES: Box[] = [1, 2, 3, 4, 5];

describe("BOX_INTERVALS_DAYS", () => {
  it("kutu 1..5 için ikişer katlanan aralıklar tutar", () => {
    expect(BOX_INTERVALS_DAYS).toEqual([1, 2, 4, 8, 16]);
  });

  it("her kutu için bir aralık vardır", () => {
    for (const box of ALL_BOXES) {
      expect(BOX_INTERVALS_DAYS[box - 1]).toBeGreaterThan(0);
    }
  });
});

describe("stageOf", () => {
  it("kutu 1'de hiç denenmemiş soru 'Yeni'dir", () => {
    expect(stageOf(1, 0)).toEqual({ level: 1, name: "Yeni" });
  });

  it("kutu 1'de denenmiş soru 'Öğreniliyor'dur", () => {
    expect(stageOf(1, 1)).toEqual({ level: 1, name: "Öğreniliyor" });
    expect(stageOf(1, 7)).toEqual({ level: 1, name: "Öğreniliyor" });
  });

  it("kutu 2..5 aşama adını deneme sayısından bağımsız verir", () => {
    for (const attempts of [0, 1, 10]) {
      expect(stageOf(2, attempts)).toEqual({ level: 2, name: "Öğreniliyor" });
      expect(stageOf(3, attempts)).toEqual({ level: 3, name: "Pekişiyor" });
      expect(stageOf(4, attempts)).toEqual({ level: 4, name: "İyi biliniyor" });
      expect(stageOf(5, attempts)).toEqual({ level: 5, name: "Oturdu" });
    }
  });

  it("dolu nokta sayısı kutuyla aynıdır ve toplamı aşmaz", () => {
    for (const box of ALL_BOXES) {
      expect(stageOf(box, 1).level).toBe(box);
      expect(stageOf(box, 1).level).toBeLessThanOrEqual(STAGE_COUNT);
    }
  });
});

describe("nextReviewInLabel", () => {
  it("kutu 1'de 'yarın' der", () => {
    expect(nextReviewInLabel(1)).toBe("Sonraki tekrar: yarın");
  });

  it("diğer kutularda kutunun aralığını gün olarak yazar", () => {
    expect(nextReviewInLabel(2)).toBe("Sonraki tekrar: 2 gün sonra");
    expect(nextReviewInLabel(3)).toBe("Sonraki tekrar: 4 gün sonra");
    expect(nextReviewInLabel(4)).toBe("Sonraki tekrar: 8 gün sonra");
    expect(nextReviewInLabel(5)).toBe("Sonraki tekrar: 16 gün sonra");
  });
});

describe("nextBox", () => {
  it("rating 0 ise hangi kutuda olursa olsun 1'e düşer", () => {
    for (const box of ALL_BOXES) {
      expect(nextBox(box, 0, false)).toBe(1);
    }
  });

  it("pas geçildiyse rating'e bakmadan 1'e düşer", () => {
    const ratings: SelfRating[] = [0, 1, 2];
    for (const box of ALL_BOXES) {
      for (const rating of ratings) {
        expect(nextBox(box, rating, true)).toBe(1);
      }
    }
  });

  it("rating 1 ise kutu değişmez", () => {
    for (const box of ALL_BOXES) {
      expect(nextBox(box, 1, false)).toBe(box);
    }
  });

  it("rating 2 ise bir kutu ilerler", () => {
    expect(nextBox(1, 2, false)).toBe(2);
    expect(nextBox(2, 2, false)).toBe(3);
    expect(nextBox(3, 2, false)).toBe(4);
    expect(nextBox(4, 2, false)).toBe(5);
  });

  it("kutu 5'te rating 2 tavanı aşmaz", () => {
    expect(nextBox(5, 2, false)).toBe(5);
  });
});

describe("applyAttempt", () => {
  it("kutuyu nextBox kuralına göre günceller", () => {
    const result = applyAttempt(
      makeProgress({ box: 2 }),
      makeAttempt({ selfRating: 2 }),
    );
    expect(result.box).toBe(3);
  });

  it("pas geçilen denemede kutuyu 1'e düşürür", () => {
    const result = applyAttempt(
      makeProgress({ box: 4 }),
      makeAttempt({ selfRating: 2, passed: true }),
    );
    expect(result.box).toBe(1);
  });

  it("lastSeenAt'i denemenin zamanı yapar", () => {
    const attempt = makeAttempt({ at: "2026-03-05T21:30:00.000Z" });
    const result = applyAttempt(makeProgress(), attempt);
    expect(result.lastSeenAt).toBe("2026-03-05T21:30:00.000Z");
  });

  it("questionId'yi korur", () => {
    const result = applyAttempt(makeProgress(), makeAttempt());
    expect(result.questionId).toBe("sql-index-nedir");
  });

  it("denemeyi dizinin sonuna ekler", () => {
    const older = makeAttempt({ at: "2026-01-02T09:00:00.000Z" });
    const newer = makeAttempt({ at: "2026-01-03T09:00:00.000Z" });

    const result = applyAttempt(makeProgress({ attempts: [older] }), newer);

    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[1]).toEqual(newer);
  });

  it("son MAX_ATTEMPTS kaydı tutar, en eskisi düşer", () => {
    const existing = Array.from({ length: MAX_ATTEMPTS }, (_, i) =>
      makeAttempt({ answer: `cevap-${i}` }),
    );
    const fresh = makeAttempt({ answer: "yeni cevap" });

    const result = applyAttempt(makeProgress({ attempts: existing }), fresh);

    expect(result.attempts).toHaveLength(MAX_ATTEMPTS);
    // "cevap-0" düşmüş, "cevap-1" başa gelmiş olmalı.
    expect(result.attempts[0].answer).toBe("cevap-1");
    expect(result.attempts[MAX_ATTEMPTS - 1].answer).toBe("yeni cevap");
  });

  it("gelen ilerlemeyi değiştirmez", () => {
    const progress = makeProgress({ box: 2, attempts: [] });
    applyAttempt(progress, makeAttempt({ selfRating: 2 }));

    expect(progress.box).toBe(2);
    expect(progress.attempts).toHaveLength(0);
    expect(progress.lastSeenAt).toBe("2026-01-01T09:00:00.000Z");
  });
});

describe("reviewIntervalDays", () => {
  it("kutu 1'de biliyordum kutu 2'nin aralığını verir", () => {
    expect(reviewIntervalDays(1, 2)).toBe(2);
  });

  it("kısmen kutuyu korur, aralık aynı kalır", () => {
    expect(reviewIntervalDays(1, 1)).toBe(1);
    expect(reviewIntervalDays(3, 1)).toBe(4);
  });

  it("bilmiyordum her kutuda ilk aralığa düşürür", () => {
    expect(reviewIntervalDays(1, 0)).toBe(1);
    expect(reviewIntervalDays(5, 0)).toBe(1);
  });

  it("biliyordum bir kutu ilerletir", () => {
    expect(reviewIntervalDays(2, 2)).toBe(4);
    expect(reviewIntervalDays(3, 2)).toBe(8);
    expect(reviewIntervalDays(4, 2)).toBe(16);
  });

  it("tavan kutuda biliyordum aralığı büyütmez", () => {
    expect(reviewIntervalDays(5, 2)).toBe(16);
  });

  it("pas geçilen soruda verilen not dikkate alınmaz", () => {
    for (const rating of [0, 1, 2] as const) {
      expect(reviewIntervalDays(4, rating, true)).toBe(1);
    }
  });

  it("her kutu ve not birleşimi tabloda tanımlı bir aralık döndürür", () => {
    for (const box of [1, 2, 3, 4, 5] as const) {
      for (const rating of [0, 1, 2] as const) {
        expect(BOX_INTERVALS_DAYS).toContain(reviewIntervalDays(box, rating));
      }
    }
  });
});

describe("nextReviewLabel", () => {
  it("kutu 2'deki soru için düğme etiketleri", () => {
    expect(nextReviewLabel(2, 2)).toBe("Pekişiyor · 4 gün sonra");
    expect(nextReviewLabel(2, 1)).toBe("Öğreniliyor · 2 gün sonra");
    expect(nextReviewLabel(2, 0)).toBe("Öğreniliyor · yarın");
  });

  it("hedef aşamayı ve aralığı birlikte yazar", () => {
    expect(nextReviewLabel(3, 2)).toBe("İyi biliniyor · 8 gün sonra");
    expect(nextReviewLabel(4, 2)).toBe("Oturdu · 16 gün sonra");
    expect(nextReviewLabel(5, 2)).toBe("Oturdu · 16 gün sonra");
  });

  it("kutu 1'e düşen ya da orada kalan soru 'Yeni' değil 'Öğreniliyor'dur", () => {
    // Değerlendirme kaydedildiği anda soru denenmiş sayılır.
    expect(nextReviewLabel(1, 1)).toBe("Öğreniliyor · yarın");
    expect(nextReviewLabel(1, 0)).toBe("Öğreniliyor · yarın");
  });

  it("pas geçilen soruda not ne olursa olsun ilk aşamaya döner", () => {
    for (const rating of [0, 1, 2] as const) {
      expect(nextReviewLabel(4, rating, true)).toBe("Öğreniliyor · yarın");
    }
  });

  it("yazdığı aşama ve gün stageOf, nextBox ve reviewIntervalDays'in söylediğidir", () => {
    for (const box of ALL_BOXES) {
      for (const rating of [0, 1, 2] as const) {
        const stage = stageOf(nextBox(box, rating, false), 1);
        const days = reviewIntervalDays(box, rating);
        const when = days === 1 ? "yarın" : `${days} gün sonra`;
        expect(nextReviewLabel(box, rating)).toBe(`${stage.name} · ${when}`);
      }
    }
  });
});
