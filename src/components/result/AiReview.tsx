import { useEffect, useId, useRef, useState } from "react";

import { MAX_AI_ANSWER_CHARS } from "../../ai/aiClient";
import type { AiFailure } from "../../ai/aiClient";
import { useAiAvailability } from "../../ai/useAi";
import type { AiRequestState } from "../../ai/useAi";
import { useAuth } from "../../auth/useAuth";
import styles from "./AiReview.module.css";

/* ------------------------------------------------------------------ */
/* Yapay zekâya sor — sonuç ekranının durum çubuğunda                  */
/*                                                                     */
/* İsteğe bağlı yol: kelime eşleşmesi sonucu zaten ekranda. Buradaki    */
/* her hata "kelime eşleşmesi sonucun geçerli" ile biter; kutuyu yine   */
/* öz-değerlendirme belirler.                                           */
/* ------------------------------------------------------------------ */

const CONSENT_TEXT =
  "Cevabın değerlendirme için Google'a gönderilir ve Google ürünlerini geliştirmek için kullanılabilir.";

const FAILURE_TEXT: Record<AiFailure, string> = {
  unavailable: "Yapay zekâ şu an yoğun, kelime eşleşmesi sonucun geçerli.",
  bad_response: "Yapay zekânın yanıtı okunamadı, kelime eşleşmesi sonucun geçerli.",
  quota_exceeded: "Bu haftalık yapay zekâ hakkın doldu.",
  rate_limited: "Çok sık denedin; bir dakika sonra tekrar dene.",
  unauthorized: "Oturumun kapanmış; yapay zekâ için tekrar giriş yap.",
  failed: "Yapay zekâya ulaşılamadı, kelime eşleşmesi sonucun geçerli.",
};

export type AiReviewProps = {
  /** Pas geçilen soruya yapay zekâ harcanmaz. */
  passed: boolean;
  answer: string;
  aiConsent: boolean;
  onConsent: () => void;
  state: AiRequestState;
  onRequest: () => void;
};

export function AiReview({ passed, answer, aiConsent, onConsent, state, onRequest }: AiReviewProps) {
  const { status, login } = useAuth();
  const availability = useAiAvailability();
  const [consentOpen, setConsentOpen] = useState(false);
  const [loginHintOpen, setLoginHintOpen] = useState(false);
  const consentTextId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const askRef = useRef<HTMLButtonElement>(null);

  // Onay açılınca odak onay düğmesine: klavyedeki kullanıcı metni okuyup
  // tek tuşla karar verebilsin.
  useEffect(() => {
    if (consentOpen) confirmRef.current?.focus();
  }, [consentOpen]);

  // Oturum durumu belli değilken ya da özellik sunucuda kapalıyken hiç
  // çizilmez: basınca hiçbir şey yapmayan bir düğme göstermiyoruz.
  if (status === "unknown") return null;
  if (availability.kind === "ready" && !availability.enabled) return null;

  const guest = status !== "authenticated";
  const loading = state.kind === "loading";
  const done = state.kind === "done";
  const quotaEmpty =
    (availability.kind === "ready" && availability.remaining <= 0) ||
    (state.kind === "failed" && state.reason === "quota_exceeded");

  // Kalan hak tek yerde duruyor: üst çubuktaki sayaç. Burada yalnızca
  // düğmenin neden kapalı olduğu yazar.
  const blockedReason = passed
    ? "pas geçilen soruya harcanmaz"
    : guest
      ? null
      : answer.length > MAX_AI_ANSWER_CHARS
        ? "cevap yapay zekâ için çok uzun"
        : quotaEmpty
          ? "bu haftalık hakkın doldu"
          : null;

  function handleAsk() {
    // Yükleme ve sonuç sırasında düğme aria-disabled: disabled olsaydı
    // odaktaki düğme odağı gövdeye düşürür, klavyedeki kullanıcı yerini
    // kaybederdi. Tıklama burada yutulur.
    if (loading || done) return;
    if (guest) {
      setLoginHintOpen(true);
      return;
    }
    if (!aiConsent) {
      setConsentOpen(true);
      return;
    }
    onRequest();
  }

  function handleConfirm() {
    onConsent();
    setConsentOpen(false);
    onRequest();
  }

  function handleCancel() {
    setConsentOpen(false);
    askRef.current?.focus();
  }

  const failure = state.kind === "failed" ? FAILURE_TEXT[state.reason] : null;

  return (
    <>
      <div className={styles.actions}>
        {blockedReason && (
          <span className={quotaEmpty && !passed ? styles.noteWarn : styles.note}>{blockedReason}</span>
        )}
        <button
          ref={askRef}
          type="button"
          className={styles.askButton}
          disabled={blockedReason !== null}
          aria-disabled={loading || done}
          aria-busy={loading}
          onClick={handleAsk}
        >
          {loading ? "Değerlendiriliyor…" : done ? "Yapay zekâ değerlendirdi" : "Yapay zekâya sor"}
        </button>
      </div>

      {/* Canlı bölge hep DOM'da: içerik değişince okunur. Yükleme, sonuç ve
          hata burada duyurulur; sonuç kartı yukarıda kaldığı için ekran
          okuyucu kullanıcısı başka türlü fark etmezdi. */}
      <p className={failure ? styles.message : styles.srOnly} role="status">
        {failure ??
          (loading
            ? "Yapay zekâ değerlendiriyor."
            : done
              ? "Yapay zekâ değerlendirmesi hazır; kavram çipleri güncellendi."
              : "")}
      </p>

      {loginHintOpen && guest && (
        <div className={styles.panel}>
          <p className={styles.panelText}>Yapay zekâ değerlendirmesi için giriş yap.</p>
          <div className={styles.panelActions}>
            <button type="button" className={styles.primaryButton} onClick={login}>
              Giriş yap
            </button>
            <button type="button" className={styles.secondaryButton} onClick={() => setLoginHintOpen(false)}>
              Kapat
            </button>
          </div>
        </div>
      )}

      {consentOpen && (
        <div className={styles.panel} role="group" aria-describedby={consentTextId}>
          <p className={styles.panelText} id={consentTextId}>
            {CONSENT_TEXT}
          </p>
          <div className={styles.panelActions}>
            <button ref={confirmRef} type="button" className={styles.primaryButton} onClick={handleConfirm}>
              Onayla ve gönder
            </button>
            <button type="button" className={styles.secondaryButton} onClick={handleCancel}>
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </>
  );
}
