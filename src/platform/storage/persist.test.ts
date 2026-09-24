import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requestPersistentStorage } from "./persist";

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("requestPersistentStorage", () => {
  it("desteklenmiyorsa fırlatmaz", async () => {
    await expect(requestPersistentStorage(undefined)).resolves.toBeUndefined();
  });

  it("zaten kalıcıysa tekrar istemez", async () => {
    const persist = vi.fn(async () => true);
    await requestPersistentStorage({ persisted: async () => true, persist });
    expect(persist).not.toHaveBeenCalled();
  });

  it("kalıcı değilse ister", async () => {
    const persist = vi.fn(async () => false);
    await requestPersistentStorage({ persisted: async () => false, persist });
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("tarayıcı hata verirse fırlatmaz", async () => {
    const failing = { persisted: async () => false, persist: () => Promise.reject(new Error("izin yok")) };
    await expect(requestPersistentStorage(failing)).resolves.toBeUndefined();
  });
});
