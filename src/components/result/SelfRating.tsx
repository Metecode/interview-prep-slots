import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { reviewIntervalDays } from "../../domain/leitner";
import type { Box, SelfRating as Rating } from "../../domain/progress";
import styles from "./SelfRating.module.css";

/* ------------------------------------------------------------------ */
/* Öz-değerlendirme — kutuyu bu belirler, skor değil                   */
/* ------------------------------------------------------------------ */

/** En iyiden en kötüye: kullanıcı önce kendine güvendiği seçeneği görsün. */
const RATINGS: ReadonlyArray<{ rating: Rating; label: string }> = [
  { rating: 2, label: "Biliyordum" },
  { rating: 1, label: "Kısmen" },
  { rating: 0, label: "Bilmiyordum" },
];

/** Aralığın okunur hali. Tek gün "1 gün" değil "yarın" diye yazılır. */
function intervalLabel(days: number): string {
  return days === 1 ? "yarın" : `${days} gün`;
}

/** Seçim çerçevesi göze çarpsın diye kaydı bu kadar geciktiriyoruz. */
const CHOICE_FEEDBACK_MS = 180;

export type SelfRatingProps = {
  /** Sorunun şu anki kutusu; ilk kez soruluyorsa 1. */
  box: Box;
  passed: boolean;
  onRate: (rating: Rating) => void;
  className: string;
  style: CSSProperties;
};

export function SelfRating({ box, passed, onRate, className, style }: SelfRatingProps) {
  const reduced = usePrefersReducedMotion();
  const [chosen, setChosen] = useState<Rating | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tur kapanınca bileşen sökülüyor; bekleyen sayaç kalmasın.
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  function handleChoose(rating: Rating) {
    // İkinci tıklama ilk seçimin kaydını ikiye katlamasın.
    if (chosen !== null) return;
    setChosen(rating);

    if (reduced) {
      onRate(rating);
      return;
    }
    timerRef.current = setTimeout(() => onRate(rating), CHOICE_FEEDBACK_MS);
  }

  return (
    <section className={className} style={style} aria-labelledby="rating-title">
      <h3 className={styles.title} id="rating-title">
        Kendini nasıl değerlendirirsin?
      </h3>
      <p className={styles.note}>
        Sorunun ne zaman tekrar karşına çıkacağını bu seçim belirler.
      </p>

      <div className={styles.ratingButtons}>
        {RATINGS.map(({ rating, label }) => (
          <button
            key={rating}
            type="button"
            className={styles.ratingButton}
            data-chosen={chosen === rating}
            disabled={chosen !== null}
            onClick={() => handleChoose(rating)}
          >
            <span>{label}</span>
            {/* Gerçek veri: seçimin sorunu hangi aralığa taşıdığı. */}
            <span className={styles.ratingInterval}>
              {intervalLabel(reviewIntervalDays(box, rating, passed))}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
