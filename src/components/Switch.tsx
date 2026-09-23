import { useId } from "react";

import styles from "./Switch.module.css";

/* ------------------------------------------------------------------ */
/* Anahtar — çıplak checkbox yerine, açık/kapalı durumu görsel taşır    */
/* ------------------------------------------------------------------ */

export type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** Anahtarın altındaki açıklama gibi ek metnin id'si; ekran okuyucu etiketten sonra okur. */
  describedBy?: string;
};

/**
 * label, htmlFor ile button'a bağlı: metne tıklamak da anahtarı tetikler
 * (button "labelable" bir öğe, tarayıcı tıklamayı kendisi iletir).
 * Sarmalayan label yerine açık bağ: VoiceOver role="switch" taşıyan bir
 * button'da örtük label'ı her zaman okumuyor.
 */
export function Switch({ checked, onChange, label, describedBy }: SwitchProps) {
  const id = useId();

  return (
    <span className={styles.row}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={describedBy}
        className={styles.track}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.knob} />
      </button>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
    </span>
  );
}
