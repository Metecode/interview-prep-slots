import { emptyStore, readStore, storeSchema } from "../domain/progress";
import type { Store } from "../domain/progress";
import type { StorageAdapter } from "../platform";

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

/*
  Tüm store tek kayıt. Web'de bu çift IndexedDB'de "mulakat-slot/store"
  anahtarına düşüyor — mevcut kullanıcıların verisi orada, değiştirme.
*/
export const STORE_NS = "mulakat-slot";
export const STORE_KEY = "store";

export async function loadStore(storage: StorageAdapter): Promise<{ store: Store; recovered: boolean }> {
  try {
    const raw = await storage.get<unknown>(STORE_NS, STORE_KEY);
    // Anahtar yok: ilk açılış. Kayıp bir şey olmadığı için recovered false.
    if (raw === undefined) return { store: emptyStore(), recovered: false };

    return readStore(raw);
  } catch (error) {
    // IndexedDB hiç açılamadı. recovered'ı true yapmıyoruz: ortada bozulmuş
    // bir kayıt yok, kullanıcıya "ilerlemen okunamadı" demek yanıltıcı olur.
    console.error("IndexedDB okunamadı:", error);
    return { store: emptyStore(), recovered: false };
  }
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
  // readStore bozuk veriyi sessizce boş store'a çeviriyor. Açılışta bu
  // kurtarma; içeri aktarmada başarısızlık.
  return { store, ok: !recovered };
}
