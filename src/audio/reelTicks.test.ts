import { describe, expect, it } from "vitest";

import { MIN_TICK_GAP_MS, paylineRowIndex, parseTranslateY, shouldPlayTick } from "./reelTicks";

describe("parseTranslateY", () => {
  it("2B matristen dikey ötelemeyi okur", () => {
    expect(parseTranslateY("matrix(1, 0, 0, 1, 0, -128)")).toBe(-128);
    expect(parseTranslateY("matrix(1, 0, 0, 1, 12, -64.5)")).toBe(-64.5);
  });

  it("3B matristen dikey ötelemeyi okur", () => {
    expect(
      parseTranslateY("matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -320, 0, 1)"),
    ).toBe(-320);
  });

  it("dönüşüm yoksa ya da okunamıyorsa 0 döner", () => {
    expect(parseTranslateY("none")).toBe(0);
    expect(parseTranslateY("")).toBe(0);
    expect(parseTranslateY("matrix(1, 0, 0, 1, 0, abc)")).toBe(0);
    expect(parseTranslateY("translateY(40px)")).toBe(0);
  });
});

describe("paylineRowIndex", () => {
  const ROW = 64;
  const REST = 1;

  it("kaydırılmamış şeritte dinlenme satırı ortadadır", () => {
    expect(paylineRowIndex(0, ROW, REST)).toBe(REST);
  });

  it("her satır yüksekliği kadar kayma bir sonraki satırı getirir", () => {
    expect(paylineRowIndex(-ROW, ROW, REST)).toBe(2);
    expect(paylineRowIndex(-ROW * 10, ROW, REST)).toBe(11);
  });

  it("satır yarı yolda değişir", () => {
    expect(paylineRowIndex(-ROW * 0.49, ROW, REST)).toBe(1);
    expect(paylineRowIndex(-ROW * 0.51, ROW, REST)).toBe(2);
  });

  it("geri sekme (overshoot sonrası) satırı geri alır", () => {
    // Hedef 49. satır; şerit 0.3 satır fazla gidip geri dönüyor.
    const end = -48 * ROW;
    expect(paylineRowIndex(end - 0.3 * ROW, ROW, REST)).toBe(49);
    expect(paylineRowIndex(end - 0.6 * ROW, ROW, REST)).toBe(50);
    expect(paylineRowIndex(end, ROW, REST)).toBe(49);
  });

  it("satır yüksekliği okunamadıysa dinlenme satırında kalır", () => {
    expect(paylineRowIndex(-500, 0, REST)).toBe(REST);
    expect(paylineRowIndex(-500, Number.NaN, REST)).toBe(REST);
  });
});

describe("shouldPlayTick", () => {
  it("ilk tık her zaman çalar", () => {
    expect(shouldPlayTick(0, null)).toBe(true);
  });

  it("sınırdan önce gelen tık atlanır", () => {
    expect(shouldPlayTick(1000 + MIN_TICK_GAP_MS - 1, 1000)).toBe(false);
  });

  it("tam sınırda ya da sonra gelen tık çalar", () => {
    expect(shouldPlayTick(1000 + MIN_TICK_GAP_MS, 1000)).toBe(true);
    expect(shouldPlayTick(1100, 1000)).toBe(true);
  });

  it("varsayılan sınır 25ms", () => {
    expect(MIN_TICK_GAP_MS).toBe(25);
  });

  it("özel sınır verilebilir", () => {
    expect(shouldPlayTick(1040, 1000, 50)).toBe(false);
    expect(shouldPlayTick(1050, 1000, 50)).toBe(true);
  });
});
