import { z } from "zod";

import { apiFetch } from "../auth/authClient";
import type { Evaluation } from "../domain/question";

/* ------------------------------------------------------------------ */
/* Yapay zekâ istemcisi — React bilmez, saf modül                      */
/* ------------------------------------------------------------------ */

/*
  Yapay zekâ isteğe bağlı bir yol; kelime eşleşmesi her zaman çalışır ve
  kutuyu yine öz-değerlendirme belirler. Buradaki hiçbir hata uygulamayı
  durdurmaz, yalnızca düğmenin altında bir satır olarak görünür.

  Kalan hak sunucuda tutulur (haftalık, kullanıcı başına). İstemci onu
  yalnızca gösterir; diske yazmaz, kendisi düşürmez.
*/

const STATUS_URL = "/api/ai/status";
const EVALUATE_URL = "/api/ai/evaluate";

/** Sunucudaki sınırla aynı (AiService.MAX_ANSWER_CHARS). */
export const MAX_AI_ANSWER_CHARS = 4000;

/** Backend'in AiDtos.StatusResponse kaydıyla birebir. */
const statusResponseSchema = z.object({
  enabled: z.boolean(),
  remaining: z.number().int().min(0),
  weekResetsAt: z.string().datetime(),
});

/** Backend'in AiDtos.EvaluateResponse kaydıyla birebir. */
const evaluateResponseSchema = z.object({
  hits: z.array(z.string()),
  missing: z.array(z.string()),
  feedback: z.string(),
  followUp: z.string(),
  remaining: z.number().int().min(0),
  cached: z.boolean(),
});

const errorResponseSchema = z.object({ code: z.string() });

/* ------------------------------------------------------------------ */
/* Durum — üst çubuk ve sonuç ekranı okur                              */
/* ------------------------------------------------------------------ */

/**
 * guest   — giriş yok; hiç istek atılmaz
 * loading — durum isteniyor
 * error   — durum alınamadı (backend kapalı olabilir)
 * ready   — sunucunun cevabı; enabled false ise özellik sunucuda kapalı
 */
export type AiAvailability =
  | { kind: "guest" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; enabled: boolean; remaining: number; weekResetsAt: string };

const GUEST: AiAvailability = { kind: "guest" };

let availability: AiAvailability = GUEST;
/** Durumun hangi kullanıcı için istendiği; StrictMode'un çift efekti tek istek atsın. */
let loadedFor: string | null = null;

const listeners = new Set<() => void>();

export function subscribeAi(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Aynı durum için aynı nesne: useSyncExternalStore kimliğe bakıyor. */
export function getAiAvailability(): AiAvailability {
  return availability;
}

function publish(next: AiAvailability): void {
  availability = next;
  for (const listener of listeners) listener();
}

/**
 * Giriş yapan kullanıcı için durumu bir kez ister. Aynı kullanıcı için
 * tekrar çağrılırsa istek atılmaz; kalan hak değerlendirme yanıtlarıyla
 * zaten tazeleniyor.
 */
export async function loadAiStatus(userId: string): Promise<void> {
  if (loadedFor === userId) return;
  loadedFor = userId;
  publish({ kind: "loading" });

  try {
    const response = await apiFetch(STATUS_URL);
    const parsed = response.ok
      ? statusResponseSchema.safeParse(await response.json().catch(() => null))
      : null;

    // İstek uçarken çıkış yapıldıysa ya da kullanıcı değiştiyse sonuç eskidir.
    if (loadedFor !== userId) return;

    if (!parsed?.success) {
      console.warn("Yapay zekâ durumu alınamadı:", response.status);
      // Bir sonraki çağrı yeniden denesin.
      loadedFor = null;
      publish({ kind: "error" });
      return;
    }
    publish({ kind: "ready", ...parsed.data });
  } catch (error) {
    if (loadedFor !== userId) return;
    console.warn("Yapay zekâ durumu alınamadı (ağ):", error);
    loadedFor = null;
    publish({ kind: "error" });
  }
}

/** Çıkışta: misafirde durum sorulmaz, sayaç görünmez. */
export function resetAiStatus(): void {
  loadedFor = null;
  if (availability !== GUEST) publish(GUEST);
}

/** Sunucunun son söylediği kalan hak; yalnızca durum hazırsa işlenir. */
function setRemaining(remaining: number): void {
  if (availability.kind !== "ready" || availability.remaining === remaining) return;
  publish({ ...availability, remaining });
}

/* ------------------------------------------------------------------ */
/* Değerlendirme                                                       */
/* ------------------------------------------------------------------ */

/**
 * unavailable   — sağlayıcı yoğun ya da cevap vermiyor (503)
 * bad_response  — sağlayıcının cevabı okunamadı (502)
 * quota_exceeded— haftalık hak bitti
 * rate_limited  — kısa sürede çok istek
 * unauthorized  — oturum yok ya da yenilenemedi
 * failed        — diğer her şey (ağ, beklenmeyen gövde)
 */
export type AiFailure =
  | "unavailable"
  | "bad_response"
  | "quota_exceeded"
  | "rate_limited"
  | "unauthorized"
  | "failed";

export type AiEvaluateResult =
  | { ok: true; evaluation: Evaluation; cached: boolean }
  | { ok: false; reason: AiFailure };

/**
 * Soruyu ve cevabı gönderir; rubrik gönderilmez, sunucu soruyu kendisi
 * yükler. Hata fırlatmaz — AbortError dahil her sonuç bir değer.
 */
export async function evaluateWithAi(
  questionId: string,
  answer: string,
  signal?: AbortSignal,
): Promise<AiEvaluateResult> {
  let response: Response;
  try {
    response = await apiFetch(EVALUATE_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ questionId, answer }),
      signal,
    });
  } catch {
    return { ok: false, reason: "failed" };
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const reason = failureOf(response.status, body);
    if (reason === "quota_exceeded") setRemaining(0);
    return { ok: false, reason };
  }

  const parsed = evaluateResponseSchema.safeParse(body);
  if (!parsed.success) {
    console.warn("Yapay zekâ yanıtı şemaya uymuyor:", parsed.error.issues);
    return { ok: false, reason: "failed" };
  }

  const { remaining, cached, ...result } = parsed.data;
  setRemaining(remaining);
  return { ok: true, cached, evaluation: { source: "ai", ...result } };
}

function failureOf(status: number, body: unknown): AiFailure {
  if (status === 401) return "unauthorized";

  const code = errorResponseSchema.safeParse(body).data?.code;
  switch (code) {
    case "quota_exceeded":
    case "rate_limited":
      return code;
    case "ai_unavailable":
    case "ai_disabled":
      return "unavailable";
    case "ai_bad_response":
      return "bad_response";
    default:
      // Gövdesiz 503 (ör. proxy) de "yoğun" sayılır.
      return status === 503 ? "unavailable" : "failed";
  }
}
