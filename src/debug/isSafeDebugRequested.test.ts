import { describe, expect, it } from "vitest";

import { isSafeDebugRequested } from "./isSafeDebugRequested";

describe("isSafeDebugRequested", () => {
  it("?debug=safe varsa true döner", () => {
    expect(isSafeDebugRequested("?debug=safe")).toBe(true);
    expect(isSafeDebugRequested("?foo=1&debug=safe")).toBe(true);
  });

  it("parametre yoksa ya da başka değerdeyse false döner", () => {
    expect(isSafeDebugRequested("")).toBe(false);
    expect(isSafeDebugRequested("?debug=other")).toBe(false);
    expect(isSafeDebugRequested("?safe=iphone")).toBe(false);
  });
});
