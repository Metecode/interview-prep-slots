import { useEffect, useState } from "react";

import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/* ------------------------------------------------------------------ */
/* Ekran geçişi — sökülen içeriği çıkış animasyonu kadar ayakta tutar  */
/* ------------------------------------------------------------------ */

/**
 * `key` değiştiğinde, bir önceki `value`'yu `holdMs` boyunca döndürmeye
 * devam eder. Çağıran taraf eskisini ve yenisini birlikte render ederse
 * biri sönerken diğeri girebilir.
 *
 * Eski değer state'te tutuluyor, ref'te değil: sonraki render'lar üstüne
 * yazmasın, çıkan içerik sönerken değişmesin.
 *
 * Hareket azaltma açıkken çıkış hiç beklenmez, eski içerik anında gider.
 */
export function useExitTransition<T>(key: string, value: T, holdMs: number): T | null {
  const reduced = usePrefersReducedMotion();
  const [previous, setPrevious] = useState({ key, value });
  // Sarmalayıcı nesne: arka arkaya aynı değerle geçiş olsa bile kimlik
  // değişsin, aşağıdaki efekt sayacı yeniden kursun.
  const [exiting, setExiting] = useState<{ value: T } | null>(null);

  // Render sırasında düzeltme: prop değişince state'i uyarlamanın React
  // tarafından önerilen yolu bu. Efekte alınsaydı bir kare geç kalırdı,
  // çıkan içerik bir an tamamen kaybolurdu.
  if (previous.key !== key) {
    setPrevious({ key, value });
    setExiting(reduced ? null : { value: previous.value });
  }

  useEffect(() => {
    if (!exiting) return;
    const timer = setTimeout(() => setExiting(null), holdMs);
    // Sökülme ve arka arkaya gelen geçişler: bekleyen sayaç kalmasın.
    return () => clearTimeout(timer);
  }, [exiting, holdMs]);

  return exiting ? exiting.value : null;
}
