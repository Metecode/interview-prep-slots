import { describe, expect, it } from "vitest";

import { NEW_QUESTION_WEIGHT, drawQuestion, weightOf } from "./draw";
import type { DrawInput } from "./draw";
import type { Box, QuestionProgress } from "./progress";
import type { Category, Question } from "./question";

const NOW = new Date("2026-02-10T12:00:00.000Z");
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function makeQuestion(id: string, category: Category = "sql"): Question {
  return {
    id,
    category,
    kind: "definition",
    topic: "Index",
    difficulty: 1,
    prompt: `${id} için soru metni`,
    modelAnswer: "Yeterince uzun bir örnek cevap metni.",
    keyConcepts: [
      {
        id: "kavram-1",
        label: "Kavram 1",
        aliases: ["birinci"],
        anchors: ["Birinci kavramı anlatan yeterince uzun çapa cümlesi."],
      },
      {
        id: "kavram-2",
        label: "Kavram 2",
        aliases: ["ikinci"],
        anchors: ["İkinci kavramı anlatan yeterince uzun çapa cümlesi."],
      },
    ],
  };
}

/** `daysAgo` gün önce görülmüş, verilen kutuda bir ilerleme. */
function makeProgress(
  questionId: string,
  box: Box,
  daysAgo: number,
): QuestionProgress {
  return {
    questionId,
    box,
    lastSeenAt: new Date(NOW.getTime() - daysAgo * MS_PER_DAY).toISOString(),
    attempts: [],
  };
}

/**
 * Testlerde tek alanı değiştirmek için varsayılan çekiliş girdisi.
 * Boş kategori listesi artık "hiçbiri" demek; varsayılan girdi bu yüzden
 * makeQuestion'ın varsayılan kategorisini açık tutar.
 */
function makeInput(over: Partial<DrawInput> = {}): DrawInput {
  return {
    questions: [],
    progress: {},
    activeCategories: ["sql"],
    recentIds: [],
    now: NOW,
    rng: () => 0,
    ...over,
  };
}

describe("weightOf", () => {
  const question = makeQuestion("q1");

  it("hiç sorulmamış soruya sabit ağırlık verir", () => {
    expect(weightOf(question, undefined, NOW)).toBe(NEW_QUESTION_WEIGHT);
    expect(weightOf(question, undefined, NOW)).toBe(20);
  });

  it("günü gelmiş soruda ağırlık yalnızca kutudan gelir", () => {
    // 2^(5-box) * 1
    expect(weightOf(question, makeProgress("q1", 1, 1), NOW)).toBe(16);
    expect(weightOf(question, makeProgress("q1", 2, 2), NOW)).toBe(8);
    expect(weightOf(question, makeProgress("q1", 3, 4), NOW)).toBe(4);
    expect(weightOf(question, makeProgress("q1", 4, 8), NOW)).toBe(2);
    expect(weightOf(question, makeProgress("q1", 5, 16), NOW)).toBe(1);
  });

  it("günü gelmemiş soruda gecikme katsayısı 1'in altına inmez", () => {
    // Aralığın yarısı kadar beklenmiş: oran 0.5 ama taban 1.
    expect(weightOf(question, makeProgress("q1", 3, 2), NOW)).toBe(4);
    // Aynı gün görülmüş.
    expect(weightOf(question, makeProgress("q1", 1, 0), NOW)).toBe(16);
  });

  it("gecikme katsayısını 3 ile sınırlar", () => {
    // Kutu 1, aralık 1 gün, 100 gün geçmiş: oran 100 değil 3 sayılır.
    expect(weightOf(question, makeProgress("q1", 1, 100), NOW)).toBe(48);
    expect(weightOf(question, makeProgress("q1", 5, 48), NOW)).toBe(3);
    expect(weightOf(question, makeProgress("q1", 5, 500), NOW)).toBe(3);
  });

  it("gecikme arttıkça ağırlık büyür", () => {
    const due = weightOf(question, makeProgress("q1", 3, 4), NOW);
    const late = weightOf(question, makeProgress("q1", 3, 8), NOW);
    expect(late).toBeGreaterThan(due);
  });

  it("ileri tarihli kayıtta ağırlığı tabana çeker", () => {
    // Saat kaymış olabilir; negatif gecikme ağırlığı bozmamalı.
    expect(weightOf(question, makeProgress("q1", 2, -5), NOW)).toBe(8);
  });

  it("aralık tablosu dışındaki kutuda sonlu sayı döner", () => {
    // Bozuk depo ya da ileri sürümden gelen veri: kutu 9'un aralığı yok,
    // oran NaN'a döner. Ağırlık yine de sayı kalmalı.
    const broken = { ...makeProgress("q1", 1, 1), box: 9 as unknown as Box };

    const weight = weightOf(question, broken, NOW);

    expect(Number.isNaN(weight)).toBe(false);
    expect(Number.isFinite(weight)).toBe(true);
  });

  it("bozuk tarihte sonlu sayı döner", () => {
    const broken: QuestionProgress = {
      ...makeProgress("q1", 1, 1),
      lastSeenAt: "tarih-değil",
    };

    expect(Number.isFinite(weightOf(question, broken, NOW))).toBe(true);
  });
});

