import { get, set } from "idb-keyval";

import type { Question } from "../domain/question";
import type { EmbedKind, WorkerRequest, WorkerResponse } from "../workers/embedder.worker";

/* ------------------------------------------------------------------ */
/* Embedding istemcisi — worker'ı sarar, tembel başlatır                */
/*                                                                      */
/* Hiçbir metot fırlatmaz. Model yüklenemezse (ağ yok, CDN kesintisi,    */
/* worker hiç açılamadı) null döner; çağıran bunu "semantik yol kapalı,  */
/* lexical'a düş" sinyali olarak okur. AI hiçbir zaman zorunlu yol       */
/* değil — bu istemci de aynı kuralı taşır.                             */
/* ------------------------------------------------------------------ */

type Ready = { modelId: string; revision: string };

/**
 * Dışarıdan gözlemlenebilir yükleme durumu — ilerleme çubuğu ve
 * "hazır mı" kontrolü buradan okur. embed()/getAnchorVectors()'ın
 * kendisi bunu kullanmaz, onlar zaten ensureReady()'i bekler.
 */
export type EmbeddingStatus =
  | { state: "idle" }
  | { state: "loading"; loaded: number; total: number }
  | { state: "ready" }
  | { state: "error"; message: string };

type PendingRequest = {
  resolve: (vectors: number[][]) => void;
  reject: (error: Error) => void;
};

