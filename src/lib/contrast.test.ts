import { describe, expect, it } from "vitest";
import { contrastRatio, luminance } from "./contrast";

describe("contrast", () => {
  it("measures luminance from black to white", () => {
    expect(luminance("#000000")).toBe(0);
    expect(luminance("#ffffff")).toBeCloseTo(1);
  });

  it("gives 21:1 for black on white, in either order", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21);
  });

  it("matches the WCAG value for a mid grey", () => {
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });
});
