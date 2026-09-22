import { useEffect } from "react";
import type { RefObject } from "react";

/* ------------------------------------------------------------------ */
/* Açılır kutu kapanışı — dışarı tıklama ve Escape                     */
/* ------------------------------------------------------------------ */

export type DismissReason = "outside" | "escape";

/**
 * `open` doğruyken belgeyi dinler ve kutunun dışında bir şey olduğunda
 * `onDismiss` çağırır. `anchors` kutunun kendisi ve onu açan düğme:
 * düğmeye basmak "dışarı tıklama" sayılmamalı, yoksa kapanıp aynı anda
 * yeniden açılırdı.
 *
 * pointerdown dinleniyor, click değil: fare basılıyken kutu kapanırsa
 * click hiç ulaşmayabiliyor ve tıklama kaybolmuş gibi görünüyor.
 */
export function useDismiss(
  open: boolean,
  anchors: RefObject<HTMLElement | null>[],
  onDismiss: (reason: DismissReason) => void,
): void {
  useEffect(() => {
    if (!open) return;

    function isInside(target: EventTarget | null): boolean {
      if (!(target instanceof Node)) return false;
      return anchors.some((ref) => ref.current?.contains(target) ?? false);
    }

    function onPointerDown(event: PointerEvent) {
      if (!isInside(event.target)) onDismiss("outside");
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss("escape");
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
    // anchors her render'da yeni dizi olur; içindeki ref nesneleri sabit
    // olduğu için diziyi bağımlılığa koymuyoruz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onDismiss]);
}
