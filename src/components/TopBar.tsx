import { AuthArea } from "./AuthArea";
import styles from "./TopBar.module.css";
import { AI_ENABLED } from "../config/features";
import { useSyncStatus } from "../sync/useProgressSync";

/* ------------------------------------------------------------------ */
/* Üst çubuk — marka, aktif havuz büyüklüğü ve (Faz 3'te) YZ kotası     */
/* Sürüm alt bilgide (bkz. Footer).                                     */
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

/**
 * Senkron göstergesinin metni. Üçüncü durum (idle) hiç yazı üretmez:
 * her şey yolundayken gösterilecek bir şey yok.
 */
const SYNC_LABELS = {
  syncing: "senkronlanıyor",
  error: "senkron bekliyor",
} as const;

export function TopBar({ questionCount, quotaRemaining }: TopBarProps) {
  // Misafirde hiç istek atılmadığı için durum "idle" kalır ve gösterge
  // hiç çizilmez; giriş yapmamış kullanıcı senkron diye bir şey görmez.
  const syncStatus = useSyncStatus();

  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <LogoMark />
          <div className={styles.brandText}>
            <span className={styles.name}>Slot</span>
            <span className={styles.tagline}>Teorik soru pratiği</span>
          </div>
        </div>

        <div className={styles.meta}>
          {/*
            Küçük ve sessiz: yerel veri her hâlükârda yazıldı, senkron
            ikinci kopya. Canlı bölge değil — başarısız senkron kullanıcıyı
            kesmeyi hak eden bir olay değil, yalnızca sunucudaki kopyanın
            geride kaldığını söylüyor.
          */}
          {syncStatus !== "idle" && (
            <span className={styles.sync} data-state={syncStatus}>
              {SYNC_LABELS[syncStatus]}
            </span>
          )}
          <span className={styles.pool}>Havuzda {questionCount} soru</span>
          {AI_ENABLED && (
            <div className={styles.quotaBadge}>
              <span className={styles.quotaCount}>{quotaRemaining}</span>
              <span className={styles.quotaLabel}>YZ HAKKI</span>
            </div>
          )}

          {/* Oturum alanı en sağda: kendi durumunu kendi okur, TopBar'a
              prop olarak geçirilmiyor — üst çubuğun geri kalanı oturumla
              ilgilenmiyor. */}
          <AuthArea />
        </div>
      </div>
    </header>
  );
}
