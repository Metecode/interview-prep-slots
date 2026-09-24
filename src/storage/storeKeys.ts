/* ------------------------------------------------------------------ */
/* Depo anahtarları                                                    */
/* ------------------------------------------------------------------ */

/*
  Tüm store tek kayıt. Web'de bu çift IndexedDB'de "mulakat-slot/store"
  anahtarına düşüyor — mevcut kullanıcıların verisi orada, değiştirme.
*/
export const STORE_NS = "mulakat-slot";
export const STORE_KEY = "store";

/**
 * Bozuk kaydın yedekleri: "store.corrupt-<ISO zaman>". ISO biçimi sözlük
 * sırasında zaman sırası olduğu için en eskiyi bulmak düz sıralama.
 */
export const CORRUPT_BACKUP_PREFIX = `${STORE_KEY}.corrupt-`;
