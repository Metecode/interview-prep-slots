import { afterEach, describe, expect, it, vi } from "vitest";

/* ------------------------------------------------------------------ */
/* Platform bayrakları — Capacitor taklit edilir                       */
/* ------------------------------------------------------------------ */

/*
  Bayraklar modül yüklenirken bir kez hesaplanıyor; her test Capacitor'ı
  kendi değeriyle taklit edip modülleri yeniden yükler.
*/
function mockCapacitor(native: boolean): void {
  vi.resetModules();
  vi.doMock("@capacitor/core", () => ({
    Capacitor: { isNativePlatform: () => native },
  }));
}

/** load olayını beklemeden çalıştıran sahte window ve navigator. */
function stubBrowser() {
  const register = vi.fn(() => Promise.resolve({} as ServiceWorkerRegistration));
  vi.stubGlobal("navigator", { serviceWorker: { register } });
  vi.stubGlobal("window", {
    addEventListener: (_type: string, listener: () => void) => listener(),
  });
  return register;
}

afterEach(() => {
  vi.doUnmock("@capacitor/core");
  vi.unstubAllGlobals();
});

describe("platformFeatures", () => {
  it("web'de auth ve service worker açık", async () => {
    mockCapacitor(false);
    const { platformFeatures } = await import("./index");

    expect(platformFeatures).toEqual({ auth: true, serviceWorker: true });
  });

  it("native'de auth ve service worker kapalı", async () => {
    mockCapacitor(true);
    const { platformFeatures } = await import("./index");

    expect(platformFeatures).toEqual({ auth: false, serviceWorker: false });
  });
});

describe("registerServiceWorker", () => {
  it("web'de /sw.js'i kök kapsamla kaydeder", async () => {
    mockCapacitor(false);
    const register = stubBrowser();
    const { registerServiceWorker } = await import("./serviceWorker");

    registerServiceWorker();

    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("native'de kayıt yapmaz", async () => {
    mockCapacitor(true);
    const register = stubBrowser();
    const { registerServiceWorker } = await import("./serviceWorker");

    registerServiceWorker();

    expect(register).not.toHaveBeenCalled();
  });
});
