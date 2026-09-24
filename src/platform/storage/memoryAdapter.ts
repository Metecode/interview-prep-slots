import { namespacePrefix, toFlatKey } from "./StorageAdapter";
import type { StorageAdapter } from "./StorageAdapter";

/* ------------------------------------------------------------------ */
/* Bellek gerçeklemesi — testler için                                  */
/* ------------------------------------------------------------------ */

/*
  IndexedDB değerleri yapısal kopya olarak saklar: yazdıktan sonra nesneyi
  değiştirmek kaydı değiştirmez, okunan nesne de depodakiyle aynı referans
  değildir. structuredClone bunu taklit ediyor; taklit etmeseydik paylaşılan
  referansa dayanan bir hata testte yeşil, tarayıcıda kırmızı çıkardı.
*/

export function createMemoryAdapter(): StorageAdapter {
  const data = new Map<string, unknown>();

  function keysInNamespace(ns: string): string[] {
    const prefix = namespacePrefix(ns);
    return [...data.keys()].filter((key) => key.startsWith(prefix));
  }

  return {
    async get<T>(ns: string, key: string): Promise<T | undefined> {
      const flatKey = toFlatKey(ns, key);
      if (!data.has(flatKey)) return undefined;
      return structuredClone(data.get(flatKey)) as T;
    },

    async getAll<T>(ns: string): Promise<Array<{ key: string; value: T }>> {
      const prefix = namespacePrefix(ns);
      return keysInNamespace(ns).map((flatKey) => ({
        key: flatKey.slice(prefix.length),
        value: structuredClone(data.get(flatKey)) as T,
      }));
    },

    async set<T>(ns: string, key: string, value: T): Promise<void> {
      data.set(toFlatKey(ns, key), structuredClone(value));
    },

    async setMany(items: Array<{ ns: string; key: string; value: unknown }>): Promise<void> {
      // Önce hepsi hazırlanır: kopyalanamayan bir değer ya da geçersiz bir
      // ns yarıda patlarsa depoya hiçbir şey yazılmamış olur.
      const prepared = items.map((item) => [toFlatKey(item.ns, item.key), structuredClone(item.value)] as const);
      for (const [flatKey, value] of prepared) data.set(flatKey, value);
    },

    async delete(ns: string, key: string): Promise<void> {
      data.delete(toFlatKey(ns, key));
    },

    async clear(ns?: string): Promise<void> {
      if (ns === undefined) {
        data.clear();
        return;
      }
      for (const flatKey of keysInNamespace(ns)) data.delete(flatKey);
    },
  };
}
