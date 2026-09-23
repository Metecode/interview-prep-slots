import type { SelfRating } from "../../domain/progress";

/* ------------------------------------------------------------------ */
/* Öz-değerlendirme ikonları: ✓ · ◐ · ✕                                */
/*                                                                     */
/* Tek renk, currentColor: düğmenin metin rengini alır, yeni renk       */
/* getirmez. Anlamı etiket taşıyor; ikon yalnızca üç seçeneği bir       */
/* bakışta ayırmaya yarıyor, bu yüzden ekran okuyucudan gizli.          */
/* ------------------------------------------------------------------ */

const SIZE = 16;

export function RatingIcon({ rating }: { rating: SelfRating }) {
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {rating === 2 && <path d="M3 8.5 6.5 12 13 4.5" />}
      {rating === 1 && (
        <>
          <circle cx="8" cy="8" r="5.5" />
          {/* Sol yarı dolu: stroke'suz yarım daire. */}
          <path d="M8 2.5a5.5 5.5 0 0 0 0 11Z" fill="currentColor" stroke="none" />
        </>
      )}
      {rating === 0 && <path d="M4 4l8 8M12 4l-8 8" />}
    </svg>
  );
}