describe("drawQuestion", () => {
  it("havuz boşsa null döner", () => {
    expect(drawQuestion(makeInput({ questions: [] }))).toBeNull();
  });

  it("aktif kategoride soru yoksa null döner", () => {
    const result = drawQuestion(
      makeInput({
        questions: [makeQuestion("q1", "sql")],
        activeCategories: ["react"],
      }),
    );
    expect(result).toBeNull();
  });

  it("tek soru varsa rng ne olursa olsun onu döner", () => {
    const only = makeQuestion("q1");
    for (const value of [0, 0.5, 0.999, 1]) {
      const result = drawQuestion(
        makeInput({ questions: [only], rng: () => value }),
      );
      expect(result).toBe(only);
    }
  });

  it("tek soru soğutmadaysa bile onu döner", () => {
    const only = makeQuestion("q1");
    const result = drawQuestion(
      makeInput({ questions: [only], recentIds: ["q1"] }),
    );
    expect(result).toBe(only);
  });

  it("aktif kategori dışındaki soruları eler", () => {
    const sql = makeQuestion("q-sql", "sql");
    const react = makeQuestion("q-react", "react");

    const result = drawQuestion(
      makeInput({
        questions: [sql, react],
        activeCategories: ["react"],
      }),
    );
    expect(result).toBe(react);
  });

  it("activeCategories boşsa hiçbir soru uygun değildir", () => {
    // Sürpriz "hepsi açık" davranışı yok: arayüz kategori seçtirmeli.
    const questions = [
      makeQuestion("q-sql", "sql"),
      makeQuestion("q-react", "react"),
    ];

    const result = drawQuestion(
      makeInput({ questions, activeCategories: [] }),
    );
    expect(result).toBeNull();
  });

  it("activeCategories boşsa soğutma geri dönüşü de havuzu doldurmaz", () => {
    // Soğutma yok sayılsa bile kategori filtresi elemeye devam etmeli.
    const result = drawQuestion(
      makeInput({
        questions: [makeQuestion("q1")],
        activeCategories: [],
        recentIds: ["q1"],
      }),
    );
    expect(result).toBeNull();
  });

  it("recentIds'teki son 3 soruyu eler, daha eskisini elemez", () => {
    const questions = ["q1", "q2", "q3", "q4", "q5"].map((id) =>
      makeQuestion(id),
    );

    // q1 dördüncü sıradan geride kaldı; soğutma yalnızca q2, q3, q4'ü tutar.
    const result = drawQuestion(
      makeInput({
        questions,
        recentIds: ["q1", "q2", "q3", "q4"],
        rng: () => 0,
      }),
    );
    expect(result?.id).toBe("q1");
  });

  it("bütün sorular soğutmadaysa soğutmayı yok sayar", () => {
    const questions = [makeQuestion("q1"), makeQuestion("q2")];

    const result = drawQuestion(
      makeInput({
        questions,
        recentIds: ["q1", "q2"],
        rng: () => 0,
      }),
    );

    expect(result).not.toBeNull();
    expect(result?.id).toBe("q1");
  });

  it("rng 0 verirse havuzun ilk sorusunu seçer", () => {
    const questions = [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3")];
    const result = drawQuestion(makeInput({ questions, rng: () => 0 }));
    expect(result?.id).toBe("q1");
  });

  it("rng 1'e yakınsa havuzun son sorusunu seçer", () => {
    const questions = [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3")];
    const result = drawQuestion(
      makeInput({ questions, rng: () => 0.999999 }),
    );
    expect(result?.id).toBe("q3");
  });

  it("sabit rng ile sonuç determinist", () => {
    const questions = ["q1", "q2", "q3", "q4"].map((id) => makeQuestion(id));
    const input = makeInput({
      questions,
      progress: {
        q1: makeProgress("q1", 5, 16),
        q2: makeProgress("q2", 1, 1),
      },
      rng: () => 0.42,
    });

    const first = drawQuestion(input);
    for (let i = 0; i < 5; i++) {
      expect(drawQuestion(input)).toBe(first);
    }
  });

  it("ağırlıklı seçim kümülatif toplamı doğru böler", () => {
    // q1 kutu 5, günü gelmiş  -> ağırlık 1
    // q2 hiç sorulmamış        -> ağırlık 20
    // toplam 21. rng < 1/21 ise q1, sonrası q2.
    const questions = [makeQuestion("q1"), makeQuestion("q2")];
    const progress = { q1: makeProgress("q1", 5, 16) };

    const low = drawQuestion(
      makeInput({ questions, progress, rng: () => 0.04 }),
    );
    const high = drawQuestion(
      makeInput({ questions, progress, rng: () => 0.05 }),
    );

    expect(low?.id).toBe("q1");
    expect(high?.id).toBe("q2");
  });

  it("ağırlığı yüksek soru düşük olandan daha geniş aralık kaplar", () => {
    // Aynı rng taramasında hiç sorulmamış soru çoğunluğu almalı.
    const questions = [makeQuestion("q1"), makeQuestion("q2")];
    const progress = { q1: makeProgress("q1", 5, 16) };

    const picks = Array.from({ length: 100 }, (_, i) =>
      drawQuestion(makeInput({ questions, progress, rng: () => i / 100 })),
    );
    const q2Count = picks.filter((q) => q?.id === "q2").length;

    expect(q2Count).toBeGreaterThan(90);
  });

  it("bozuk kutu değeri çekilişi kilitlemez", () => {
    const question = makeQuestion("q1");
    const broken = { ...makeProgress("q1", 1, 1), box: 9 as unknown as Box };

    const result = drawQuestion(
      makeInput({ questions: [question], progress: { q1: broken } }),
    );

    expect(result).not.toBeNull();
    expect(result?.id).toBe("q1");
  });

  it("bozuk kutu değeri diğer soruların seçimini bozmaz", () => {
    // NaN sızsaydı kümülatif toplam bozulurdu: döngüdeki hiçbir
    // karşılaştırma tutmaz, rng 0 olsa bile hep son soru dönerdi.
    const questions = [makeQuestion("q1"), makeQuestion("q2")];
    const progress = {
      q2: { ...makeProgress("q2", 1, 1), box: 9 as unknown as Box },
    };

    const result = drawQuestion(makeInput({ questions, progress, rng: () => 0 }));

    expect(result?.id).toBe("q1");
  });

  it("seçilme oranı ağırlıkların payına eşittir", () => {
    // İki soru da tam zamanında görülmüş, yani overdue çarpanı 1.
    // Oranı yalnızca kutu belirler: 2^4 = 16'ya karşı 2^0 = 1.
    const box1 = makeQuestion("q-box1");
    const box5 = makeQuestion("q-box5");
    const progress = {
      "q-box1": makeProgress("q-box1", 1, 1),
      "q-box5": makeProgress("q-box5", 5, 16),
    };

    // Test, ağırlıkların varsayılan değerlerine dayanıyor; önce onu sabitle.
    expect(weightOf(box1, progress["q-box1"], NOW)).toBe(16);
    expect(weightOf(box5, progress["q-box5"], NOW)).toBe(1);

    // rng'yi [0,1) aralığında eşit adımlarla tarat: kümülatif ağırlık
    // üzerinden seçim yapılıyorsa isabet sayısı payla orantılı çıkar.
    const SAMPLES = 1000;
    let tick = 0;
    const input = makeInput({
      questions: [box1, box5],
      progress,
      rng: () => tick++ / SAMPLES,
    });

    let box1Hits = 0;
    for (let i = 0; i < SAMPLES; i++) {
      if (drawQuestion(input)?.id === "q-box1") box1Hits++;
    }

    // rng tarandığı için her değer bir kez kullanıldı, eksiği olmamalı.
    expect(tick).toBe(SAMPLES);

    const ratio = box1Hits / SAMPLES;
    expect(Math.abs(ratio - 16 / 17)).toBeLessThan(0.02);
  });
});
