import type { CSSProperties } from "react";

import { useCountUp } from "../../hooks/useCountUp";
import type { Evaluation, Question } from "../../domain/question";
import { CheckIcon, DashIcon } from "./icons";
import styles from "./ScoreCard.module.css";

/* ------------------------------------------------------------------ */
/* Skor ve kavram eşleşmesi                                            */
/*                                                                     */
/* Çalışan katman kelime (alias) eşleşmesi; semantik değerlendirme      */
/* projeden çıkarıldı. Başlık bu yüzden "Kavram eşleşmesi".            */
/* ------------------------------------------------------------------ */

/** Uçlar ayrı yazıldı: "0 tanesi" kulağı tırmalıyor. */
function scoreCaption(hitCount: number, total: number): string {
  if (hitCount === 0) return `${total} kavramdan hiçbiri cevabında geçmedi.`;
  if (hitCount === total) return `${total} kavramın tamamı cevabında geçti.`;
  return `${total} kavramdan ${hitCount} tanesi cevabında geçti.`;
}

export type ScoreCardProps = {
  question: Question;
  /** null ise soru pas geçilmiş demektir. */
  evaluation: Evaluation | null;
  className: string;
  style: CSSProperties;
};

export function ScoreCard({ question, evaluation, className, style }: ScoreCardProps) {
  const passed = evaluation === null;
  const hits = evaluation?.hits ?? [];
  const total = question.keyConcepts.length;

  // Pas geçilen soruda sayılacak bir şey yok; sayaç 0'da kalır.
  const shown = useCountUp(passed ? 0 : hits.length);

  return (
    <section className={className} style={style} aria-labelledby="score-title">
      <h3 className={styles.hidden} id="score-title">
        Kavram eşleşmesi
      </h3>

      <div className={styles.score}>
        {/* aria-live yok: panel zaten yeni geliyor, okuyucu baştan okuyor.
            Sayarken her ara değeri duyurmak gürültü olurdu. */}
        <span className={styles.scoreValue}>
          {passed ? "—" : shown}
          {!passed && <span className={styles.scoreTotal}>/{total}</span>}
        </span>
        <span className={styles.scoreCaption}>
          {passed ? "Pas geçtin, soru kutu 1'e düştü." : scoreCaption(hits.length, total)}
        </span>
      </div>

      <p className={styles.conceptsLabel}>KAVRAM EŞLEŞMESİ</p>

      <ul className={styles.chips}>
        {question.keyConcepts.map((concept, index) => {
          const hit = hits.includes(concept.id);
          return (
            <li
              key={concept.id}
              className={`${styles.chip} ${hit ? styles.chipHit : styles.chipMiss}`}
              /* --i: çipler 40ms arayla sırayla belirir */
              style={{ "--i": index } as CSSProperties}
            >
              {hit ? (
                <CheckIcon className={styles.chipIcon} />
              ) : (
                <DashIcon className={styles.chipIcon} />
              )}
              {concept.label}
              {/* Geliştirme aracı: ham skor ve yem havuzu baseline'ı (B).
                  Üretimde derlenmez. */}
              {import.meta.env.DEV && evaluation?.scores?.[concept.id] !== undefined && (
                <span className={styles.chipScore}>
                  {evaluation.scores[concept.id].toFixed(2)}
                  {evaluation.baseline !== undefined &&
                    ` (B ${evaluation.baseline.toFixed(2)})`}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
