import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emptyStore } from "../domain/progress";
import type { QuestionProgress, Store } from "../domain/progress";
import { createMemoryAdapter } from "../platform/storage/memoryAdapter";
import { loadStore, saveStore } from "../storage/db";

/* ------------------------------------------------------------------ */
/* Senkron birleştirmesinin depoya kalıcı yazılması                    */
/* ------------------------------------------------------------------ */

/*
  lastSeenAt karşılaştırmasını sunucu yapıyor (ProgressMerger); istemci
  dönen sonucu yerelin üstüne koyuyor. Bu test o sonucun depoya gidip
  geri geldiğinde bozulmadığını doğrular: sunucunun yeni kaydı kazanır,
  sunucunun tanımadığı yerel kayıt korunur. authClient progressSync.test.ts
  ile aynı şekilde taklit edilir.
*/

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock("../auth/authClient", () => ({
  apiFetch: mocks.apiFetch,
  getSnapshot: () => ({ status: "authenticated", user: { id: "user-1", username: "metecode" } }),
}));

function progressOf(questionId: string, box: 1 | 2 | 3 | 4 | 5, lastSeenAt: string): QuestionProgress {
  return { questionId, box, lastSeenAt, attempts: [] };
}

beforeEach(() => {
  mocks.apiFetch.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("girişte birleştirme sonrası depo", () => {
  it("sunucunun daha yeni lastSeenAt'i kalıcı olur, yalnız yereldeki kayıt korunur", async () => {
    const storage = createMemoryAdapter();
    const local: Store = {
      ...emptyStore(),
      progress: {
        q1: progressOf("q1", 1, "2026-04-01T10:00:00.000Z"),
        // Sunucunun henüz tanımadığı soru; birleşik yanıtta yok.
        yerel: progressOf("yerel", 2, "2026-04-01T10:00:00.000Z"),
      },
    };
    await saveStore(storage, local);

    // Başka cihazda q1 daha sonra çalışılmış: sunucu onu döndürüyor.
    const serverQ1 = progressOf("q1", 3, "2026-04-05T10:00:00.000Z");
    mocks.apiFetch.mockResolvedValue(
      new Response(JSON.stringify([serverQ1]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    vi.resetModules();
    const { syncAfterLogin } = await import("./progressSync");
    const { store: loaded } = await loadStore(storage);
    const merged = await syncAfterLogin(loaded.progress);
    expect(merged).not.toBeNull();

    // App'teki yol: SYNC_PROGRESS oturuma yazar, kaydetme efekti diske.
    await saveStore(storage, { ...loaded, progress: merged ?? {} });

    const { store: reloaded } = await loadStore(storage);
    expect(reloaded.progress.q1).toEqual(serverQ1);
    expect(reloaded.progress.yerel).toEqual(local.progress.yerel);
  });
});
