import { useCallback, useRef, useState } from "react";

import { SignInPanel } from "./SignInPanel";
import styles from "./SignInControl.module.css";
import { useDismiss } from "../hooks/useDismiss";
import type { DismissReason } from "../hooks/useDismiss";

/* ------------------------------------------------------------------ */
/* "Giriş yap" düğmesi ve altındaki panel                              */
/* ------------------------------------------------------------------ */

export type SignInControlProps = {
  onLogin: () => void;
};

const PANEL_ID = "sign-in-panel";

export function SignInControl({ onLogin }: SignInControlProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape'te odak düğmeye döner (kullanıcı klavyedeydi, akışı kopmasın);
  // dışarı tıklamada dönmez, odak zaten tıklanan yere gitti.
  const close = useCallback((reason: DismissReason) => {
    setOpen(false);
    if (reason === "escape") buttonRef.current?.focus();
  }, []);

  useDismiss(open, [panelRef, buttonRef], close);

  return (
    <div className={styles.wrap}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => setOpen((value) => !value)}
      >
        Giriş yap
      </button>

      <SignInPanel open={open} id={PANEL_ID} panelRef={panelRef} onLogin={onLogin} />
    </div>
  );
}
