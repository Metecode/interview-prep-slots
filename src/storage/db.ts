import { emptyStore, readStore, storeSchema } from "../domain/progress";
import type { Store } from "../domain/progress";
import { recoveryLoss, salvageStore } from "../domain/salvageStore";
import type { RecoveryLoss } from "../domain/salvageStore";
import type { StorageAdapter } from "../platform";
import { backupCorrupt } from "./corruptBackup";
import { STORE_KEY, STORE_NS } from "./storeKeys";

/* ------------------------------------------------------------------ */
/* Depo — StorageAdapter üzerine ince bir sarmalayıcı                  */
/*                                                                     */
/* Buradaki hiçbir fonksiyon hata fırlatmaz. Depolama çalışmıyorsa      */
/* (özel sekme, dolu kota, kapalı IndexedDB) uygulama yine açılmalı:    */
/* ilerleme kaybolur ama uygulama kaybolmaz.                            */
/*                                                                     */
/* Adapter parametre olarak gelir, burada seçilmez: uygulamada          */
/* platform/index.ts'teki, testlerde bellek gerçeklemesi.              */
/* ------------------------------------------------------------------ */

/**
 * ok: kayıt geçerli. empty: kayıt yok, ilk kullanım.
 * recovered: kayıt bozuktu; yedeklendi, kurtarılanlar ana anahtara yazıldı.
 * failed: depo okunamadı ya da bozuk kayıt yedeklenemedi — bu oturumda
 * diske YAZILMAZ, çünkü altta okuyamadığımız ya da yedekleyemediğimiz
 * gerçek veri olabilir.
 */
export type LoadResult =
  | { status: "ok" | "empty" | "failed"; store: Store }
  | { status: "recovered"; store: Store; loss: RecoveryLoss };

/** İlk okuma ve bir tekrar. Safari'de kapanmış bağlantı gibi geçici hatalar için. */
const READ_ATTEMPTS = 2;

export async function loadStore(storage: StorageAdapter, now: () => Date = () => new Date()): Promise<LoadResult> {
  const read = await readWithRetry(storage);
  if (!read.ok) return { status: "failed", store: emptyStore() };

  if (read.raw === undefined) return { status: "empty", store: emptyStore() };

  const parsed = storeSchema.safeParse(read.raw);
  if (parsed.success) return { status: "ok", store: parsed.data };

  return recoverCorrupt(storage, read.raw, now());
}

async function readWithRetry(storage: StorageAdapter): Promise<{ ok: true; raw: unknown } | { ok: false }> {
  for (let attempt = 1; attempt <= READ_ATTEMPTS; attempt += 1) {
    try {
      return { ok: true, raw: await storage.get<unknown>(STORE_NS, STORE_KEY) };
    } catch (error) {
      console.error(`Depo okunamadı (deneme ${attempt}/${READ_ATTEMPTS}):`, error);
    }
  }
  return { ok: false };
}

/**
 * Sıra kesin: önce ham kayıt yedeklenir, YALNIZCA yedek yazıldıysa
 * kurtarılan store ana anahtara yazılır. Böylece bozuk kayıt her açılışta
 * yeniden kurtarılıp yedeklenmez, uyarı da bir kez görünür.
 */
async function recoverCorrupt(storage: StorageAdapter, raw: unknown, now: Date): Promise<LoadResult> {
  const salvage = salvageStore(raw);
  console.warn(
    `Bozuk kayıt kurtarıldı: ${salvage.keptProgress} ilerleme kaydı korundu, ` +
      `${salvage.droppedProgress} kayıt atıldı` +
      (salvage.progressUnreadable ? " (ilerleme alanı okunamadı)" : "") +
      `, sıfırlanan ayarlar: ${salvage.resetSettings.join(", ") || "yok"}.`,
  );

  const backedUp = await backupCorrupt(storage, raw, now);
  // Yedek yoksa bellekte kurtarılanla devam edilir ama diske dokunulmaz.
  if (!backedUp) return { status: "failed", store: salvage.store };

  // Başarısız olursa saveStore loglar; bir sonraki açılış aynı akışı tekrar
  // çalıştırır, yedek sınırı da tekrarların gürültüsünü sınırlar.
  await saveStore(storage, salvage.store);
  return { status: "recovered", store: salvage.store, loss: recoveryLoss(salvage) };
}

export async function saveStore(storage: StorageAdapter, store: Store): Promise<void> {
  const result = storeSchema.safeParse(store);
  if (!result.success) {
    // Bozuk state diske yazılırsa bir sonraki açılışta okunamaz hale gelir;
    // yazmamak, yanlış yazmaktan iyidir.
    console.error("Geçersiz store yazılmadı:", result.error.issues);
    return;
  }

  try {
    // Ham girdi değil, şemadan geçmiş hali: varsayılanlar uygulanmış olur.
    await storage.set(STORE_NS, STORE_KEY, result.data);
  } catch (error) {
    console.error("IndexedDB'ye yazılamadı:", error);
  }
}

export function exportStore(store: Store): string {
  return JSON.stringify(store, null, 2);
}

/**
 * Dışarıdan gelen JSON'u doğrular. ok false ise dönen store kullanılmamalı;
 * mevcut ilerlemenin korunup korunmayacağına çağıran karar verir.
 */
export function importStore(json: string): { store: Store; ok: boolean } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { store: emptyStore(), ok: false };
  }

  const { store, recovered } = readStore(raw);
  // Açılışta bozuk kayıt salvageStore ile alan alan kurtarılıyor; içeri
  // aktarmada ise bozuk dosya kurtarılmaz, başarısızlıktır.
  return { store, ok: !recovered };
}
