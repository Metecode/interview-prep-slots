import { useEffect, useState } from "react";

/* ------------------------------------------------------------------ */
/* Hareket azaltma tercihi — JS ile sürülen animasyonlar için          */
/* ------------------------------------------------------------------ */

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * CSS tarafında tercih tokens.css'teki süre değişkenleriyle karşılanıyor;
 * bu kanca yalnızca JS'in kendi zamanladığı hareketler için (skor sayacı,
 * ekran geçişinin sökülme gecikmesi) gerekiyor.
 *
 * Tercih oturum ortasında da değişebilir — sistem ayarı açıldığında
 * dinleyici bileşeni yeniden render eder.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const onChange = () => setReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
