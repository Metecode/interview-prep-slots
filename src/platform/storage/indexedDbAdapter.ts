import { clear, del, delMany, entries, get, keys, set, setMany } from "idb-keyval";

import { namespacePrefix, toFlatKey } from "./StorageAdapter";
import type { StorageAdapter } from "./StorageAdapter";

/* ------------------------------------------------------------------ */
/* Web gerçeklemesi — idb-keyval'ın varsayılan store'u                 */
/* ------------------------------------------------------------------ */

/*
  Özel store AÇILMIYOR, bilerek. Mevcut kullanıcıların verisi idb-keyval
  varsayılanlarında duruyor: DB "keyval-store", object store "keyval",
  index yok. Başka bir DB ya da store adı o veriyi görünmez yapar ve
  taşıma (migration) gerektirirdi.
*/

/** Düz anahtarlar arasından ns'e ait olanlar; getAll ve clear(ns) paylaşır. */
async function keysInNamespace(ns: string): Promise<string[]> {
  const prefix = namespacePrefix(ns);
  const allKeys = await keys();
  return allKeys.filter((key): key is string => typeof key === "string" && key.startsWith(prefix));
}

export const indexedDbAdapter: StorageAdapter = {
  get<T>(ns: string, key: string): Promise<T | undefined> {
    return get<T>(toFlatKey(ns, key));
  },

  async getAll<T>(ns: string): Promise<Array<{ key: string; value: T }>> {
    const prefix = namespacePrefix(ns);
    const all = await entries<IDBValidKey, T>();
    const result: Array<{ key: string; value: T }> = [];
    for (const [flatKey, value] of all) {
      if (typeof flatKey !== "string" || !flatKey.startsWith(prefix)) continue;
      result.push({ key: flatKey.slice(prefix.length), value });
    }
    return result;
  },

  set<T>(ns: string, key: string, value: T): Promise<void> {
    return set(toFlatKey(ns, key), value);
  },

  // idb-keyval'ın setMany'si tüm girdileri tek readwrite transaction'da yazar.
  setMany(items: Array<{ ns: string; key: string; value: unknown }>): Promise<void> {
    return setMany(items.map((item): [IDBValidKey, unknown] => [toFlatKey(item.ns, item.key), item.value]));
  },

  delete(ns: string, key: string): Promise<void> {
    return del(toFlatKey(ns, key));
  },

  async clear(ns?: string): Promise<void> {
    if (ns === undefined) return clear();
    return delMany(await keysInNamespace(ns));
  },
};
