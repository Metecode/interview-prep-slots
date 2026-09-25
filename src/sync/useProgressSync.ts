import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

import {
  getSyncSnapshot,
  pushChanges,
  resetSync,
  subscribeSync,
  syncAfterLogin,
} from "./progressSync";
import type { ProgressMap, SyncSnapshot } from "./progressSync";

/* ------------------------------------------------------------------ */
/* Senkronun tetiklendiği yer — zamanlayıcı yok, üç olay var           */
/* ------------------------------------------------------------------ */

export type UseProgressSyncOptions = {
  /** Oturumdaki güncel ilerleme; senkron hep bunun üzerinden gider. */
  progress: ProgressMap;
  /** Giriş yapılmadıysa null. Kullanıcı değişirse birleştirme tekrar çalışır. */
  userId: string | null;
  /** Sunucudan dönen birleşmiş sonucu oturuma yazar. */
  onMerged: (merged: ProgressMap) => void;
};

/**
 * Üç tetik: giriş (bir kez birleştirme), değerlendirme (tek soru) ve
 * sekmenin arka plana düşmesi. Periyodik senkron bilerek yok — ilerleme
 * zaten yerelde duruyor, ağa düzenli gitmenin karşılığı yok.
 */
export function useProgressSync({ progress, userId, onMerged }: UseProgressSyncOptions) {
  // Olay dinleyicileri ve zamanlama dışı çağrılar güncel ilerlemeyi ref'ten
  // okur; her ilerleme değişiminde dinleyiciyi söküp takmaya gerek kalmasın.
  const progressRef = useRef(progress);
  const onMergedRef = useRef(onMerged);

  // RATE ile işaretlenen ama henüz gönderilmemiş soru id'leri. Sıradaki
  // render'da (ilerleme güncellendiğinde) boşaltılır.
  const pendingRef = useRef(new Set<string>());
  // Bu sayfa oturumunda dokunulan her soru. Kuyruk değil: yeniden deneme
  // defteri tutmuyoruz, yalnızca sekme kapanırken son bir kez gönderilecek
  // id kümesi. Aynı kaydı iki kez göndermek zararsız, uç idempotent.
  const touchedRef = useRef(new Set<string>());

  useEffect(() => {
    onMergedRef.current = onMerged;
  }, [onMerged]);

  // İlerleme değişince ref tazelenir ve bekleyen id'ler gönderilir.
  // Gönderimi burada yapmak şart: RATE'in hemen ardından çağrılsaydı
  // elimizdeki ilerleme henüz denemeyi işlenmemiş eski hali olurdu.
  useEffect(() => {
    progressRef.current = progress;

    const pending = [...pendingRef.current];
    if (pending.length === 0) return;
    pendingRef.current.clear();

    void pushChanges(progress, pending);
  }, [progress]);

  // Giriş: yereldeki her şeyi gönder, dönen birleşmiş sonucu oturuma yaz.
  // "Bir kez" güvencesi syncAfterLogin'in içinde; StrictMode bu efekti iki
  // kez çalıştırdığında da tek istek gider.
  useEffect(() => {
    if (userId === null) {
      // Çıkış yapıldı; aynı kullanıcı tekrar girerse yeniden birleştirilsin.
      resetSync();
      return;
    }

    void syncAfterLogin(progressRef.current).then((merged) => {
      if (merged) onMergedRef.current(merged);
    });
  }, [userId]);

  // Sekme arka plana düştüğünde son bir gönderim. sendBeacon değil düz
  // fetch: veri zaten yerelde duruyor, gitmezse bir sonraki senkron alır.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== "hidden") return;

      const ids = [...touchedRef.current, ...pendingRef.current];
      if (ids.length === 0) return;
      void pushChanges(progressRef.current, ids);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  /** Değerlendirme kapandıktan sonra çağrılır; tek sorunun ilerlemesi gider. */
  const pushQuestion = useCallback((questionId: string) => {
    pendingRef.current.add(questionId);
    touchedRef.current.add(questionId);
  }, []);

  return { pushQuestion };
}

/**
 * Senkronun o anki durumu ve son başarı zamanı. Üst çubuktaki gösterge
 * bunu okur; ilerlemeyi senkrona bağlayan hook'tan ayrı tutulmasının
 * sebebi göstergenin App'ten prop olarak inmesine gerek olmaması — durum
 * modül seviyesinde, okuyan bileşen kendi okur.
 */
export function useSyncSnapshot(): SyncSnapshot {
  return useSyncExternalStore(subscribeSync, getSyncSnapshot, getSyncSnapshot);
}
