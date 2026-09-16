import type { Phase } from "../domain/session";
import styles from "./StepIndicator.module.css";

/* ------------------------------------------------------------------ */
/* Adım göstergesi — turun neresindeyiz                                */
/* ------------------------------------------------------------------ */

const STEPS = ["1. Soru", "2. Yanıt", "3. Değerlendirme"] as const;

/**
 * Faz → adım. Makara dönerken de "Soru" adımındayız: kazanan henüz
 * ekrana gelmedi, kullanıcı hâlâ soruyu bekliyor.
 */
function stepOfPhase(phase: Phase): number {
  switch (phase) {
    case "answering":
      return 1;
    case "evaluated":
      return 2;
    default:
      return 0;
  }
}

export type StepIndicatorProps = {
  phase: Phase;
};

export function StepIndicator({ phase }: StepIndicatorProps) {
  const active = stepOfPhase(phase);

  return (
    <nav className={styles.bar} aria-label="Tur adımları">
      {/*
        Kayan gösterge ayrı bir katman: adım değişince `--step` değişiyor,
        işaretçi transform ile bir adımdan diğerine kayıyor. Adım
        düğmelerinin arka planını animasyona sokmak (her birinde ayrı
        geçiş) aynı etkiyi vermiyor, anında atlıyordu.
      */}
      <div className={styles.track} style={{ "--step": active } as React.CSSProperties}>
        <span className={styles.marker} aria-hidden="true" />
        <ol className={styles.steps}>
          {STEPS.map((label, index) => (
            <li
              key={label}
              className={styles.step}
              /* geçmiş / şimdi / gelecek — renk farkı buradan sürülüyor */
              data-state={index === active ? "active" : index < active ? "done" : "next"}
              aria-current={index === active ? "step" : undefined}
            >
              {label}
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
