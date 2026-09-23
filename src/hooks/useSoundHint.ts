import { useRef, useState } from "react";

import { isAppleTouchDevice, shouldShowSoundHint } from "../domain/soundHint";

/* ------------------------------------------------------------------ */
/* iOS sessiz anahtar ipucunun React tarafı                            */
/*                                                                     */
/* Karar domain/soundHint'te; burası yalnızca "ipucu gösterildi mi"    */
/* tercihini, son açılış zamanını ve ipucunu yeniden başlatan sayacı   */
/* tutuyor.                                                            */
/* ------------------------------------------------------------------ */

/**
 * Sayfa ömrü boyunca değişmez; her render'da user agent okumaya gerek yok.
 * Android ve masaüstünde sessiz anahtar olmadığı için ipucu ve not yalnızca
 * burada true iken görünür.
 */
export const IS_APPLE_TOUCH_DEVICE =
  typeof navigator !== "undefined" && isAppleTouchDevice(navigator);

export type SoundHint = {
  /** Diske yazılır: ipucu bir kez gösterildiyse ilk açılış kuralı bitti. */
  hintShown: boolean;
  /** 0: hiç gösterilmedi. Her artış ipucunu baştan (4 sn) gösterir. */
  hintKey: number;
  /** Ses hoparlör düğmesiyle açıldığında çağrılır. */
  noteSoundEnabled: () => void;
};

export function useSoundHint(initialHintShown: boolean): SoundHint {
  const [hintShown, setHintShown] = useState(initialHintShown);
  const [hintKey, setHintKey] = useState(0);
  const lastEnabledAtRef = useRef<number | null>(null);

  function noteSoundEnabled() {
    if (!IS_APPLE_TOUCH_DEVICE) return;

    const now = Date.now();
    if (shouldShowSoundHint({ hintShown, lastEnabledAt: lastEnabledAtRef.current, now })) {
      setHintKey((key) => key + 1);
      setHintShown(true);
    }
    lastEnabledAtRef.current = now;
  }

  return { hintShown, hintKey, noteSoundEnabled };
}
