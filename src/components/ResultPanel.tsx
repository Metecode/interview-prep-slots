import type { SelfRating } from "../domain/progress";
import type { Evaluation, Question } from "../domain/question";
import styles from "./QuestionCard.module.css";

/* ------------------------------------------------------------------ */
/* Sonuç paneli — kutuyu kullanıcı belirler, skor yalnızca gösterilir   */
/* ------------------------------------------------------------------ */

/**
 * En iyiden en kötüye: kullanıcı önce kendine güvendiği seçeneği görsün.
 * "Biliyordum" birincil ağırlıkta duruyor, en sık seçilen o olacak.
 */
const RATINGS: ReadonlyArray<{ rating: SelfRating; label: string; primary: boolean }> = [
  { rating: 2, label: "Biliyordum", primary: true },
  { rating: 1, label: "Kısmen", primary: false },
  { rating: 0, label: "Bilmiyordum", primary: false },
];

/** Skorun yanındaki kısa açıklama. Uçlar ayrı yazıldı, "0 tanesi" kulağı tırmalıyor. */
function scoreCaption(hitCount: number, total: number): string {
  if (hitCount === 0) return `${total} kavramdan hiçbiri cevabında geçmedi.`;
  if (hitCount === total) return `${total} kavramın tamamı cevabında geçti.`;
  return `${total} kavramdan ${hitCount} tanesi cevabında geçti.`;
}

export type ResultPanelProps = {
  question: Question;
  /** null ise soru pas geçilmiş demektir. */
  evaluation: Evaluation | null;
  quotaRemaining: number;
  onRate: (rating: SelfRating) => void;
  onAskAi: () => void;
};

export function ResultPanel({
  question,
  evaluation,
  quotaRemaining,
  onRate,
  onAskAi,
}: ResultPanelProps) {
  const passed = evaluation === null;
  const total = question.keyConcepts.length;
  const hits = evaluation?.hits ?? [];

  // Pas geçilen soruya yapay zekâ harcanmaz; kota kullanıcının cebinden çıkıyor.
  const blockedReason = passed
    ? "pas geçilen soruya harcanmaz"
    : quotaRemaining <= 0
      ? "hakkın kalmadı"
      : null;

  return (
    <section className={styles.card}>
      <div className={styles.score}>
        <span className={styles.scoreValue}>{passed ? "—" : `${hits.length}/${total}`}</span>
        <span className={styles.scoreCaption}>
          {passed
            ? "Pas geçtin, soru kutu 1'e düştü."
            : scoreCaption(hits.length, total)}
        </span>
      </div>

      {/* Yakalananlar dolu, kaçırılanlar ince çerçeveli. Pas geçildiyse
          hiçbiri yakalanmış sayılmaz. */}
      <ul className={styles.chips}>
        {question.keyConcepts.map((concept) => (
          <li
            key={concept.id}
            className={
              hits.includes(concept.id) ? `${styles.chip} ${styles.chipHit}` : styles.chip
            }
          >
            {concept.label}
            {/* Geliştirme aracı: ham skor ve yem havuzu baseline'ı (B).
                Karşılaştırmalı eşik ayarı bunsuz yapılamaz. Üretimde derlenmez. */}
            {import.meta.env.DEV && evaluation?.scores?.[concept.id] !== undefined && (
              <span className={styles.chipScore}>
                {" "}
                {evaluation.scores[concept.id].toFixed(2)}
                {evaluation.baseline !== undefined && ` (B ${evaluation.baseline.toFixed(2)})`}
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* Pas geçildiyse okunacak tek şey model cevap; açık başlasın. */}
      <details className={styles.model} open={passed}>
        <summary className={styles.modelSummary}>Model cevap</summary>
        <p className={styles.modelBody}>{question.modelAnswer}</p>
      </details>

      <hr className={styles.divider} />

      <div className={styles.rating}>
        <span className={styles.ratingLabel}>Kendini nasıl değerlendirirsin?</span>
        <div className={styles.ratingButtons}>
          {RATINGS.map(({ rating, label, primary }) => (
            <button
              key={rating}
              type="button"
              className={primary ? styles.primary : styles.secondary}
              onClick={() => onRate(rating)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.ai}>
        <button
          type="button"
          className={styles.secondary}
          disabled={blockedReason !== null}
          onClick={onAskAi}
        >
          Yapay zekâya sor
        </button>
        {/* Kalan hak tek yerde duruyor: makinedeki sayaç penceresi.
            Burada yalnızca düğmenin neden kapalı olduğu yazar. */}
        {blockedReason && <span className={styles.aiNote}>{blockedReason}</span>}
      </div>
    </section>
  );
}
