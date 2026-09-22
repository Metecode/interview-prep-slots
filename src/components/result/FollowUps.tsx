import { useId } from "react";
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
  /*
    Başlık id'si useId ile üretilir, sabit yazılmaz: sahne geçişi sırasında
    çıkan ve giren panel bir an birlikte DOM'da duruyor (bkz. Stage.tsx) ve
    sabit id o anda iki kez geçiyordu. Yinelenen id'de aria-labelledby'nin
    hangi başlığı gösterdiği belirsiz.
  */
  const titleId = useId();

  return (
    <section className={className} style={style} aria-labelledby={titleId}>
      <h3 className={styles.title} id={titleId}>
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
