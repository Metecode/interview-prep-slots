import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

import { STAGE_COUNT, stageOf } from "../domain/leitner";
import type { Box } from "../domain/progress";
import styles from "./StageBadge.module.css";

/* ------------------------------------------------------------------ */
/* Aşama rozeti — kutuyu beş nokta ve bir adla gösterir                */
/*                                                                     */
/* Açıklama bir "toggletip": farede üstüne gelince, klavyede odakta,    */
/* dokunmatikte dokununca açılır. Escape ya da dışarıya dokunmak        */
/* kapatır — iOS Safari düğmeye dokununca odak vermediği için blur'a    */
/* güvenilemiyor, dışarı dokunuşu ayrıca dinleniyor.                    */
/* ------------------------------------------------------------------ */

const EXPLANATION = "Bildikçe soru daha seyrek karşına çıkar.";

/** "5 aşamanın 3.'sü": sıra sayısının okunuşuna göre ek (üçüncüsü, beşincisi). */
const ORDINAL_SUFFIX: Record<Box, string> = { 1: "si", 2: "si", 3: "sü", 4: "sü", 5: "si" };

export type StageBadgeProps = {
  box: Box;
  attemptCount: number;
};

export function StageBadge({ box, attemptCount }: StageBadgeProps) {
  const tipId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const stage = stageOf(box, attemptCount);

  useEffect(() => {
    if (!open) return;
    function handleOutside(event: globalThis.PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [open]);

  // Hover yalnızca farede: dokunmatikte pointerenter dokunuşla birlikte
  // gelir ve açıp kapatmayı tıklamayla çakıştırırdı.
  function handlePointerEnter(event: PointerEvent) {
    if (event.pointerType === "mouse") setOpen(true);
  }

  function handlePointerLeave(event: PointerEvent) {
    if (event.pointerType === "mouse") setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") setOpen(false);
  }

  const ariaLabel = `Aşama: ${stage.name}, ${STAGE_COUNT} aşamanın ${stage.level}.'${ORDINAL_SUFFIX[stage.level]}`;

  return (
    // İpucu kökün çocuğu: fare rozetten ipucuna geçerken kapanmasın.
    <span
      ref={rootRef}
      className={styles.root}
      data-open={open}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className={styles.badge}
        aria-label={ariaLabel}
        aria-describedby={tipId}
        // Dokunuşta açar, kapatmaz: dokunmatikte odak ve tıklama art arda
        // geldiği için bir toggle ipucunu açtığı anda geri kapatırdı.
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <span className={styles.dots} aria-hidden="true">
          {Array.from({ length: STAGE_COUNT }, (_, i) => (
            <span
              key={i}
              className={i < stage.level ? `${styles.dot} ${styles.dotFilled}` : styles.dot}
            />
          ))}
        </span>
        <span aria-hidden="true">{stage.name}</span>
      </button>

      <span role="tooltip" id={tipId} className={styles.tip}>
        {EXPLANATION}
      </span>
    </span>
  );
}
