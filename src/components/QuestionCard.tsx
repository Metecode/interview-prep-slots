import { useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import { evaluateLexical } from "../domain/evaluate";
import type { Question } from "../domain/question";
import styles from "./QuestionCard.module.css";

/* ------------------------------------------------------------------ */
/* Soru kartı — cevap burada yazılır                                   */
/* ------------------------------------------------------------------ */

const DIFFICULTY_LABELS: Record<Question["difficulty"], string> = {
  1: "Kolay",
  2: "Orta",
  3: "Zor",
};

/** Sınırlayıcı değil, yalnızca gösterge: 1200'ü aşınca sayaç --warn'a döner. */
const ANSWER_LENGTH_WARN_AT = 1200;

export type QuestionCardProps = {
  question: Question;
  onSubmit: (answer: string) => void;
  onPass: () => void;
};

/**
 * Cevap metni bileşenin kendi state'inde durur. Soru değişince temizlenmesi
 * çağıran tarafın işi: key={question.id} verilir, bileşen yeniden kurulur.
 */
export function QuestionCard({ question, onSubmit, onPass }: QuestionCardProps) {
  const [answer, setAnswer] = useState("");
  const [hintVisible, setHintVisible] = useState(false);

  // İpucu her render'da tazelenir: kullanıcı yazdıkça sıradaki eksik
  // kavrama kayar, aynı ipucunda takılı kalmaz.
  const { missing } = evaluateLexical(question, answer);
  const nextMissing = question.keyConcepts.find((concept) => missing.includes(concept.id));

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
    // Varsayılan davranış satır başı ekler, gönderdikten sonra gereksiz.
    event.preventDefault();
    onSubmit(answer);
  }

  return (
    <section className={styles.card}>
      {/* Kutu ve son görülme şimdilik sabit metin; ilerleme bağlanınca
          gerçek değerle değişecek. */}
      <div className={styles.meta}>
        <span className={styles.metaBadge}>Kutu 1</span>
        <span className={styles.metaBadge}>ilk kez</span>
        <span className={styles.metaBadge}>{DIFFICULTY_LABELS[question.difficulty]}</span>
      </div>

      <h2 className={styles.question}>{question.prompt}</h2>

      <div className={styles.answerWrap}>
        <textarea
          className={styles.answer}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Cevabını yaz…"
          aria-label="Cevabın"
        />
        <span
          className={
            answer.length > ANSWER_LENGTH_WARN_AT
              ? `${styles.charCount} ${styles.charCountOver}`
              : styles.charCount
          }
        >
          {answer.length} / {ANSWER_LENGTH_WARN_AT}
        </span>
      </div>

      {hintVisible && (
        <p className={styles.hint} aria-live="polite">
          {nextMissing
            ? nextMissing.label
            : "Aranan kavramların hepsi cevabında geçiyor."}
        </p>
      )}

      <div className={styles.actions}>
        {/* Boş cevap da gönderilebilir: kullanıcı gerçekten bilmiyor olabilir,
            sonuç paneli zaten 0/5 diyecek. */}
        <button type="button" className={styles.primary} onClick={() => onSubmit(answer)}>
          Gönder
        </button>
        <span className={styles.shortcutHint}>Ctrl + Enter</span>
        <button
          type="button"
          className={styles.secondary}
          aria-expanded={hintVisible}
          onClick={() => setHintVisible((visible) => !visible)}
        >
          İpucu
        </button>
        <button type="button" className={styles.tertiary} onClick={onPass}>
          Pas geç
        </button>
      </div>
    </section>
  );
}
