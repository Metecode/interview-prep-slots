import { AuthArea } from "./AuthArea";
import styles from "./TopBar.module.css";
import { useAiAvailability } from "../ai/useAi";
import { useSyncStatus } from "../sync/useProgressSync";

/* ------------------------------------------------------------------ */
/* Üst çubuk — marka, aktif havuz büyüklüğü ve yapay zekâ kotası      */
/* Sürüm alt bilgide (bkz. Footer).                                     */
/* ------------------------------------------------------------------ */

export type TopBarProps = {
  /** Aktif kategorilerdeki soru sayısı. */
  questionCount: number;
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

/** "28 Eylül Pazartesi" gibi; kullanıcının yerel saatine göre. */
function resetLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" });
}

export function TopBar({ questionCount }: TopBarProps) {
  // Misafirde hiç istek atılmadığı için durum "idle" kalır ve gösterge
  // hiç çizilmez; giriş yapmamış kullanıcı senkron diye bir şey görmez.
  const syncStatus = useSyncStatus();
  // Sayaç yalnızca sunucu cevap verdiyse ve özellik açıksa: misafirde,
  // yüklenirken ya da hata varken uydurma bir sayı göstermiyoruz.
  const ai = useAiAvailability();

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
          {ai.kind === "ready" && ai.enabled && (
            <div
              className={styles.quotaBadge}
              title={`Haftalık hak; ${resetLabel(ai.weekResetsAt)} yenilenir`}
            >
              <span className={styles.quotaCount}>{ai.remaining}</span>
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
