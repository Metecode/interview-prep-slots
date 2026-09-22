import { AuthArea } from "./AuthArea";
import styles from "./TopBar.module.css";

/* ------------------------------------------------------------------ */
/* Üst çubuk — marka, sürüm, aktif havuz büyüklüğü ve YZ kotası         */
/* ------------------------------------------------------------------ */

export type TopBarProps = {
  /** Aktif kategorilerdeki soru sayısı. */
  questionCount: number;
  quotaRemaining: number;
};

/** Basit bir işaret: kare çerçeve + kol topuzunu andıran nokta. */
function LogoMark() {
  return (
    <svg
      className={styles.logo}
      width="28"
      height="28"
      viewBox="0 0 28 28"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1.5" y="1.5" width="25" height="25" rx="7" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
      <circle cx="14" cy="10.5" r="2.6" fill="var(--accent)" />
      <rect x="8.5" y="16.5" width="11" height="2.4" rx="1.2" fill="var(--accent)" />
    </svg>
  );
}

export function TopBar({ questionCount, quotaRemaining }: TopBarProps) {
  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <LogoMark />
          <div className={styles.brandText}>
            <span className={styles.name}>Mülakat Slot</span>
            <span className={styles.tagline}>Teorik soru pratiği</span>
          </div>
        </div>

        <div className={styles.meta}>
          <span className={styles.version}>v{__APP_VERSION__}</span>
          <span className={styles.pool}>{questionCount} soru</span>
          <div className={styles.quotaBadge}>
            <span className={styles.quotaCount}>{quotaRemaining}</span>
            <span className={styles.quotaLabel}>YZ HAKKI</span>
          </div>

          {/* Oturum alanı en sağda: kendi durumunu kendi okur, TopBar'a
              prop olarak geçirilmiyor — üst çubuğun geri kalanı oturumla
              ilgilenmiyor. */}
          <AuthArea />
        </div>
      </div>
    </header>
  );
}
