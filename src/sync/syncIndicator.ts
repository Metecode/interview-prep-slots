import type { SyncSnapshot } from "./progressSync";

/* ------------------------------------------------------------------ */
/* Senkron göstergesinin durum makinesi — saf, React bilmez            */
/* ------------------------------------------------------------------ */

/*
  Gösterge sessiz: girişliyken yalnızca soluk bir ikon. Metin üç durumda
  çıkar:
  - "Senkronlanıyor": senkron SYNCING_DELAY_MS'yi aştıysa. Daha kısası hiç
    gösterilmez, her RATE'te titreyen bir yazı olmasın.
  - "Senkronlandı" (SYNCED_TEXT_MS kadar): YALNIZCA kullanıcı
    "Senkronlanıyor"u gördüyse ya da hatadan kurtulunduysa. Rutin hızlı
    senkronda metin çıkmaz.
  - "Senkronlanamadı": kalıcı, bir sonraki başarıda kalkar.

  Canlı bölge daha da az konuşur: yalnızca hataya girişte ve hatadan
  kurtuluşta. "Senkronlanıyor" ve rutin başarılar duyurulmaz.

  Zamanlayıcılar bileşende; burası yalnızca olayları durumlara çevirir.
*/

export const SYNCING_DELAY_MS = 300;
export const SYNCED_TEXT_MS = 3000;

export type IndicatorView = "idle" | "syncing" | "synced" | "error";

export type IndicatorState = {
  /** Son işlenen snapshot; yeni başarıyı lastSyncedAt değişiminden anlarız. */
  seen: SyncSnapshot;
  /** Bu senkron SYNCING_DELAY_MS'yi aştı ve "Senkronlanıyor" gösterildi. */
  syncingVisible: boolean;
  /** Son başarıdan beri başarısız bir senkron oldu. */
  failed: boolean;
  syncedTextVisible: boolean;
  /**
   * "Senkronlandı" metni her gösterildiğinde artar; bileşen 3 sn'lik
   * zamanlayıcıyı buna bağlar, üst üste gelen gösterimlerde süre yeniden başlar.
   */
  syncedTextKey: number;
  /** Canlı bölgenin metni. Yalnızca değiştiğinde okunur. */
  announcement: string;
};

export type IndicatorEvent =
  | { type: "snapshot"; snapshot: SyncSnapshot }
  | { type: "syncingDelayElapsed" }
  | { type: "syncedTextElapsed" };

export const ANNOUNCE_FAILED = "Senkronlanamadı";
export const ANNOUNCE_RECOVERED = "Senkronlandı";

export function initialIndicatorState(snapshot: SyncSnapshot): IndicatorState {
  return {
    seen: snapshot,
    syncingVisible: false,
    failed: snapshot.status === "error",
    syncedTextVisible: false,
    syncedTextKey: 0,
    announcement: "",
  };
}

export function indicatorReducer(state: IndicatorState, event: IndicatorEvent): IndicatorState {
  switch (event.type) {
    case "snapshot":
      return applySnapshot(state, event.snapshot);

    case "syncingDelayElapsed":
      // Zamanlayıcı dolarken senkron bitmiş olabilir; o zaman gösterilmez.
      if (state.seen.status !== "syncing" || state.syncingVisible) return state;
      return { ...state, syncingVisible: true };

    case "syncedTextElapsed":
      if (!state.syncedTextVisible) return state;
      return { ...state, syncedTextVisible: false };
  }
}

function applySnapshot(state: IndicatorState, snapshot: SyncSnapshot): IndicatorState {
  if (snapshot === state.seen) return state;

  // Çıkış: senkron modülü son başarıyı sıfırladı. Önceki oturumun hatası
  // ya da metni yeni oturuma taşınmaz.
  if (snapshot.lastSyncedAt === null && state.seen.lastSyncedAt !== null) {
    return initialIndicatorState(snapshot);
  }

  const succeeded = snapshot.lastSyncedAt !== null && snapshot.lastSyncedAt !== state.seen.lastSyncedAt;

  // Render'lar arasında başarı ve ardından bir hata birlikte gelmiş olabilir:
  // son söz hatanın. Hatayla gelen başarı kurtuluş sayılmaz.
  if (succeeded && snapshot.status === "error") {
    return {
      ...state,
      seen: snapshot,
      syncingVisible: false,
      failed: true,
      syncedTextVisible: false,
      announcement: state.failed ? state.announcement : ANNOUNCE_FAILED,
    };
  }

  if (succeeded) {
    const recovered = state.failed;
    const showText = recovered || state.syncingVisible;
    return {
      seen: snapshot,
      // Hemen ardından yeni bir istek başlamış olabilir; onun için 300 ms yeniden sayılır.
      syncingVisible: false,
      failed: false,
      syncedTextVisible: showText || state.syncedTextVisible,
      syncedTextKey: showText ? state.syncedTextKey + 1 : state.syncedTextKey,
      announcement: recovered ? ANNOUNCE_RECOVERED : state.announcement,
    };
  }

  const enteringError = snapshot.status === "error" && !state.failed;
  return {
    ...state,
    seen: snapshot,
    syncingVisible: snapshot.status === "syncing" ? state.syncingVisible : false,
    failed: state.failed || snapshot.status === "error",
    // Hata "Senkronlandı" metnini hemen bastırır.
    syncedTextVisible: enteringError ? false : state.syncedTextVisible,
    announcement: enteringError ? ANNOUNCE_FAILED : state.announcement,
  };
}

/**
 * Ekrana çizilecek hal. Sıra önemli: görünür bir "Senkronlanıyor" hatayı
 * da geçer (kullanıcı yeniden denendiğini görsün), 300 ms'den kısa bir
 * yeniden deneme ise hata ikonunu titretmez.
 */
export function indicatorView(state: IndicatorState): IndicatorView {
  if (state.seen.status === "syncing" && state.syncingVisible) return "syncing";
  if (state.failed) return "error";
  if (state.seen.lastSyncedAt !== null) return "synced";
  return "idle";
}
