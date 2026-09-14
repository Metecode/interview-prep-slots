import type { Evaluation, Question } from "./question";

/* ------------------------------------------------------------------ */
/* Değerlendirme — saf katman, model yok                               */
/*                                                                     */
/* Bu dosya hiçbir embedding/model çağrısı yapmaz. evaluateSemantic     */
/* skorları dışarıdan (tarayıcıdaki embedding katmanından) alır; kendi   */
/* içinde yalnızca eşikleme ve Evaluation biçimine dökme var. Böylece    */
/* Vitest'te model indirmeden test edilebiliyor.                        */
/* ------------------------------------------------------------------ */

/**
 * Türkçe karakterleri sadeleştirir, küçük harfe çevirir, fazla boşluğu
 * temizler. Küçük harfe çevirme Türkçe yerel ayarıyla: "I" önce "ı" olur,
 * sonra "i" — Türkçe olmayan bir `toLowerCase` bunu "i̇" yapardı.
 */
export function normalizeTr(text: string): string {
  return text
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Yedek yol: alias eşleşmesi. Embedding hiç yüklenemediğinde ya da
 * kullanıcı çevrimdışıyken buraya düşülür.
 */
export function evaluateLexical(question: Question, answer: string): Evaluation {
  const haystack = normalizeTr(answer);
  const hits: string[] = [];
  const missing: string[] = [];

  for (const concept of question.keyConcepts) {
    const found = concept.aliases.some((alias) => haystack.includes(normalizeTr(alias)));
    if (found) hits.push(concept.id);
    else missing.push(concept.id);
  }

  return { source: "lexical", hits, missing };
}

/**
 * Benzerlik eşiği: bir kavram bu değerin üstünde skor alırsa yakalanmış
 * sayılır. Kalibrasyon seti ile ayarlanacak, şu an yer tutucu.
 */
export const SIMILARITY_THRESHOLD = 0.72;

/**
 * Asıl yol: tarayıcıda embedding ile hesaplanmış kosinüs benzerlikleri.
 * `scores` her keyConcept.id için [0,1] aralığında bir sayı taşır —
 * o kavramın çapa cümleleriyle cevap arasındaki en yüksek benzerlik.
 * Eksik anahtar 0 sayılır: embedding hiç hesaplanmamış bir kavram
 * yakalanmamış demektir.
 */
export function evaluateSemantic(
  question: Question,
  answer: string,
  scores: Record<string, number>,
): Evaluation {
  const hits: string[] = [];
  const missing: string[] = [];
  const hitScores: number[] = [];

  // Boş cevaba karşılık gelen skorlar güvenilir değil (çağıran taraf yine de
  // bir şeyler göndermiş olabilir); kestirmeden hepsi kaçırılmış sayılır.
  const isEmpty = answer.trim().length === 0;

  for (const concept of question.keyConcepts) {
    const score = isEmpty ? 0 : (scores[concept.id] ?? 0);
    if (score >= SIMILARITY_THRESHOLD) {
      hits.push(concept.id);
      hitScores.push(score);
    } else {
      missing.push(concept.id);
    }
  }

  return {
    source: "semantic",
    hits,
    missing,
    // En düşük yakalanan skor: en zayıf eşleşme ne kadar zorlanmış gösterir.
    // Hiç yakalanan yoksa bir güven değeri de yok.
    confidence: hitScores.length > 0 ? Math.min(...hitScores) : undefined,
  };
}

/**
 * Cevabı cümlelere böler; her cümle embedding'e ayrı ayrı verilecek.
 * Kısaltmalardan ("örn.", "v.b.") kaynaklanan yanlış bölünmeler burada
 * ele alınmıyor — embedding kalitesi bundan gerçekten etkilenirse
 * kısaltma listesiyle geri dönülür.
 */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}
