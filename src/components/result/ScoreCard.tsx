import { useId } from "react";
import type { CSSProperties } from "react";

import { useCountUp } from "../../hooks/useCountUp";
import type { Evaluation, Question } from "../../domain/question";
import { CheckIcon, DashIcon } from "./icons";
import styles from "./ScoreCard.module.css";

/* ------------------------------------------------------------------ */
/* Skor ve kavram eşleşmesi                                            */
/*                                                                     */
/* Varsayılan katman kelime (alias) eşleşmesi. Kullanıcı yapay zekâya  */
/* sorduysa çipler onun kararına göre güncellenir ve "yapay zekâ"       */
/* etiketi çıkar; kutuyu yine öz-değerlendirme belirler.               */
/* ------------------------------------------------------------------ */

/** Uçlar ayrı yazıldı: "0 tanesi" kulağı tırmalıyor. */
function scoreCaption(hitCount: number, total: number): string {
  if (hitCount === 0) return `${total} kavramdan hiçbiri cevabında geçmedi.`;
  if (hitCount === total) return `${total} kavramın tamamı cevabında geçti.`;
  return `${total} kavramdan ${hitCount} tanesi cevabında geçti.`;
}

/**
 * Yapay zekâ kelimeye değil anlama bakıyor; "geçti" yerine "karşıladın"
 * diyor. Puan değil sayım: kaç kavramın karşılandığı.
 */
function aiScoreCaption(hitCount: number, total: number): string {
  if (hitCount === 0) return `Yapay zekâya göre ${total} kavramdan hiçbirini karşılamadın.`;
  if (hitCount === total) return `Yapay zekâya göre ${total} kavramın tamamını karşıladın.`;
  return `Yapay zekâya göre ${total} kavramdan ${hitCount} tanesini karşıladın.`;
}

export type ScoreCardProps = {
  question: Question;
  /** null ise soru pas geçilmiş demektir. */
  evaluation: Evaluation | null;
  /** Yapay zekâ sonucu; varsa çipler ve sayım bundan okunur. */
  aiEvaluation: Evaluation | null;
  className: string;
  style: CSSProperties;
};

export function ScoreCard({ question, evaluation, aiEvaluation, className, style }: ScoreCardProps) {
  /*
    Başlık id'si useId ile üretilir, sabit yazılmaz: sahne geçişi sırasında
    çıkan ve giren panel bir an birlikte DOM'da duruyor (bkz. Stage.tsx) ve
    sabit id o anda iki kez geçiyordu. Yinelenen id'de aria-labelledby'nin
    hangi başlığı gösterdiği belirsiz.
  */
  const titleId = useId();

  const passed = evaluation === null;
  // Pas geçilen soruya yapay zekâ sorulamıyor; ai yalnızca cevap varken dolar.
  const shownEvaluation = aiEvaluation ?? evaluation;
  const hits = shownEvaluation?.hits ?? [];
  const total = question.keyConcepts.length;

  // Pas geçilen soruda sayılacak bir şey yok; sayaç 0'da kalır.
  const shown = useCountUp(passed ? 0 : hits.length);

  return (
    <section className={className} style={style} aria-labelledby={titleId}>
      <h3 className={styles.hidden} id={titleId}>
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
          {passed
            ? "Pas geçtin, soru kutu 1'e düştü."
            : aiEvaluation
              ? aiScoreCaption(hits.length, total)
              : scoreCaption(hits.length, total)}
        </span>
      </div>

      <p className={styles.conceptsLabel}>
        KAVRAM EŞLEŞMESİ
        {aiEvaluation && <span className={styles.aiTag}>yapay zekâ</span>}
      </p>

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

      {aiEvaluation && (aiEvaluation.feedback || aiEvaluation.followUp) && (
        <div className={styles.aiFeedback}>
          {aiEvaluation.feedback && <p className={styles.aiFeedbackText}>{aiEvaluation.feedback}</p>}
          {/* Yalnızca gösterilir; takip sorusuna cevap verme turu henüz yok. */}
          {aiEvaluation.followUp && (
            <p className={styles.aiFollowUp}>
              <span className={styles.aiFollowUpLabel}>Devam sorusu</span>
              {aiEvaluation.followUp}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
