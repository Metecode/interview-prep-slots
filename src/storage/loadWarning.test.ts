import { describe, expect, it } from "vitest";

import { emptyStore } from "../domain/progress";
import { loadWarning } from "./loadWarning";

describe("loadWarning", () => {
  const store = emptyStore();

  it("ok ve empty için uyarı yok", () => {
    expect(loadWarning({ status: "ok", store })).toBeNull();
    expect(loadWarning({ status: "empty", store })).toBeNull();
  });

  it("failed için kaydedilemiyor der", () => {
    expect(loadWarning({ status: "failed", store })).toBe("İlerlemen bu oturumda kaydedilemiyor.");
  });

  it("recovered için kayıp türüne göre metin seçer", () => {
    expect(loadWarning({ status: "recovered", store, loss: "allProgress" })).toBe(
      "Kayıtlı ilerlemen okunamadı, sıfırdan başlıyorsun.",
    );
    expect(loadWarning({ status: "recovered", store, loss: "someProgress" })).toBe(
      "Kayıtlı ilerlemenin bir kısmı okunamadı; okunabilenler korundu.",
    );
    expect(loadWarning({ status: "recovered", store, loss: "settingsOnly" })).toBe(
      "Bazı ayarların okunamadı, varsayılana döndürüldü.",
    );
  });
});
