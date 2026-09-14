/// <reference lib="webworker" />

import { pipeline } from "@huggingface/transformers";
import type { FeatureExtractionPipeline } from "@huggingface/transformers";

/* ------------------------------------------------------------------ */
/* Embedding worker — model burada yaşar, ana thread'e sızmaz.          */
/*                                                                      */
/* e5 modelleri asimetrik alma için eğitildi: sorgu ve pasaj farklı      */
/* öneklerle gömülür ("query: " / "passage: "). Bu worker'ın işi tam    */
/* olarak bu ayrımı burada tüketmek — çağıran yalnızca "bu bir sorgu mu, */
/* pasaj mı" der, gerçek önek metnini hiç görmez.                       */
/* ------------------------------------------------------------------ */

export const MODEL_ID = "Xenova/multilingual-e5-small";
/** Model dosyaları değişirse (yeniden dönüştürme vb.) burada elle güncellenir. */
export const MODEL_REVISION = "main";

const QUERY_PREFIX = "query: ";
const PASSAGE_PREFIX = "passage: ";

/**
 * "query": kullanıcının yazdığı cevap (ya da cümleleri) — sorgu tarafı.
 * "passage": bir kavramın çapa cümleleri — pasaj tarafı.
 * Protokolde tek bir "texts" alanı var; hangi önekin uygulanacağını bu
 * alan belirler, çağıran önek metnini hiç bilmez.
 */
export type EmbedKind = "query" | "passage";

export type WorkerRequest =
  | { type: "init" }
  | { type: "embed"; id: string; texts: string[]; kind: EmbedKind };

export type WorkerResponse =
  | { type: "ready"; modelId: string; revision: string }
  | { type: "progress"; loaded: number; total: number }
  | { type: "embedded"; id: string; vectors: number[][] }
  | { type: "error"; message: string };

let extractor: FeatureExtractionPipeline | null = null;
/** init eşzamanlı iki kez çağrılırsa model iki kez indirilmesin diye. */
let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function post(message: WorkerResponse): void {
  self.postMessage(message);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function loadExtractor(): Promise<FeatureExtractionPipeline> {
  if (extractor) return extractor;

  extractorPromise ??= pipeline("feature-extraction", MODEL_ID, {
    revision: MODEL_REVISION,
    // "Quantized": tam hassasiyetin dörtte biri boyut, tarayıcıda indirme
    // ve bellek açısından bunun karşılığı yok denecek kadar küçük.
    dtype: "q8",
    progress_callback: (info) => {
      // Model birden çok dosyadan oluşabilir (tokenizer, config, ağırlıklar);
      // "progress_total" hepsinin toplamı, tek bir loaded/total çifti
      // bildirmek için doğru olan bu, dosya dosya değil.
      if (info.status === "progress_total") {
        post({ type: "progress", loaded: info.loaded, total: info.total });
      }
    },
  });

  extractor = await extractorPromise;
  return extractor;
}

async function handleInit(): Promise<void> {
  try {
    await loadExtractor();
    post({ type: "ready", modelId: MODEL_ID, revision: MODEL_REVISION });
  } catch (error) {
    // Model hiç yüklenemedi (ağ yok, kota doldu, CDN kesintisi). Bu da
    // öngörülen bir yol: çağıran taraf lexical değerlendirmeye düşer.
    // Tekrar denenebilsin diye yarım kalan promise saklanmaz.
    extractorPromise = null;
    post({ type: "error", message: errorMessage(error) });
  }
}

function withPrefix(texts: string[], kind: EmbedKind): string[] {
  const prefix = kind === "query" ? QUERY_PREFIX : PASSAGE_PREFIX;
  return texts.map((text) => prefix + text);
}

async function handleEmbed(id: string, texts: string[], kind: EmbedKind): Promise<void> {
  try {
    if (!extractor) {
      throw new Error('Embedder hazır değil: önce "init" gönderilmeli.');
    }

    const output = await extractor(withPrefix(texts, kind), {
      pooling: "mean",
      normalize: true,
    });

    // tolist() türü kütüphanede any[]; mean pooling sonrası şekil her
    // zaman [metin sayısı, boyut] olduğundan number[][] güvenli.
    post({ type: "embedded", id, vectors: output.tolist() as number[][] });
  } catch (error) {
    post({ type: "error", message: errorMessage(error) });
  }
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;

  switch (message.type) {
    case "init":
      void handleInit();
      return;
    case "embed":
      void handleEmbed(message.id, message.texts, message.kind);
      return;
  }
};
