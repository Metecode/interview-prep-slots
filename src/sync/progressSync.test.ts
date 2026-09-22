import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { QuestionProgress } from "../domain/progress";

/* ------------------------------------------------------------------ */
/* İlerleme senkronu testleri — authClient taklit edilir               */
/* ------------------------------------------------------------------ */

/*
  Sınır authClient: senkron modülü oturumu oradan okuyor ve isteklerini
  oradan atıyor. Gerçek istemciyi sürmek yerine bu iki noktayı taklit
  etmek, testleri token yenileme ayrıntılarından bağımsız tutuyor.

  "Bir kez birleştir" güvencesi modül değişkeninde yaşadığı için modül
  her testte yeniden yükleniyor (authClient.test.ts ile aynı yaklaşım).
*/

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  snapshot: {
    current: { status: "anonymous", user: null } as {
      status: string;
      user: { id: string; username: string } | null;
    },
  },
}));

vi.mock("../auth/authClient", () => ({
  apiFetch: mocks.apiFetch,
  getSnapshot: () => mocks.snapshot.current,
}));

type SyncModule = typeof import("./progressSync");

async function loadSync(): Promise<SyncModule> {
  vi.resetModules();
  return import("./progressSync");
}

function signIn(id = "user-1") {
  mocks.snapshot.current = { status: "authenticated", user: { id, username: "metecode" } };
}

