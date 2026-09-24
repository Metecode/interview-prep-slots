import type { Store } from "../domain/progress";
import type { StorageAdapter } from "../platform";
import { saveStore } from "./db";

/* ------------------------------------------------------------------ */
/* Yazıcı — kullanıcı bir şey değiştirmedikçe diske dokunmaz           */
/* ------------------------------------------------------------------ */

/*
  App'teki kaydetme efekti ilk render'da da çalışıyor (StrictMode'da iki
  kez). Karşılaştırma yüklenen store'la değil, İLK write çağrısının
  değeriyle yapılıyor: HYDRATE açılışta store'u normalize ediyor (ilk
  kullanımda initialized ve kategoriler, içerikten kalkmış kategori
  adları), yüklenenle kıyaslasaydık kullanıcı hiçbir şey yapmadan yazma
  olurdu. İlk çağrı yalnızca karşılaştırma noktasını kurar; StrictMode'un
  ikinci çağrısı aynı değeri getirir ve yine yazılmaz.

  React bilmez: davranışı React test kütüphanesi olmadan test edilebiliyor.
*/

export type StoreWriter = {
  write(store: Store): Promise<void>;
};

/**
 * enabled false: okuma ya da yedekleme başarısızdı, oturum boyunca hiçbir
 * şey yazılmaz — altta okuyamadığımız gerçek veri olabilir.
 */
export function createStoreWriter(storage: StorageAdapter, options: { enabled: boolean }): StoreWriter {
  let lastJson: string | null = null;

  return {
    async write(store: Store): Promise<void> {
      if (!options.enabled) return;

      // Store hep toStore'dan geliyor, alan sırası sabit: JSON eşitliği yeterli.
      const json = JSON.stringify(store);
      if (lastJson === null) {
        lastJson = json;
        return;
      }
      if (json === lastJson) return;

      lastJson = json;
      // saveStore kendi hatasını yutuyor. Başarısız yazma tekrar denenmez;
      // bir sonraki değişiklik tüm store'u zaten yeniden yazar.
      await saveStore(storage, store);
    },
  };
}
