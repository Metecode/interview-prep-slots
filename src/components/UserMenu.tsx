import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import styles from "./UserMenu.module.css";
import { useDismiss } from "../hooks/useDismiss";
import type { DismissReason } from "../hooks/useDismiss";
import type { AuthUser } from "../auth/authClient";

/* ------------------------------------------------------------------ */
/* Girmiş kullanıcı — avatar, kullanıcı adı, çıkış ve hesap silme      */
/* ------------------------------------------------------------------ */

export type UserMenuProps = {
  user: AuthUser;
  onLogout: () => void;
  /** Onay diyaloğunu açar; diyalog AuthArea'da. */
  onDeleteAccount: () => void;
};

const MENU_ID = "user-menu";

/**
 * Avatar dairesindeki harf. Array.from kod noktasına göre böler: ilk
 * karakter iki UTF-16 biriminden oluşsa da yarısı alınmaz. toUpperCase
 * yerelden bağımsız, "i" Türkçe "İ"ye dönmez.
 */
function initialOf(username: string): string {
  return (Array.from(username)[0] ?? "?").toUpperCase();
}

export function UserMenu({ user, onLogout, onDeleteAccount }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const logoutRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((reason: DismissReason) => {
    setOpen(false);
    if (reason === "escape") buttonRef.current?.focus();
  }, []);

  useDismiss(open, [menuRef, buttonRef], close);

  // Açılınca odak ilk maddeye gider.
  useEffect(() => {
    if (open) logoutRef.current?.focus();
  }, [open]);

  // Maddeler arasında ↑/↓ ile gezilir, uçlarda başa/sona sarar. Tab da
  // çalışmaya devam ediyor; oklar menü alışkanlığı olanlar için.
  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    if (items.length === 0) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    items[(current + step + items.length) % items.length].focus();
  }

  // Menü kapanıp inert olmadan önce odak tetik düğmesine alınır: diyalog
  // kapanınca tarayıcı odağı açılış anında odaktaki öğeye geri verir,
  // inert bir menü maddesi o öğe olamaz.
  function handleDeleteAccount() {
    setOpen(false);
    buttonRef.current?.focus();
    onDeleteAccount();
  }

  return (
    <div className={styles.wrap}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={MENU_ID}
        // Dar ekranda görünür kullanıcı adı gizleniyor ve avatar aria-hidden;
        // ad buradan gelir. Görünür metni içerdiği için geniş ekranda da
        // etiket ile görünen ad çelişmez (WCAG 2.5.3).
        aria-label={`Hesap menüsü: ${user.username}`}
        onClick={() => setOpen((value) => !value)}
      >
        {/* Avatar süs, ekran okuyucudan gizli. GitHub'dan resim çekilmiyor —
            o istek kullanıcının IP'sini GitHub'a taşırdı; baş harf yetiyor. */}
        <span className={styles.avatar} aria-hidden="true">
          {initialOf(user.username)}
        </span>
        <span className={styles.username}>{user.username}</span>
      </button>

      {/* Panelle aynı kalıp: kapalıyken de DOM'da, inert ve geçişli. */}
      <div
        ref={menuRef}
        id={MENU_ID}
        className={styles.menu}
        data-open={open}
        inert={!open}
        onKeyDown={handleMenuKeyDown}
      >
        {/* Kimin hesabı: dar ekranda tetikte ad görünmüyor, burada her
            genişlikte duruyor. Menü role="menu" değil (düz düğmeler), bu
            yüzden tıklanmayan bir başlık satırı ARIA'ya aykırı değil; ok
            tuşu gezinmesi yalnızca düğmeleri seçtiği için buraya uğramaz. */}
        <p className={styles.heading}>{user.username}</p>
        <button ref={logoutRef} type="button" className={styles.item} onClick={onLogout}>
          Çıkış yap
        </button>
        <button type="button" className={styles.item} onClick={handleDeleteAccount}>
          Hesabı sil
        </button>
      </div>
    </div>
  );
}