let requestCounter = 0;
function nextRequestId(): string {
  requestCounter += 1;
  return `req-${requestCounter}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class EmbeddingClient {
  private worker: Worker | null = null;
  /**
   * Eşzamanlı çağrılar tek bir yüklemeyi paylaşsın diye promise saklanır.
   * Başarısızlık da saklanır — bir kez null'a düşen oturum tekrar
   * denemez, her embed() çağrısında kopan ağı yeniden yoklamak yerine
   * lexical'a düşmüş kalır. Yeniden denemek için sayfa yenilenir.
   */
  private readyPromise: Promise<Ready | null> | null = null;
  private pending = new Map<string, PendingRequest>();

  private status: EmbeddingStatus = { state: "idle" };
  private listeners = new Set<() => void>();

  private setStatus(status: EmbeddingStatus): void {
    this.status = status;
    for (const listener of this.listeners) listener();
  }

  /**
   * useSyncExternalStore ile uyumlu abonelik çifti. İkisi de class field
   * (ok fonksiyonu) olarak tanımlı ki referansları sabit kalsın —
   * her render'da yeni bir fonksiyon üretmek gereksiz yeniden abone
   * olmaya yol açardı.
   */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): EmbeddingStatus => this.status;

  isReady(): boolean {
    return this.status.state === "ready";
  }

  /**
   * Yüklemeyi arka planda başlatır, sonucunu beklemeyi çağırana bırakır.
   * SUBMIT akışı model hazır değilken lexical'a düşerken kullanır: bu
   * turu bekletmeden bir sonraki tur için indirmeyi tetikler.
   */
  preload(): void {
    void this.ensureReady();
  }

  /** Worker'ı başlatır ve "ready" bekler. Yalnızca ilk gerçek kullanımda çağrılır. */
  private ensureReady(): Promise<Ready | null> {
    this.readyPromise ??= new Promise<Ready | null>((resolve) => {
      this.setStatus({ state: "loading", loaded: 0, total: 0 });

      let worker: Worker;
      try {
        worker = new Worker(new URL("../workers/embedder.worker.ts", import.meta.url), {
          type: "module",
        });
      } catch (error) {
        // Worker hiç kurulamadı (ör. modül URL'i çözülemedi).
        this.setStatus({ state: "error", message: errorMessage(error) });
        resolve(null);
        return;
      }

      this.worker = worker;

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        this.handleMessage(event.data, resolve);
      };
      // Worker'ın kendisi çökerse (mesaj protokolünün dışında) hiç
      // "error" mesajı gelmeyebilir; bu da yükleme başarısızlığı sayılır.
      worker.onerror = () => {
        const message = "Embedding worker çöktü";
        this.setStatus({ state: "error", message });
        this.failAllPending(new Error(message));
        resolve(null);
      };

      const init: WorkerRequest = { type: "init" };
      worker.postMessage(init);
    });

    return this.readyPromise;
  }

  private handleMessage(
    message: WorkerResponse,
    resolveReady: (value: Ready | null) => void,
  ): void {
    switch (message.type) {
      case "ready":
        this.setStatus({ state: "ready" });
        resolveReady({ modelId: message.modelId, revision: message.revision });
        return;

      case "progress":
        this.setStatus({ state: "loading", loaded: message.loaded, total: message.total });
        return;

      case "embedded": {
        const request = this.pending.get(message.id);
        if (!request) return; // Geç gelen ya da eşleşmeyen yanıt yok sayılır.
        this.pending.delete(message.id);
        request.resolve(message.vectors);
        return;
      }

      case "error":
        // init sırasında geldiyse ready null'a çözülür. Sonra geldiyse
        // hangi isteğin patladığını bilemeyiz — protokolde "error"
        // mesajının id'si yok. O an bekleyen her şeyi aynı hatayla
        // düşürmek elimizdeki tek güvenli seçenek.
        this.setStatus({ state: "error", message: message.message });
        resolveReady(null);
        this.failAllPending(new Error(message.message));
        return;
    }
  }

  private failAllPending(error: Error): void {
    for (const request of this.pending.values()) request.reject(error);
    this.pending.clear();
  }

  private request(worker: Worker, texts: string[], kind: EmbedKind): Promise<number[][]> {
    const id = nextRequestId();
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const message: WorkerRequest = { type: "embed", id, texts, kind };
      worker.postMessage(message);
    });
  }

  /**
   * Metinleri "query" tarafı olarak gömer — kullanıcının cevabı ya da
   * cümleleri için. Model yüklenemediyse ya da istek başarısız olduysa
   * null döner, hiçbir zaman fırlatmaz.
   */
  async embed(texts: string[]): Promise<number[][] | null> {
    const ready = await this.ensureReady();
    if (!ready || !this.worker) return null;

    try {
      return await this.request(this.worker, texts, "query");
    } catch {
      return null;
    }
  }

  /**
   * Bir sorunun kavram çapalarını "passage" tarafı olarak gömer.
   * IndexedDB'de model kimliği+sürümüne bağlı bir anahtarla önbelleklenir;
   * model değişirse eski önbellek hiç okunmaz, sessizce yeniden hesaplanır.
   * Aynı nedenle burada da null hiçbir zaman fırlatılmaz.
   */
  async getAnchorVectors(question: Question): Promise<Record<string, number[][]> | null> {
    const ready = await this.ensureReady();
    if (!ready || !this.worker) return null;

    const cacheKey = `anchors/${ready.modelId}@${ready.revision}/${question.id}`;
    const cached = await get<Record<string, number[][]>>(cacheKey).catch(() => undefined);
    if (cached) return cached;

    // Kavram başına ayrı worker turu atmak yerine tüm çapalar tek istekte
    // gömülür, sonra sınırlarından kavramlara geri dilimlenir.
    const allAnchors: string[] = [];
    const boundaries: { conceptId: string; start: number; count: number }[] = [];
    for (const concept of question.keyConcepts) {
      boundaries.push({
        conceptId: concept.id,
        start: allAnchors.length,
        count: concept.anchors.length,
      });
      allAnchors.push(...concept.anchors);
    }

    let flatVectors: number[][];
    try {
      flatVectors = await this.request(this.worker, allAnchors, "passage");
    } catch {
      return null;
    }

    const vectors: Record<string, number[][]> = {};
    for (const { conceptId, start, count } of boundaries) {
      vectors[conceptId] = flatVectors.slice(start, start + count);
    }

    // Önbelleğe yazma başarısız olsa bile (özel sekme, dolu kota) bu
    // turun sonucu kullanılabilir; yalnızca bir sonraki turda tekrar
    // hesaplanır.
    await set(cacheKey, vectors).catch(() => {});
    return vectors;
  }
}

/** Uygulama genelinde tek worker: her çağıran kendi client'ını kurarsa model birden çok kez inebilir. */
export const embeddingClient = new EmbeddingClient();

/**
 * Network Information API standart DOM tipinde yok (deneysel), o yüzden
 * yalnızca burada kullanılan alanlarla elle tanımlanıyor.
 */
type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
};

const SLOW_EFFECTIVE_TYPES = new Set(["slow-2g", "2g", "3g"]);

/**
 * Model indirmeye otomatik başlanmalı mı? Kullanıcı kapattıysa ya da
 * ağ buna uygun değilse hayır. Network Information API her tarayıcıda
 * yok (özellikle Safari) — o durumda bilinmeyeni kısıtlamak yerine
 * indirmeye izin veriyoruz.
 */
export function shouldAutoDownloadModel(disableModelDownload: boolean): boolean {
  if (disableModelDownload) return false;

  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (!connection) return true;

  if (connection.saveData) return false;
  if (connection.effectiveType && SLOW_EFFECTIVE_TYPES.has(connection.effectiveType)) return false;

  return true;
}

/** İki vektör arasındaki kosinüs benzerliği, [-1, 1]. Sıfır vektörde 0 döner. */
export function cosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
