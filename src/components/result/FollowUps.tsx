import type { CSSProperties } from "react";

import { ArrowIcon } from "./icons";
import styles from "./FollowUps.module.css";

/* ------------------------------------------------------------------ */
/* Devam soruları — içerikteki followUps alanından                     */
/*                                                                     */
/* Üretilmiyorlar, yazılmışlar: soruyla birlikte repo'dan geliyorlar.   */
/* Satırlar okunur, tıklanmaz — bağlı bir eylem yok.                    */
/* ------------------------------------------------------------------ */

export type FollowUpsProps = {
  items: readonly string[];
  className: string;
  style: CSSProperties;
};

export function FollowUps({ items, className, style }: FollowUpsProps) {
  return (
    <section className={className} style={style} aria-labelledby="followups-title">
      <h3 className={styles.title} id="followups-title">
        Devam soruları
      </h3>

      <ul className={styles.followList}>
        {items.map((item) => (
          <li key={item} className={styles.followItem}>
            <ArrowIcon className={styles.followArrow} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
