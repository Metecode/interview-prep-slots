import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* ------------------------------------------------------------------ */
/* AudioContext taklidi: yalnızca modülün dokunduğu yüzey              */
/* ------------------------------------------------------------------ */

type FakeState = "running" | "suspended" | "interrupted" | "closed";

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];

  state: FakeState = "suspended";
  sampleRate = 8000;
  destination = {};
  /** Testin sözü elle çözebilmesi için; varsayılan hemen çözülür. */
  resumeImpl: () => Promise<void> = () => Promise.resolve();
  resume = vi.fn(() => this.resumeImpl());
  startedSources = 0;

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createGain() {
    return { gain: { value: 0 }, connect: vi.fn() };
  }

  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }

  createBufferSource() {
    return {
      buffer: null,
      connect: vi.fn(),
      start: () => {
        this.startedSources++;
      },
    };
  }

  addEventListener() {}
}

// Modül durumu (tek context) testler arasında taşınmasın diye her testte taze yükleme.
async function loadModule() {
  vi.resetModules();
  return import("./audioContext");
}

beforeEach(() => {
  FakeAudioContext.instances = [];
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ensureAudioReady", () => {
  it("ilk çağrıda context oluşturur ve askıdaysa resume eder", async () => {
    const { ensureAudioReady } = await loadModule();
    ensureAudioReady();

    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(FakeAudioContext.instances[0].resume).toHaveBeenCalledTimes(1);
  });

  it("askıdayken sessiz kilit arabelleği çalar", async () => {
    const { ensureAudioReady } = await loadModule();
    ensureAudioReady();

    expect(FakeAudioContext.instances[0].startedSources).toBe(1);
  });

  it("iOS'un interrupted durumunda da resume eder", async () => {
    const { ensureAudioReady } = await loadModule();
    ensureAudioReady();
    const context = FakeAudioContext.instances[0];
    context.resume.mockClear();

    context.state = "interrupted";
    ensureAudioReady();

    expect(context.resume).toHaveBeenCalledTimes(1);
  });

  it("context çalışıyorsa resume çağırmaz", async () => {
    const { ensureAudioReady } = await loadModule();
    ensureAudioReady();
    const context = FakeAudioContext.instances[0];
    context.resume.mockClear();

    context.state = "running";
    ensureAudioReady();

    expect(context.resume).not.toHaveBeenCalled();
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it("kapanmış context'in yerine yenisini kurar", async () => {
    const { ensureAudioReady } = await loadModule();
    ensureAudioReady();
    FakeAudioContext.instances[0].state = "closed";

    ensureAudioReady();

    expect(FakeAudioContext.instances).toHaveLength(2);
  });

  it("oluşturma bir kez başarısız olursa bir sonraki harekette yeniden dener", async () => {
    const { ensureAudioReady, getRunningGraph } = await loadModule();
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          throw new Error("desteklenmiyor");
        }
      },
    );
    ensureAudioReady();
    expect(getRunningGraph()).toBeNull();

    vi.stubGlobal("AudioContext", FakeAudioContext);
    ensureAudioReady();
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it("resume reddini yutmaz, uyarı olarak yazar", async () => {
    const { ensureAudioReady } = await loadModule();
    vi.stubGlobal(
      "AudioContext",
      class extends FakeAudioContext {
        resumeImpl = () => Promise.reject(new Error("izin yok"));
      },
    );
    ensureAudioReady();
    await vi.waitFor(() => expect(console.warn).toHaveBeenCalled());
  });
});

describe("getRunningGraph", () => {
  it("context hiç oluşturulmadıysa null döner", async () => {
    const { getRunningGraph } = await loadModule();
    expect(getRunningGraph()).toBeNull();
  });

  it("çalışan context'te grafiği döner", async () => {
    const { ensureAudioReady, getRunningGraph } = await loadModule();
    ensureAudioReady();
    FakeAudioContext.instances[0].state = "running";

    expect(getRunningGraph()).not.toBeNull();
  });

  it("interrupted context'te resume sürerken grafiği döner", async () => {
    const { ensureAudioReady, getRunningGraph } = await loadModule();
    ensureAudioReady();
    const context = FakeAudioContext.instances[0];
    // Sonuçlanmayan resume: sesin çalındığı an tam bu aralık.
    context.resumeImpl = () => new Promise<void>(() => {});
    context.state = "interrupted";
    ensureAudioReady();

    expect(getRunningGraph()).not.toBeNull();
  });

  it("resume bittiği halde askıda kalan context'te null döner", async () => {
    const { ensureAudioReady, getRunningGraph } = await loadModule();
    ensureAudioReady();
    // Varsayılan resume hemen çözülür ama taklit durumu değiştirmez.
    await vi.waitFor(() => expect(getRunningGraph()).toBeNull());
  });
});
