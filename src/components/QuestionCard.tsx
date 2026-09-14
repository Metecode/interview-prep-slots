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
      <p className={styles.meta}>
        Kutu 1 · ilk kez · {DIFFICULTY_LABELS[question.difficulty]}
      </p>

      <h2 className={styles.question}>{question.prompt}</h2>

      <textarea
        className={styles.answer}
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Cevabını yaz…"
        aria-label="Cevabın"
      />

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
        <button
          type="button"
          className={styles.secondary}
          aria-expanded={hintVisible}
          onClick={() => setHintVisible((visible) => !visible)}
        >
          İpucu
        </button>
        <button type="button" className={styles.link} onClick={onPass}>
          Pas geç
        </button>
      </div>
    </section>
  );
}
