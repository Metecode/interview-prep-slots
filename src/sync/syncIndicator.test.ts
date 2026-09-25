import { describe, expect, it } from "vitest";

import type { SyncSnapshot } from "./progressSync";
import {
  ANNOUNCE_FAILED,
  ANNOUNCE_RECOVERED,
  indicatorReducer,
  indicatorView,
  initialIndicatorState,
} from "./syncIndicator";
import type { IndicatorEvent, IndicatorState } from "./syncIndicator";

/* ------------------------------------------------------------------ */
/* Senkron göstergesi durum makinesi                                   */
/* ------------------------------------------------------------------ */

const IDLE: SyncSnapshot = { status: "idle", lastSyncedAt: null };

function snap(status: SyncSnapshot["status"], lastSyncedAt: number | null): IndicatorEvent {
  return { type: "snapshot", snapshot: { status, lastSyncedAt } };
}

const DELAY: IndicatorEvent = { type: "syncingDelayElapsed" };
const TEXT_ELAPSED: IndicatorEvent = { type: "syncedTextElapsed" };

function run(events: IndicatorEvent[], start: SyncSnapshot = IDLE): IndicatorState {
  return events.reduce(indicatorReducer, initialIndicatorState(start));
}

describe("indicatorView", () => {
  it("hiç senkron olmamışken sakin ikon: idle", () => {
    expect(indicatorView(run([]))).toBe("idle");
  });

  it("300 ms dolmadan syncing gösterilmez", () => {
    const state = run([snap("syncing", null)]);
    expect(indicatorView(state)).toBe("idle");
  });

  it("300 ms dolunca syncing gösterilir", () => {
    const state = run([snap("syncing", null), DELAY]);
    expect(indicatorView(state)).toBe("syncing");
  });

  it("senkron bittikten sonra dolan zamanlayıcı syncing göstermez", () => {
    const state = run([snap("syncing", null), snap("idle", 1), DELAY]);
    expect(indicatorView(state)).toBe("synced");
  });

  it("hata, bir sonraki başarıya kadar kalır", () => {
    const failed = run([snap("syncing", null), snap("error", null)]);
    expect(indicatorView(failed)).toBe("error");

    // Kısa süren yeniden deneme hata ikonunu titretmez.
    const retrying = indicatorReducer(failed, snap("syncing", null));
    expect(indicatorView(retrying)).toBe("error");

    const recovered = indicatorReducer(retrying, snap("idle", 1));
    expect(indicatorView(recovered)).toBe("synced");
  });

  it("görünür yeniden deneme hatanın önüne geçer", () => {
    const state = run([snap("error", null), snap("syncing", null), DELAY]);
    expect(indicatorView(state)).toBe("syncing");
  });
});

describe("Senkronlandı metni", () => {
  it("rutin hızlı senkronda çıkmaz", () => {
    const state = run([snap("syncing", null), snap("idle", 1)]);
    expect(state.syncedTextVisible).toBe(false);
  });

  it("kullanıcı Senkronlanıyor'u gördüyse çıkar ve süresi dolunca gizlenir", () => {
    const shown = run([snap("syncing", null), DELAY, snap("idle", 1)]);
    expect(shown.syncedTextVisible).toBe(true);

    expect(indicatorReducer(shown, TEXT_ELAPSED).syncedTextVisible).toBe(false);
  });

  it("hatadan kurtulunca çıkar", () => {
    const state = run([snap("error", null), snap("syncing", null), snap("idle", 1)]);
    expect(state.syncedTextVisible).toBe(true);
  });

  it("her gösterimde anahtar artar; zamanlayıcı yeniden başlar", () => {
    const first = run([snap("syncing", null), DELAY, snap("idle", 1)]);
    const second = [snap("syncing", 1), DELAY, snap("idle", 2)].reduce(indicatorReducer, first);
    expect(second.syncedTextKey).toBe(first.syncedTextKey + 1);
  });

  it("hata metni bastırır", () => {
    const state = run([snap("syncing", null), DELAY, snap("idle", 1), snap("error", 1)]);
    expect(state.syncedTextVisible).toBe(false);
    expect(indicatorView(state)).toBe("error");
  });
});

describe("hızlı yanıt — syncing → idle tek render'da birleşse de", () => {
  it("lastSyncedAt değişimi yeni başarı sayılır", () => {
    // Bileşen syncing'i hiç görmedi: idle(null) → idle(1) doğrudan geldi.
    const state = run([snap("idle", 1)]);
    expect(indicatorView(state)).toBe("synced");
  });

  it("hatadan sonra syncing'i görmeden gelen başarı yine kurtuluştur", () => {
    const state = run([snap("error", null), snap("idle", 1)]);
    expect(indicatorView(state)).toBe("synced");
    expect(state.syncedTextVisible).toBe(true);
    expect(state.announcement).toBe(ANNOUNCE_RECOVERED);
  });

  it("aynı snapshot'ta başarı ve hata birlikteyse hata kazanır", () => {
    const state = run([snap("error", 1)]);
    expect(indicatorView(state)).toBe("error");
    expect(state.announcement).toBe(ANNOUNCE_FAILED);
  });
});

describe("canlı bölge", () => {
  it("syncing ve rutin başarılar duyurulmaz", () => {
    const state = run([snap("syncing", null), DELAY, snap("idle", 1), snap("syncing", 1), snap("idle", 2)]);
    expect(state.announcement).toBe("");
  });

  it("hataya girişte bir kez duyurur, ardışık hatalar metni değiştirmez", () => {
    const first = run([snap("syncing", null), snap("error", null)]);
    expect(first.announcement).toBe(ANNOUNCE_FAILED);

    const again = [snap("syncing", null), snap("error", null)].reduce(indicatorReducer, first);
    expect(again.announcement).toBe(ANNOUNCE_FAILED);
  });

  it("kurtuluşta duyurur, sonraki rutin başarıda metin aynı kalır", () => {
    const recovered = run([snap("error", null), snap("idle", 1)]);
    expect(recovered.announcement).toBe(ANNOUNCE_RECOVERED);

    const routine = [snap("syncing", 1), snap("idle", 2)].reduce(indicatorReducer, recovered);
    expect(routine.announcement).toBe(ANNOUNCE_RECOVERED);
  });
});

describe("çıkış", () => {
  it("lastSyncedAt sıfırlanınca önceki oturumun hatası ve metni taşınmaz", () => {
    const loggedOut = run([snap("idle", 1), snap("error", 1), snap("idle", null)]);
    expect(loggedOut.failed).toBe(false);
    expect(loggedOut.announcement).toBe("");
    expect(indicatorView(loggedOut)).toBe("idle");
  });
});
