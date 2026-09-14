import { cosine, embeddingClient } from "./client";
import { evaluateSemantic, splitSentences } from "../domain/evaluate";
import type { Evaluation, Question } from "../domain/question";

/* ------------------------------------------------------------------ */
/* Semantik değerlendirme — client.ts'i evaluateSemantic'e bağlayan     */
/* tek yer. domain/evaluate.ts saf kalır, bu dosya worker/IndexedDB'ye   */
/* dokunduğu için domain/ dışında duruyor.                              */
/* ------------------------------------------------------------------ */

/**
 * Cevabı embedding ile değerlendirir: cümlelere böler, gömer, her kavramın
 * çapalarıyla karşılaştırıp en yüksek benzerliği alır. Model hazır
 * değilse ya da herhangi bir adım başarısız olursa null döner — SUBMIT
 * akışı bu durumda lexical'a düşer. Model hazırlığı burada sorulmuyor:
 * çağıran zaten yalnızca hazırken çağırıyor, burada tekrar sormak
 * gereksiz bir round-trip olurdu.
 */
export async function evaluateSemanticAnswer(
  question: Question,
  answer: string,
): Promise<Evaluation | null> {
  try {
    const sentences = splitSentences(answer);
    // Embed edecek bir şey yoksa hepsi kaçırılmış sayılır; worker'a
    // boş metin göndermenin bir anlamı yok.
    if (sentences.length === 0) return evaluateSemantic(question, answer, {});

    const [sentenceVectors, anchorVectors] = await Promise.all([
      embeddingClient.embed(sentences),
      embeddingClient.getAnchorVectors(question),
    ]);
    if (!sentenceVectors || !anchorVectors) return null;

    const scores: Record<string, number> = {};
    for (const concept of question.keyConcepts) {
      const anchors = anchorVectors[concept.id] ?? [];
      let best = 0;
      for (const sentenceVector of sentenceVectors) {
        for (const anchorVector of anchors) {
          best = Math.max(best, cosine(sentenceVector, anchorVector));
        }
      }
      scores[concept.id] = best;
    }

    return evaluateSemantic(question, answer, scores);
  } catch {
    // Beklenmedik bir şey patlarsa (ör. bozuk vektör) da lexical'a düşülsün.
    return null;
  }
}
