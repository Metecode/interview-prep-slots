import styles from "./SoundToggle.module.css";

/* ------------------------------------------------------------------ */
/* Ses düğmesi — makinenin sağ üst köşesi                              */
/*                                                                     */
/* aria-pressed ile bir aç/kapa düğmesi; etiket sabit ("Makine sesi"), */
/* durum aria-pressed'den okunur. Etiket duruma göre değişseydi ekran  */
/* okuyucu "sesi aç, basılı değil" gibi çelişkili bir şey okurdu.      */
/* ------------------------------------------------------------------ */

export type SoundToggleProps = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
};

export function SoundToggle({ enabled, onChange }: SoundToggleProps) {
  return (
    <button
      type="button"
      className={styles.root}
      aria-label="Makine sesi"
      aria-pressed={enabled}
      title={enabled ? "Sesi kapat" : "Sesi aç"}
      onClick={() => onChange(!enabled)}
    >
      <svg
        className={styles.icon}
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {/* Hoparlör gövdesi, iki durumda da aynı. */}
        <path d="M2.5 6h2.5l3.5-3v10l-3.5-3H2.5z" />
        {enabled ? (
          <>
            {/* Ses dalgaları */}
            <path d="M10.5 6a2.5 2.5 0 0 1 0 4" />
            <path d="M12 4a5 5 0 0 1 0 8" />
          </>
        ) : (
          // Üstü çizili
          <path d="M2 2l12 12" />
        )}
      </svg>
    </button>
  );
}
