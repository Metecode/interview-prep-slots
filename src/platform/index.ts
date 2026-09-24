import { indexedDbAdapter } from "./storage/indexedDbAdapter";
import type { StorageAdapter } from "./storage/StorageAdapter";

/* ------------------------------------------------------------------ */
/* Platform seçimi — tek karar noktası                                 */
/* ------------------------------------------------------------------ */

/*
  Uygulamanın kullandığı depo burada seçilir; modüller kendi adapter'ını
  oluşturmaz. Şimdilik yalnızca web var. Mobil (Capacitor + SQLite)
  geldiğinde seçim burada yapılacak, tüketiciler değişmeyecek.
*/
export const storage: StorageAdapter = indexedDbAdapter;

export type { StorageAdapter } from "./storage/StorageAdapter";
