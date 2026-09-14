import { describe, expect, it } from "vitest";

import {
  SIMILARITY_THRESHOLD,
  evaluateLexical,
  evaluateSemantic,
  normalizeTr,
  splitSentences,
} from "./evaluate";
import type { KeyConcept, Question } from "./question";

function makeConcept(over: Partial<KeyConcept> = {}): KeyConcept {
  return {
    id: "kavram-1",
    label: "Kavram 1",
    aliases: ["birinci kavram"],
    anchors: ["Birinci kavramı anlatan yeterince uzun bir çapa cümlesi."],
    ...over,
  };
}

function makeQuestion(over: Partial<Question> = {}): Question {
  return {
    id: "q1",
    category: "sql",
    kind: "definition",
    topic: "Index",
    difficulty: 1,
    prompt: "Test sorusu",
    modelAnswer: "Yeterince uzun bir örnek cevap metni.",
    keyConcepts: [
      makeConcept({ id: "kavram-1", aliases: ["sirali erisim"] }),
      makeConcept({ id: "kavram-2", aliases: ["b-tree"] }),
    ],
    ...over,
  };
}

describe("normalizeTr", () => {
  it("Türkçe karakterleri sadeleştirir", () => {
    expect(normalizeTr("İstanbul Şişli Öğrenci Çığlık Üzüm")).toBe(
      "istanbul sisli ogrenci ciglik uzum",
    );
  });

  it("büyük harfli Türkçe I'yı doğru küçültür", () => {
    // Türkçe olmayan toLowerCase "IŞIK" -> "ışık" değil "i̇şi̇k" gibi bozuk sonuç verir.
    expect(normalizeTr("IŞIK")).toBe("isik");
  });

  it("fazla boşluğu temizler", () => {
    expect(normalizeTr("  çok   boşluklu   metin  ")).toBe("cok bosluklu metin");
  });
});

describe("evaluateLexical", () => {
  it("alias geçen kavramları yakalar, geçmeyeni kaçırır", () => {
    const question = makeQuestion();

    const result = evaluateLexical(question, "burada yalnızca sirali erisim var");

    expect(result.source).toBe("lexical");
    expect(result.hits).toEqual(["kavram-1"]);
    expect(result.missing).toEqual(["kavram-2"]);
  });

  it("boş cevapta hiçbir kavram yakalanmaz", () => {
    const result = evaluateLexical(makeQuestion(), "");

    expect(result.hits).toEqual([]);
    expect(result.missing).toEqual(["kavram-1", "kavram-2"]);
  });

  it("Türkçe normalizasyonla eşleşir", () => {
    const question = makeQuestion({
      keyConcepts: [makeConcept({ id: "k", aliases: ["gömme yuva"] })],
    });

    const result = evaluateLexical(question, "GÖMME YUVA içinde saklanır");

    expect(result.hits).toEqual(["k"]);
  });
});

describe("evaluateSemantic", () => {
  it("eşik üstündeki skoru yakalar", () => {
    const question = makeQuestion();

    const result = evaluateSemantic(question, "cevap metni", {
      "kavram-1": SIMILARITY_THRESHOLD,
      "kavram-2": 0.1,
    });

    expect(result.source).toBe("semantic");
    expect(result.hits).toEqual(["kavram-1"]);
    expect(result.missing).toEqual(["kavram-2"]);
  });

  it("eşik altındaki skoru kaçırılmış sayar", () => {
    const question = makeQuestion();

    // Eşiğin hemen altı: eşitlik değil, kesin küçüklük test ediliyor.
    const result = evaluateSemantic(question, "cevap metni", {
      "kavram-1": SIMILARITY_THRESHOLD - 0.01,
      "kavram-2": 0,
    });

    expect(result.hits).toEqual([]);
    expect(result.missing).toEqual(["kavram-1", "kavram-2"]);
  });

  it("skoru eksik kavramı 0 sayar", () => {
    const question = makeQuestion();

    const result = evaluateSemantic(question, "cevap metni", { "kavram-1": 0.9 });

    expect(result.hits).toEqual(["kavram-1"]);
    expect(result.missing).toEqual(["kavram-2"]);
  });

  it("boş cevapta skorlar yüksek olsa bile hiçbir şey yakalanmaz", () => {
    const question = makeQuestion();

    const result = evaluateSemantic(question, "   ", {
      "kavram-1": 0.99,
      "kavram-2": 0.99,
    });

    expect(result.hits).toEqual([]);
    expect(result.missing).toEqual(["kavram-1", "kavram-2"]);
    expect(result.confidence).toBeUndefined();
  });

  it("confidence en düşük yakalanan skordur", () => {
    const question = makeQuestion();

    const result = evaluateSemantic(question, "cevap metni", {
      "kavram-1": 0.95,
      "kavram-2": 0.8,
    });

    expect(result.confidence).toBe(0.8);
  });

  it("hiçbir kavram yakalanmazsa confidence tanımsızdır", () => {
    const question = makeQuestion();

    const result = evaluateSemantic(question, "cevap metni", {
      "kavram-1": 0.1,
      "kavram-2": 0.2,
    });

    expect(result.confidence).toBeUndefined();
  });
});

describe("splitSentences", () => {
  it("boş metinde hiç cümle döndürmez", () => {
    expect(splitSentences("")).toEqual([]);
  });

  it("noktalamasız tek cümleyi olduğu gibi döndürür", () => {
    expect(splitSentences("noktasız tek cümle")).toEqual(["noktasız tek cümle"]);
  });

  it("çok cümleli metni noktalama sınırından böler", () => {
    const result = splitSentences("Birinci cümle. İkinci cümle! Üçüncü cümle?");

    expect(result).toEqual(["Birinci cümle.", "İkinci cümle!", "Üçüncü cümle?"]);
  });

  it("cümleler arası fazla boşluğu temizler", () => {
    const result = splitSentences("Birinci.    İkinci.");

    expect(result).toEqual(["Birinci.", "İkinci."]);
  });
});
