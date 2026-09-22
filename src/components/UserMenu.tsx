import { useCallback, useEffect, useRef, useState } from "react";

import styles from "./UserMenu.module.css";
import { useDismiss } from "../hooks/useDismiss";
import type { DismissReason } from "../hooks/useDismiss";
import type { AuthUser } from "../auth/authClient";

/* ------------------------------------------------------------------ */
/* Girmiş kullanıcı — avatar, kullanıcı adı ve çıkış menüsü            */
/* ------------------------------------------------------------------ */

export type UserMenuProps = {
  user: AuthUser;
  onLogout: () => void;
};

const MENU_ID = "user-menu";

export function UserMenu({ user, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const logoutRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((reason: DismissReason) => {
    setOpen(false);
    if (reason === "escape") buttonRef.current?.focus();
  }, []);

  useDismiss(open, [menuRef, buttonRef], close);

  // Menü tek maddelik; açılınca odak doğrudan o maddeye gider.
  useEffect(() => {
    if (open) logoutRef.current?.focus();
  }, [open]);

  return (
    <div className={styles.wrap}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={MENU_ID}
        onClick={() => setOpen((value) => !value)}
      >
        {/* Avatar süs: kullanıcı adı zaten yanında yazıyor, alt boş kalıyor.
            GitHub'ın .png ucu 20px'i retina ekranda bulanık bırakmasın diye
            iki katı boyutta isteniyor. */}
        <img
          className={styles.avatar}
          src={`https://github.com/${encodeURIComponent(user.username)}.png?size=40`}
          alt=""
          width={20}
          height={20}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        <span className={styles.username}>{user.username}</span>
      </button>

      {/* Panelle aynı kalıp: kapalıyken de DOM'da, inert ve geçişli. */}
      <div ref={menuRef} id={MENU_ID} className={styles.menu} data-open={open} inert={!open}>
        <button ref={logoutRef} type="button" className={styles.item} onClick={onLogout}>
          Çıkış yap
        </button>
      </div>
    </div>
  );
}
