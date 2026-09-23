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
});

describe("emptyStore", () => {
  it("ilk açılışta ses açık", () => {
    expect(emptyStore().settings.soundEnabled).toBe(true);
  });
});
