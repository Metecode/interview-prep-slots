import { describe, expect, it } from "vitest";

import { REPEAT_ENABLE_WINDOW_MS, isAppleTouchDevice, shouldShowSoundHint } from "./soundHint";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD_OLD_UA =
  "Mozilla/5.0 (iPad; CPU OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const MAC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const WINDOWS_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

describe("isAppleTouchDevice", () => {
  it("iPhone ve eski iPad user agent'ını tanır", () => {
    expect(isAppleTouchDevice({ userAgent: IPHONE_UA, maxTouchPoints: 5 })).toBe(true);
    expect(isAppleTouchDevice({ userAgent: IPAD_OLD_UA, maxTouchPoints: 5 })).toBe(true);
  });

  it("masaüstü gibi davranan iPadOS'u dokunmatik ekrandan tanır", () => {
    expect(isAppleTouchDevice({ userAgent: MAC_UA, maxTouchPoints: 5 })).toBe(true);
  });

  it("gerçek Mac'i iOS saymaz", () => {
    expect(isAppleTouchDevice({ userAgent: MAC_UA, maxTouchPoints: 0 })).toBe(false);
    // Bazı Mac'ler trackpad yüzünden 1 bildirebiliyor; eşik 1'in üstü.
    expect(isAppleTouchDevice({ userAgent: MAC_UA, maxTouchPoints: 1 })).toBe(false);
  });

  it("Android ve Windows'u iOS saymaz", () => {
    expect(isAppleTouchDevice({ userAgent: ANDROID_UA, maxTouchPoints: 5 })).toBe(false);
    expect(isAppleTouchDevice({ userAgent: WINDOWS_UA, maxTouchPoints: 10 })).toBe(false);
  });
});

describe("shouldShowSoundHint", () => {
  it("hiç gösterilmediyse ilk açılışta gösterir", () => {
    expect(shouldShowSoundHint({ hintShown: false, lastEnabledAt: null, now: 1000 })).toBe(true);
  });

  it("gösterildiyse ve önceki açılış yoksa göstermez", () => {
    expect(shouldShowSoundHint({ hintShown: true, lastEnabledAt: null, now: 1000 })).toBe(false);
  });

  it("pencere içinde ikinci açılışta yeniden gösterir", () => {
    const now = 100_000;
    expect(
      shouldShowSoundHint({ hintShown: true, lastEnabledAt: now - 5_000, now }),
    ).toBe(true);
    expect(
      shouldShowSoundHint({ hintShown: true, lastEnabledAt: now - REPEAT_ENABLE_WINDOW_MS, now }),
    ).toBe(true);
  });

  it("pencere dışındaki ikinci açılışta göstermez", () => {
    const now = 100_000;
    expect(
      shouldShowSoundHint({
        hintShown: true,
        lastEnabledAt: now - REPEAT_ENABLE_WINDOW_MS - 1,
        now,
      }),
    ).toBe(false);
  });
});
