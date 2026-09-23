import { describe, expect, it } from "vitest";

import { SCHEMA_VERSION, emptyStore, readStore } from "./progress";

describe("readStore", () => {
  it("soundEnabled alanı olmayan eski kayıt kırılmaz, ses açık gelir", () => {
    const old = {
      schemaVersion: SCHEMA_VERSION,
      progress: {},
      settings: { fastMode: true, lang: "tr", activeCategories: ["sql"], initialized: true },
    };

    const { store, recovered } = readStore(old);

    expect(recovered).toBe(false);
    expect(store.settings.soundEnabled).toBe(true);
    expect(store.settings.fastMode).toBe(true);
  });

  it("kapatılmış ses tercihini korur", () => {
    const saved = {
      schemaVersion: SCHEMA_VERSION,
      progress: {},
      settings: { soundEnabled: false },
    };

    expect(readStore(saved).store.settings.soundEnabled).toBe(false);
  });

  it("aiConsent alanı olmayan eski kayıtta onay verilmemiş sayılır", () => {
    const old = {
      schemaVersion: SCHEMA_VERSION,
      progress: {},
      settings: { fastMode: false, lang: "tr", activeCategories: [], initialized: true },
    };

    const { store, recovered } = readStore(old);

    expect(recovered).toBe(false);
    expect(store.settings.aiConsent).toBe(false);
  });

  it("verilmiş yapay zekâ onayını korur", () => {
    const saved = { schemaVersion: SCHEMA_VERSION, progress: {}, settings: { aiConsent: true } };

    expect(readStore(saved).store.settings.aiConsent).toBe(true);
  });
});

describe("emptyStore", () => {
  it("ilk açılışta ses açık", () => {
    expect(emptyStore().settings.soundEnabled).toBe(true);
  });
});
