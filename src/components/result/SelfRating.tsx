import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { nextReviewLabel } from "../../domain/leitner";
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
  /*
    Başlık id'si useId ile üretilir, sabit yazılmaz: sahne geçişi sırasında
    çıkan ve giren panel bir an birlikte DOM'da duruyor (bkz. Stage.tsx) ve
    sabit id o anda iki kez geçiyordu. Yinelenen id'de aria-labelledby'nin
    hangi başlığı gösterdiği belirsiz.
  */
  const titleId = useId();

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
    <section className={className} style={style} aria-labelledby={titleId}>
      <h3 className={styles.title} id={titleId}>
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
            {/* Gerçek veri: seçimin sorunu hangi aşamaya ve ne zamana
                taşıdığı ("Pekişiyor · 4 gün sonra"). Hesap leitner.ts'te. */}
            <span className={styles.ratingInterval}>
              {nextReviewLabel(box, rating, passed)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
