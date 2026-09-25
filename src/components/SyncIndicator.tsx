import { useEffect, useReducer } from "react";

import styles from "./SyncIndicator.module.css";
import { useAuth } from "../auth/useAuth";
import {
  SYNCED_TEXT_MS,
  SYNCING_DELAY_MS,
  indicatorReducer,
  indicatorView,
  initialIndicatorState,
} from "../sync/syncIndicator";
import type { IndicatorView } from "../sync/syncIndicator";
import { useSyncSnapshot } from "../sync/useProgressSync";

/* ------------------------------------------------------------------ */
/* Üst çubuktaki senkron göstergesi                                    */
/* ------------------------------------------------------------------ */

/*
  Sessiz: girişliyken soluk bir ikon, metin yalnızca gerektiğinde (kurallar
  sync/syncIndicator.ts'te). Hata --warn ile değil ikonla ayrışıyor: yerel
  veri zaten yazıldı, senkronun düşmesi arıza değil.

  Misafirde hiç çizilmez; senkron yalnızca hesabı olanın işi.
*/

/** Görünür metin; synced için yalnızca gösterim süresince. */
const VISIBLE_TEXT: Record<IndicatorView, string | null> = {
  idle: null,
  syncing: "Senkronlanıyor",
  synced: "Senkronlandı",
  error: "Senkronlanamadı",
};

/** Metin görünmezken ikonun ne dediği: fareyle title, okuyucuyla gizli metin. */
const QUIET_LABEL: Record<IndicatorView, string> = {
  idle: "Henüz senkronlanmadı",
  syncing: "Senkronlanıyor",
  synced: "Senkronlandı",
  error: "Senkronlanamadı",
};

export function SyncIndicator() {
  const { status } = useAuth();
  const snapshot = useSyncSnapshot();
  const [state, dispatch] = useReducer(indicatorReducer, snapshot, initialIndicatorState);

  // Yeni snapshot render sırasında işlenir (önceki değeri saklama kalıbı):
  // efekt beklenseydi bir kare eski durumla çizilirdi. Birleşmiş render'larda
  // ara durum kaçsa da yeni başarı lastSyncedAt'ten anlaşılıyor.
  if (state.seen !== snapshot) {
    dispatch({ type: "snapshot", snapshot });
  }

  // 300 ms'yi aşan senkron görünür olur; daha kısası hiç titremez.
  const syncingPending = state.seen.status === "syncing" && !state.syncingVisible;
  useEffect(() => {
    if (!syncingPending) return;
    const timer = window.setTimeout(() => dispatch({ type: "syncingDelayElapsed" }), SYNCING_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [syncingPending]);

  // "Senkronlandı" metni birkaç saniye sonra söner, soluk ikon kalır.
  useEffect(() => {
    if (!state.syncedTextVisible) return;
    const timer = window.setTimeout(() => dispatch({ type: "syncedTextElapsed" }), SYNCED_TEXT_MS);
    return () => window.clearTimeout(timer);
  }, [state.syncedTextVisible, state.syncedTextKey]);

  if (status !== "authenticated") return null;

  const view = indicatorView(state);
  const text = view === "synced" && !state.syncedTextVisible ? null : VISIBLE_TEXT[view];

  return (
    <span className={styles.indicator} data-state={view} title={QUIET_LABEL[view]}>
      <SyncIcon view={view} />
      {text ? <span className={styles.text}>{text}</span> : <span className={styles.srOnly}>{QUIET_LABEL[view]}</span>}
      {/* Görünür metinden ayrı: yalnızca hataya girişte ve kurtuluşta
          değişir, rutin senkronlar okunmaz. */}
      <span className={styles.srOnly} aria-live="polite">
        {state.announcement}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Simgeler — currentColor, aria-hidden; anlamı yanındaki metin taşır  */
/* ------------------------------------------------------------------ */

const CLOUD = "M4.6 12.5h6.9a2.9 2.9 0 0 0 .3-5.8 4 4 0 0 0-7.6.9 2.5 2.5 0 0 0 .4 4.9z";

function SyncIcon({ view }: { view: IndicatorView }) {
  return (
    <svg
      className={styles.icon}
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {view === "syncing" && (
        <>
          <path d="M13 8a5 5 0 0 1-8.6 3.5" />
          <path d="M3 8a5 5 0 0 1 8.6-3.5" />
          <path d="M11.8 1.8v2.9H8.9" />
          <path d="M4.2 14.2v-2.9h2.9" />
        </>
      )}
      {view === "synced" && (
        <>
          <path d={CLOUD} />
          <path d="M6.4 9.3 7.6 10.4 9.8 8.2" />
        </>
      )}
      {view === "idle" && <path d={CLOUD} />}
      {view === "error" && (
        <>
          <path d={CLOUD} />
          <path d="M2.5 2.5 13.5 13.5" />
        </>
      )}
    </svg>
  );
}
