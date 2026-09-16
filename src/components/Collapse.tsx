import type { ReactNode } from "react";

import styles from "./Collapse.module.css";

/* ------------------------------------------------------------------ */
/* Açılır bölüm — kategori seçimi, ayarlar                             */
/* ------------------------------------------------------------------ */

export type CollapseProps = {
  open: boolean;
  /** Açılır bölümü tetikleyen düğmenin aria-controls hedefi. */
  id?: string;
  children: ReactNode;
};

/**
 * Yükseklik animasyonu yerine grid-template-rows 0fr → 1fr geçişi.
 * Yükseklik her karede yeniden düzen tetiklediği için kasıyordu;
 * grid satırı ise içeriğin ölçülmesini bir kez yaptırıyor.
 *
 * İçerik hep DOM'da duruyor (geçişin başlangıç ve bitiş değeri lazım),
 * o yüzden kapalıyken `inert`: klavye ve ekran okuyucu görünmez
 * içeriğe girmez.
 */
export function Collapse({ open, id, children }: CollapseProps) {
  return (
    <div className={styles.collapse} data-open={open} id={id} inert={!open}>
      <div className={styles.inner}>{children}</div>
    </div>
  );
}
