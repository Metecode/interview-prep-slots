import { useEffect, useRef, useState } from "react";

import { buildOwnAiPrompt } from "../../domain/ownAiPrompt";
import type { Question } from "../../domain/question";
import styles from "./AskOwnAi.module.css";

/* ------------------------------------------------------------------ */
/* Kendi yapay zekâna sor — API çağırmaz, panoya kopyalar              */
/*                                                                     */
/* Uygulama yapay zekâ sağlayıcısına bağlanmıyor (bkz. CLAUDE.md).      */
/* Kullanıcı değerlendirme istemini kendi aracına yapıştırır.           */
/* ------------------------------------------------------------------ */

/** "Kopyalandı" geri bildiriminin ekranda kalma süresi. */
const FEEDBACK_MS = 1500;

type CopyState = "idle" | "copied" | "failed";

/**
 * Önce Clipboard API; güvenli olmayan bağlamda (HTTP) ya da izin
 * verilmediğinde yoksa reddedilir. O zaman eski yol: görünmez bir metin
 * alanını seçip execCommand("copy"). İkisi de tutmazsa false.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Aşağıdaki yola düş.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

export type AskOwnAiProps = {
  question: Question;
  /** Kullanıcının gönderdiği cevap. */
  answer: string;
};

export function AskOwnAi({ question, answer }: AskOwnAiProps) {
  const [state, setState] = useState<CopyState>("idle");
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  async function handleCopy() {
    const ok = await copyToClipboard(buildOwnAiPrompt(question, answer));
    setState(ok ? "copied" : "failed");
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setState("idle"), FEEDBACK_MS);
  }

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.button} onClick={handleCopy}>
        {state === "copied" ? "Kopyalandı" : "Kendi yapay zekâna sor"}
      </button>
      <p className={styles.note}>
        ChatGPT, Gemini ya da kullandığın herhangi bir yapay zekâya yapıştırabilirsin.
      </p>
      {/* Düğme metninin değişmesi ekran okuyucuya güvenilir biçimde
          ulaşmıyor; sonuç ayrıca canlı bölgeden duyurulur. */}
      <p className={state === "failed" ? styles.error : styles.srOnly} role="status">
        {state === "copied"
          ? "Değerlendirme istemi panoya kopyalandı."
          : state === "failed"
            ? "Panoya kopyalanamadı; tarayıcın izin vermiyor olabilir."
            : ""}
      </p>
    </div>
  );
}
