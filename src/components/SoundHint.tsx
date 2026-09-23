import { useEffect, useState } from "react";

import styles from "./SoundHint.module.css";
import { SOUND_HINT_DURATION_MS } from "../domain/soundHint";

/* ------------------------------------------------------------------ */
/* Sessiz anahtar ipucu — hoparlör düğmesinin yanında, 4 saniyelik     */
/*                                                                     */
/* Kendini kapatır. Yeniden göstermek için çağıran taraf key'i değiştirir; */
/* yeni örnek sayacı baştan başlatır. Canlı bölge (role="status")      */
/* çağıranda sürekli durur: içerikle birlikte eklenen bir canlı bölgeyi */
/* bazı ekran okuyucular okumuyor.                                     */
/* ------------------------------------------------------------------ */

export function SoundHint() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), SOUND_HINT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <p className={styles.root}>
      Ses duymuyorsan telefonunun yanındaki sessiz anahtarını kontrol et.
    </p>
  );
}
