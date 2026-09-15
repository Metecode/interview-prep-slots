import { useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/* ------------------------------------------------------------------ */
/* Skor sayacı — 0'dan hedefe                                          */
/* ------------------------------------------------------------------ */

/** tokens.css'teki --ease-out eğrisinin sayısal karşılığı. */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * `target` değerine 0'dan sayarak çıkar. Hareket azaltma açıkken hiç
 * saymaz, doğrudan hedefi döndürür.
 *
 * requestAnimationFrame kullanılıyor: setInterval kare hızına uymuyor,
 * düşük skorlarda sayım kekeliyordu.
 */
export function useCountUp(target: number, durationMs = 500): number {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(0);
  const frameRef = useRef(0);

  useEffect(() => {
    if (reduced) return;

    const started = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - started) / durationMs, 1);
      setValue(Math.round(easeOut(t) * target));
      if (t < 1) frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, durationMs, reduced]);

  // Sayım ilk kareye kadar başlamaz; o ana kadar 0 görünür, hedef değil.
  return reduced ? target : value;
}
