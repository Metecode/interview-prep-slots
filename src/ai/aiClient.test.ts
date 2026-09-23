import { beforeEach, describe, expect, it, vi } from "vitest";

/* ------------------------------------------------------------------ */
/* Yapay zekâ istemcisi testleri — authClient taklit edilir            */
/* ------------------------------------------------------------------ */

/*
  Sınır apiFetch: token ve 401'de yenileme onun işi. Durum modül
  değişkeninde yaşadığı için modül her testte yeniden yükleniyor
  (progressSync.test.ts ile aynı yaklaşım).
*/

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("../auth/authClient", () => ({ apiFetch: mocks.apiFetch }));

type AiModule = typeof import("./aiClient");

async function loadAi(): Promise<AiModule> {
  vi.resetModules();
  return import("./aiClient");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const READY_STATUS = { enabled: true, remaining: 7, weekResetsAt: "2026-09-28T00:00:00Z" };

const EVALUATION = {
  hits: ["a"],
  missing: ["b", "c"],
  feedback: "A doğru, B eksik.",
  followUp: "B neden gerekli?",
  remaining: 6,
  cached: false,
};

beforeEach(() => {
  mocks.apiFetch.mockReset();
});

describe("loadAiStatus", () => {
  it("durumu okur ve yayınlar", async () => {
    const ai = await loadAi();
    mocks.apiFetch.mockResolvedValueOnce(jsonResponse(READY_STATUS));

    await ai.loadAiStatus("user-1");

    expect(ai.getAiAvailability()).toEqual({ kind: "ready", ...READY_STATUS });
    expect(mocks.apiFetch).toHaveBeenCalledWith("/api/ai/status");
  });

  it("aynı kullanıcı için ikinci kez istek atmaz (StrictMode)", async () => {
    const ai = await loadAi();
    mocks.apiFetch.mockResolvedValue(jsonResponse(READY_STATUS));

    await Promise.all([ai.loadAiStatus("user-1"), ai.loadAiStatus("user-1")]);

    expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
  });

  it("hata durumunda error olur ve sonraki çağrı yeniden dener", async () => {
    const ai = await loadAi();
    mocks.apiFetch.mockResolvedValueOnce(jsonResponse({}, 500));

    await ai.loadAiStatus("user-1");
    expect(ai.getAiAvailability()).toEqual({ kind: "error" });

    mocks.apiFetch.mockResolvedValueOnce(jsonResponse(READY_STATUS));
    await ai.loadAiStatus("user-1");
    expect(ai.getAiAvailability().kind).toBe("ready");
  });

  it("istek uçarken çıkış yapılırsa gelen sonuç yazılmaz", async () => {
    const ai = await loadAi();
    let resolve: (response: Response) => void = () => {};
    mocks.apiFetch.mockReturnValueOnce(new Promise<Response>((r) => (resolve = r)));

    const pending = ai.loadAiStatus("user-1");
    ai.resetAiStatus();
    resolve(jsonResponse(READY_STATUS));
    await pending;

    expect(ai.getAiAvailability()).toEqual({ kind: "guest" });
  });

  it("değişmeyen durumda nesne kimliği korunur", async () => {
    const ai = await loadAi();
    const before = ai.getAiAvailability();

    ai.resetAiStatus();

    expect(ai.getAiAvailability()).toBe(before);
  });
});

describe("evaluateWithAi", () => {
  it("yalnızca soru id'si ve cevabı gönderir, rubrik göndermez", async () => {
    const ai = await loadAi();
    mocks.apiFetch.mockResolvedValueOnce(jsonResponse(EVALUATION));

    await ai.evaluateWithAi("q1", "cevabım");

    const [url, init] = mocks.apiFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/ai/evaluate");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ questionId: "q1", answer: "cevabım" });
  });

  it("sonucu ai kaynaklı Evaluation'a çevirir ve kalan hakkı tazeler", async () => {
    const ai = await loadAi();
    mocks.apiFetch.mockResolvedValueOnce(jsonResponse(READY_STATUS));
    await ai.loadAiStatus("user-1");
    mocks.apiFetch.mockResolvedValueOnce(jsonResponse(EVALUATION));

    const result = await ai.evaluateWithAi("q1", "cevabım");

    expect(result).toEqual({
      ok: true,
      cached: false,
      evaluation: {
        source: "ai",
        hits: ["a"],
        missing: ["b", "c"],
        feedback: "A doğru, B eksik.",
        followUp: "B neden gerekli?",
      },
    });
    expect(ai.getAiAvailability()).toMatchObject({ kind: "ready", remaining: 6 });
  });

  it("503 yoğun demektir", async () => {
    const ai = await loadAi();
    mocks.apiFetch.mockResolvedValueOnce(jsonResponse({ code: "ai_unavailable" }, 503));

    expect(await ai.evaluateWithAi("q1", "cevap")).toEqual({ ok: false, reason: "unavailable" });
  });

  it("502 okunamayan yanıttır", async () => {
    const ai = await loadAi();
    mocks.apiFetch.mockResolvedValueOnce(jsonResponse({ code: "ai_bad_response" }, 502));

    expect(await ai.evaluateWithAi("q1", "cevap")).toEqual({ ok: false, reason: "bad_response" });
  });

  it("kota bittiyse sayacı sıfırlar", async () => {
    const ai = await loadAi();
    mocks.apiFetch.mockResolvedValueOnce(jsonResponse(READY_STATUS));
    await ai.loadAiStatus("user-1");
    mocks.apiFetch.mockResolvedValueOnce(jsonResponse({ code: "quota_exceeded" }, 429));

    const result = await ai.evaluateWithAi("q1", "cevap");

    expect(result).toEqual({ ok: false, reason: "quota_exceeded" });
    expect(ai.getAiAvailability()).toMatchObject({ remaining: 0 });
  });

  it("hız sınırını kotadan ayırır", async () => {
    const ai = await loadAi();
    mocks.apiFetch.mockResolvedValueOnce(jsonResponse({ code: "rate_limited" }, 429));

    expect(await ai.evaluateWithAi("q1", "cevap")).toEqual({ ok: false, reason: "rate_limited" });
  });

  it("şemaya uymayan başarılı yanıt başarısızlıktır", async () => {
    const ai = await loadAi();
    mocks.apiFetch.mockResolvedValueOnce(jsonResponse({ hits: "a" }));

    expect(await ai.evaluateWithAi("q1", "cevap")).toEqual({ ok: false, reason: "failed" });
  });

  it("ağ hatasında fırlatmaz", async () => {
    const ai = await loadAi();
    mocks.apiFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    expect(await ai.evaluateWithAi("q1", "cevap")).toEqual({ ok: false, reason: "failed" });
  });

  it("401 oturum sorunudur", async () => {
    const ai = await loadAi();
    mocks.apiFetch.mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401));

    expect(await ai.evaluateWithAi("q1", "cevap")).toEqual({ ok: false, reason: "unauthorized" });
  });
});
