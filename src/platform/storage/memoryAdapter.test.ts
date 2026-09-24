import { describe, expect, it } from "vitest";

import { createMemoryAdapter } from "./memoryAdapter";
import { toFlatKey } from "./StorageAdapter";

/* ------------------------------------------------------------------ */
/* StorageAdapter sözleşmesi — bellek gerçeklemesi üzerinden           */
/* ------------------------------------------------------------------ */

describe("toFlatKey", () => {
  it("mevcut kaydın anahtarını üretir", () => {
    // Web'deki kullanıcı verisi bu anahtarda; biçim değişirse veri okunmaz.
    expect(toFlatKey("mulakat-slot", "store")).toBe("mulakat-slot/store");
  });

  it("key içinde ayırıcıya izin verir", () => {
    expect(toFlatKey("ns", "a/b")).toBe("ns/a/b");
  });

  it("ayırıcı içeren ya da boş ns'i reddeder", () => {
    expect(() => toFlatKey("a/b", "c")).toThrow();
    expect(() => toFlatKey("", "c")).toThrow();
  });
});

describe("createMemoryAdapter", () => {
  it("olmayan anahtar için undefined döner", async () => {
    const storage = createMemoryAdapter();
    expect(await storage.get("ns", "yok")).toBeUndefined();
  });

  it("yazılanı okur, namespace'ler birbirine karışmaz", async () => {
    const storage = createMemoryAdapter();
    await storage.set("a", "k", 1);
    await storage.set("b", "k", 2);

    expect(await storage.get("a", "k")).toBe(1);
    expect(await storage.get("b", "k")).toBe(2);
  });

  it("yazılan değerin kopyasını saklar, okunan değer de kopyadır", async () => {
    const storage = createMemoryAdapter();
    const value = { list: [1] };
    await storage.set("ns", "k", value);
    value.list.push(2);

    const read = await storage.get<{ list: number[] }>("ns", "k");
    expect(read).toEqual({ list: [1] });

    read?.list.push(3);
    expect(await storage.get("ns", "k")).toEqual({ list: [1] });
  });

  it("getAll yalnızca o ns'in kayıtlarını, ns öneki olmadan döner", async () => {
    const storage = createMemoryAdapter();
    await storage.set("ns", "a", 1);
    await storage.set("ns", "b/c", 2);
    await storage.set("ns-baska", "a", 3);

    const all = await storage.getAll<number>("ns");
    expect(all).toEqual(
      expect.arrayContaining([
        { key: "a", value: 1 },
        { key: "b/c", value: 2 },
      ]),
    );
    expect(all).toHaveLength(2);
  });

  it("setMany hepsini yazar", async () => {
    const storage = createMemoryAdapter();
    await storage.setMany([
      { ns: "a", key: "x", value: 1 },
      { ns: "b", key: "y", value: 2 },
    ]);

    expect(await storage.get("a", "x")).toBe(1);
    expect(await storage.get("b", "y")).toBe(2);
  });

  it("setMany girdilerden biri geçersizse hiçbirini yazmaz", async () => {
    const storage = createMemoryAdapter();
    await expect(
      storage.setMany([
        { ns: "a", key: "x", value: 1 },
        { ns: "gecersiz/ns", key: "y", value: 2 },
      ]),
    ).rejects.toThrow();

    expect(await storage.get("a", "x")).toBeUndefined();
  });

  it("delete tek kaydı siler", async () => {
    const storage = createMemoryAdapter();
    await storage.set("ns", "a", 1);
    await storage.set("ns", "b", 2);
    await storage.delete("ns", "a");

    expect(await storage.get("ns", "a")).toBeUndefined();
    expect(await storage.get("ns", "b")).toBe(2);
  });

  it("clear(ns) yalnızca o ns'i, clear() her şeyi siler", async () => {
    const storage = createMemoryAdapter();
    await storage.set("a", "k", 1);
    await storage.set("b", "k", 2);

    await storage.clear("a");
    expect(await storage.get("a", "k")).toBeUndefined();
    expect(await storage.get("b", "k")).toBe(2);

    await storage.clear();
    expect(await storage.get("b", "k")).toBeUndefined();
  });
});
