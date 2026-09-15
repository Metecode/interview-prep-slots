import styles from "./Switch.module.css";

/* ------------------------------------------------------------------ */
/* Anahtar — çıplak checkbox yerine, açık/kapalı durumu görsel taşır    */
/* ------------------------------------------------------------------ */

export type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
};

/**
 * label, button'ı sarmalar: metne tıklamak da anahtarı tetikler
 * (button "labelable" bir öğe, tarayıcı tıklamayı kendisi iletir).
 */
export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <label className={styles.row}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={styles.track}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.knob} />
      </button>
      <span>{label}</span>
    </label>
  );
}
