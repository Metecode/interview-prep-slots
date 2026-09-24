import type { StorageAdapter } from "../platform";
import { loadStore } from "./db";
import type { LoadResult } from "./db";
import { createStoreWriter } from "./storeWriter";
import type { StoreWriter } from "./storeWriter";

/* ------------------------------------------------------------------ */
/* Açılış — okuma bir kez, yazıcı okumanın sonucuyla                   */
/* ------------------------------------------------------------------ */

/*
  React StrictMode okuma efektini iki kez çalıştırıyor; loadStore yan
  etkili (bozuk kaydı yedekliyor, kurtarılanı yazıyor), iki kez çalışsaydı
  iki yedek ve iki yazma olurdu. Dönen fonksiyon ilk çağrının sözünü
  saklar, sonraki çağrılar aynı sözü alır.

  Yazıcı da okumanın sonucuyla birlikte bir kez kurulur: yazmanın açık
  olup olmadığı ve "son yazılan" karşılaştırması oturum boyunca tek.

  Adapter parametre olarak gelir ve önbellek fabrikanın kapanışında
  yaşar: testler her seferinde yeni bir fabrika kurar, modül durumu yok.
*/

export type StoreStartup = { result: LoadResult; writer: StoreWriter };

export function createStoreStartup(storage: StorageAdapter): () => Promise<StoreStartup> {
  let startup: Promise<StoreStartup> | null = null;

  return function start(): Promise<StoreStartup> {
    if (startup === null) {
      startup = loadStore(storage).then((result) => ({
        result,
        // Okuma ya da yedekleme başarısızsa altta okuyamadığımız gerçek
        // veri olabilir: oturum boyunca yazılmaz.
        writer: createStoreWriter(storage, { enabled: result.status !== "failed" }),
      }));
    }
    return startup;
  };
}
