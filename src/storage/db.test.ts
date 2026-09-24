import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emptyStore, SCHEMA_VERSION } from "../domain/progress";
import type { Store } from "../domain/progress";
import type { Question } from "../domain/question";
import { initialSessionState, sessionReducer, toStore } from "../domain/session";
import type { SessionState } from "../domain/session";
import { createMemoryAdapter } from "../platform/storage/memoryAdapter";
import type { StorageAdapter } from "../platform";
import { STORE_KEY, STORE_NS, loadStore, saveStore } from "./db";

/* ------------------------------------------------------------------ */
/* Depo — bellek adapter'ı ile okuma/yazma                             */
/* ------------------------------------------------------------------ */

const QUESTION: Question = {
  id: "q1",
  category: "sql",
  kind: "definition",
  topic: "Index",
  difficulty: 1,
  prompt: "q1 için soru metni",
  modelAnswer: "Yeterince uzun bir örnek cevap metni.",
  keyConcepts: [
    {
      id: "kavram-1",
      label: "Kavram 1",
      aliases: ["birinci"],
      anchors: ["Birinci kavramı anlatan yeterince uzun çapa cümlesi."],
    },
  ],
};

/** Diskten gelen store'la kurulan oturum; App.initState ile aynı yol. */
function hydrate(store: Store): SessionState {
  return sessionReducer(initialSessionState(), {
    type: "HYDRATE",
    progress: store.progress,
    settings: store.settings,
  });
}

/** Değerlendirilmiş bir turu kullanıcının puanıyla kapatır. */
function rate(state: SessionState, now: Date): SessionState {
  const evaluated: SessionState = {
    ...state,
    phase: "evaluated",
    current: QUESTION,
    evaluation: { source: "lexical", hits: ["kavram-1"], missing: [] },
  };
  return sessionReducer(evaluated, { type: "RATE", rating: 2, answer: "birinci", now });
}

function persisted(state: SessionState): Store {
  return toStore(state, { fastMode: false, soundEnabled: true, soundHintShown: false });
}

beforeEach(() => {
  // Hata yolları bilerek loglanıyor; test çıktısını kirletmesin.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Leitner ilerlemesi depoda kalıcı", () => {
  it("iki oturum boyunca kutu yükselir ve denemeler birikir", async () => {
    const storage = createMemoryAdapter();

    // İlk açılış: depo boş.
    const first = await loadStore(storage);
    expect(first.recovered).toBe(false);
    const afterFirst = rate(hydrate(first.store), new Date("2026-04-01T10:00:00.000Z"));
    await saveStore(storage, persisted(afterFirst));

    // Sayfa yenilendi: yeni oturum diskten kurulur.
    const second = await loadStore(storage);
    expect(second.store.progress.q1.box).toBe(2);
    const afterSecond = rate(hydrate(second.store), new Date("2026-04-03T10:00:00.000Z"));
    await saveStore(storage, persisted(afterSecond));

    const third = await loadStore(storage);
    const progress = third.store.progress.q1;
    expect(progress.box).toBe(3);
    expect(progress.lastSeenAt).toBe("2026-04-03T10:00:00.000Z");
    expect(progress.attempts.map((attempt) => attempt.answer)).toEqual(["birinci", "birinci"]);
  });
});

describe("loadStore", () => {
  it("mevcut kullanıcı verisini sabit ns/key altından okur", async () => {
    const storage = createMemoryAdapter();
    const existing: Store = {
      ...emptyStore(),
      progress: {
        q1: { questionId: "q1", box: 4, lastSeenAt: "2026-03-01T00:00:00.000Z", attempts: [] },
      },
    };
    await storage.set("mulakat-slot", "store", existing);

    expect(STORE_NS).toBe("mulakat-slot");
    expect(STORE_KEY).toBe("store");
    const { store, recovered } = await loadStore(storage);
    expect(recovered).toBe(false);
    expect(store.progress.q1.box).toBe(4);
  });

  it("bozuk kayıtta boş store ve recovered döner", async () => {
    const storage = createMemoryAdapter();
    await storage.set(STORE_NS, STORE_KEY, { schemaVersion: SCHEMA_VERSION, progress: "bozuk" });

    const { store, recovered } = await loadStore(storage);
    expect(recovered).toBe(true);
    expect(store).toEqual(emptyStore());
  });

  it("depo okunamazsa fırlatmaz, boş store döner ve recovered false kalır", async () => {
    const storage: StorageAdapter = {
      ...createMemoryAdapter(),
      get: () => Promise.reject(new Error("IndexedDB kapalı")),
    };

    const { store, recovered } = await loadStore(storage);
    expect(recovered).toBe(false);
    expect(store).toEqual(emptyStore());
  });
});

describe("saveStore", () => {
  it("şemadan geçmeyen store'u yazmaz", async () => {
    const storage = createMemoryAdapter();
    const invalid = { ...emptyStore(), schemaVersion: 99 } as unknown as Store;

    await saveStore(storage, invalid);
    expect(await storage.get(STORE_NS, STORE_KEY)).toBeUndefined();
  });

  it("depo yazamazsa fırlatmaz", async () => {
    const storage: StorageAdapter = {
      ...createMemoryAdapter(),
      set: () => Promise.reject(new Error("kota dolu")),
    };

    await expect(saveStore(storage, emptyStore())).resolves.toBeUndefined();
  });
});
