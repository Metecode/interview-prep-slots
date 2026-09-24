import { describe, expect, it } from "vitest";

import { simulatedSafeArea } from "./safeAreaSimulation";

describe("simulatedSafeArea", () => {
  it("?safe=iphone için iPhone ölçülerini döner", () => {
    expect(simulatedSafeArea("?safe=iphone")).toEqual({
      top: "59px",
      right: "0px",
      bottom: "34px",
      left: "0px",
    });
  });

  it("parametre yoksa null döner", () => {
    expect(simulatedSafeArea("")).toBeNull();
    expect(simulatedSafeArea("?foo=bar")).toBeNull();
  });

  it("bilinmeyen ön ayarda null döner", () => {
    expect(simulatedSafeArea("?safe=android")).toBeNull();
  });
});
