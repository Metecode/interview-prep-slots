import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { evaluateWithAi, getAiAvailability, loadAiStatus, resetAiStatus, subscribeAi } from "./aiClient";
import type { AiAvailability, AiFailure } from "./aiClient";
import type { Evaluation } from "../domain/question";

/* ------------------------------------------------------------------ */
/* Yapay zekâyı React'e bağlayan kancalar                              */
/* ------------------------------------------------------------------ */

/**
 * Durum modül seviyesinde; üst çubuk ve sonuç ekranı ayrı ayrı okur,
 * App'ten prop olarak inmez (senkron göstergesiyle aynı yaklaşım).
 */
export function useAiAvailability(): AiAvailability {
  return useSyncExternalStore(subscribeAi, getAiAvailability, getAiAvailability);
}

/**
 * Oturum değişince durumu tazeler. Misafirde istek atılmaz. "Bir kez"
 * güvencesi loadAiStatus'ta: StrictMode bu efekti iki kez çalıştırsa da
 * tek istek gider.
 */
export function useAiStatusSync(userId: string | null): void {
  useEffect(() => {
    if (userId === null) {
      resetAiStatus();
      return;
    }
    void loadAiStatus(userId);
  }, [userId]);
}

export type AiRequestState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; evaluation: Evaluation }
  | { kind: "failed"; reason: AiFailure };

/**
 * Tek bir sonuç ekranının yapay zekâ isteği. Ekran kapanınca (tur
 * değerlendirilip yeni soruya geçilince) uçan istek iptal edilir; gelen
 * yanıt artık ekranda olmayan bir soruya yazılmasın.
 */
export function useAiEvaluation(questionId: string, answer: string) {
  const [state, setState] = useState<AiRequestState>({ kind: "idle" });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, []);

  const request = useCallback(async () => {
    // Çift tıklama ikinci istek atmasın.
    if (controllerRef.current) return;

    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ kind: "loading" });

    const result = await evaluateWithAi(questionId, answer, controller.signal);
    if (controller.signal.aborted) return;
    controllerRef.current = null;

    setState(
      result.ok
        ? { kind: "done", evaluation: result.evaluation }
        : { kind: "failed", reason: result.reason },
    );
  }, [questionId, answer]);

  return { state, request };
}