function signOut() {
  mocks.snapshot.current = { status: "anonymous", user: null };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Geçerli tek bir ilerleme kaydı; şemadan geçecek kadar eksiksiz. */
function progressOf(questionId: string, box: 1 | 2 | 3 | 4 | 5, lastSeenAt: string): QuestionProgress {
  return { questionId, box, lastSeenAt, attempts: [] };
}

/** Son isteğin gövdesini kayıt dizisi olarak çözer. */
function sentRecords(callIndex = 0): unknown[] {
  const init = mocks.apiFetch.mock.calls[callIndex][1] as RequestInit;
  return JSON.parse(String(init.body)) as unknown[];
}

beforeEach(() => {
  mocks.apiFetch.mockReset();
  signOut();
  // Hata yolları bilerek loglanıyor; test çıktısını kirletmesin.
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("misafir kullanıcı", () => {
  it("syncAfterLogin hiç istek atmaz", async () => {
    const sync = await loadSync();

    const merged = await sync.syncAfterLogin({ a: progressOf("a", 2, "2026-01-01T10:00:00Z") });

    expect(merged).toBeNull();
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("pushChanges hiç istek atmaz", async () => {
    const sync = await loadSync();

    await sync.pushChanges({ a: progressOf("a", 2, "2026-01-01T10:00:00Z") }, ["a"]);

    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });
});

describe("syncAfterLogin", () => {
  it("aynı kullanıcı için yalnızca bir kez çağrılır", async () => {
    const sync = await loadSync();
    signIn();
    mocks.apiFetch.mockResolvedValue(jsonResponse([]));

    await sync.syncAfterLogin({});
    await sync.syncAfterLogin({});

    expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
    expect(mocks.apiFetch.mock.calls[0][0]).toBe("/api/progress/merge");
    expect((mocks.apiFetch.mock.calls[0][1] as RequestInit).method).toBe("POST");
  });

  it("çıkıştan sonra yeniden birleştirir", async () => {
    const sync = await loadSync();
    signIn();
    mocks.apiFetch.mockResolvedValue(jsonResponse([]));

    await sync.syncAfterLogin({});
    signOut();
    sync.resetSync();
    signIn();
    await sync.syncAfterLogin({});

    expect(mocks.apiFetch).toHaveBeenCalledTimes(2);
  });

  it("yereldeki tüm ilerlemeyi gönderir", async () => {
    const sync = await loadSync();
    signIn();
    mocks.apiFetch.mockResolvedValue(jsonResponse([]));

    await sync.syncAfterLogin({
      a: progressOf("a", 2, "2026-01-01T10:00:00Z"),
      b: progressOf("b", 5, "2026-02-01T10:00:00Z"),
    });

    expect(sentRecords()).toHaveLength(2);
  });

  it("birleşmiş sonucu haritaya çevirir", async () => {
    const sync = await loadSync();
    signIn();
    mocks.apiFetch.mockResolvedValue(
      jsonResponse([
        progressOf("a", 3, "2026-03-01T10:00:00Z"),
        progressOf("b", 1, "2026-01-01T10:00:00Z"),
      ]),
    );

    const merged = await sync.syncAfterLogin({ a: progressOf("a", 1, "2026-01-01T10:00:00Z") });

    expect(merged).toEqual({
      a: progressOf("a", 3, "2026-03-01T10:00:00Z"),
      b: progressOf("b", 1, "2026-01-01T10:00:00Z"),
    });
  });

  it("sunucunun tanımadığı yerel kaydı silmez", async () => {
    const sync = await loadSync();
    signIn();
    // Sunucu "eski-icerik"i tanımadığı için atladı, yanıtında yok.
    mocks.apiFetch.mockResolvedValue(jsonResponse([progressOf("a", 3, "2026-03-01T10:00:00Z")]));

    const merged = await sync.syncAfterLogin({
      a: progressOf("a", 1, "2026-01-01T10:00:00Z"),
      "eski-icerik": progressOf("eski-icerik", 2, "2026-01-01T10:00:00Z"),
    });

    expect(merged).toEqual({
      a: progressOf("a", 3, "2026-03-01T10:00:00Z"),
      "eski-icerik": progressOf("eski-icerik", 2, "2026-01-01T10:00:00Z"),
    });
  });

  it("şemaya uymayan kaydı atlar, kalanı yazar", async () => {
    const sync = await loadSync();
    signIn();
    mocks.apiFetch.mockResolvedValue(
      jsonResponse([{ questionId: "bozuk", box: 9 }, progressOf("a", 2, "2026-01-01T10:00:00Z")]),
    );

    const merged = await sync.syncAfterLogin({});

    expect(merged).toEqual({ a: progressOf("a", 2, "2026-01-01T10:00:00Z") });
  });

  it("sunucu 500 dönünce null döner, yerel veri çağırana kalır", async () => {
    const sync = await loadSync();
    signIn();
    mocks.apiFetch.mockResolvedValue(new Response("bozuldu", { status: 500 }));

    const local = { a: progressOf("a", 2, "2026-01-01T10:00:00Z") };
    const merged = await sync.syncAfterLogin(local);

    expect(merged).toBeNull();
    // Gönderilen nesne de bozulmadı: modül yerel veriyi hiç değiştirmiyor.
    expect(local).toEqual({ a: progressOf("a", 2, "2026-01-01T10:00:00Z") });
  });

  it("ağ hatasında sessiz kalır ve sonraki deneme tekrar gider", async () => {
    const sync = await loadSync();
    signIn();
    mocks.apiFetch.mockRejectedValueOnce(new Error("offline"));

    expect(await sync.syncAfterLogin({})).toBeNull();

    mocks.apiFetch.mockResolvedValue(jsonResponse([]));
    expect(await sync.syncAfterLogin({})).toEqual({});
    expect(mocks.apiFetch).toHaveBeenCalledTimes(2);
  });
});

describe("pushChanges", () => {
  it("yalnızca istenen soruların kaydını gönderir", async () => {
    const sync = await loadSync();
    signIn();
    mocks.apiFetch.mockResolvedValue(jsonResponse({ applied: 1, ignored: 0 }));

    await sync.pushChanges(
      {
        a: progressOf("a", 2, "2026-01-01T10:00:00Z"),
        b: progressOf("b", 4, "2026-02-01T10:00:00Z"),
      },
      ["b"],
    );

    expect(mocks.apiFetch.mock.calls[0][0]).toBe("/api/progress");
    expect((mocks.apiFetch.mock.calls[0][1] as RequestInit).method).toBe("PUT");
    expect(sentRecords()).toEqual([progressOf("b", 4, "2026-02-01T10:00:00Z")]);
  });

  it("gönderilecek kayıt yoksa istek atmaz", async () => {
    const sync = await loadSync();
    signIn();

    await sync.pushChanges({}, ["hic-cevaplanmadi"]);

    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("sunucu hatasında sessiz kalır", async () => {
    const sync = await loadSync();
    signIn();
    mocks.apiFetch.mockResolvedValue(new Response("bozuldu", { status: 500 }));

    await expect(
      sync.pushChanges({ a: progressOf("a", 2, "2026-01-01T10:00:00Z") }, ["a"]),
    ).resolves.toBeUndefined();
  });
});
