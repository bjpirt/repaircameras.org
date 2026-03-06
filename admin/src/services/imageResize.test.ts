import { describe, it, expect } from "vitest";
import { generateFilename, calculateResizeDimensions } from "./imageResize";

describe("generateFilename", () => {
  it("returns a 6-char hex string with .jpg extension", () => {
    const name = generateFilename();
    expect(name).toMatch(/^[0-9a-f]{6}\.jpg$/);
  });

  it("generates different filenames on successive calls", () => {
    const names = new Set(Array.from({ length: 10 }, () => generateFilename()));
    expect(names.size).toBeGreaterThan(1);
  });
});

describe("calculateResizeDimensions", () => {
  it("returns original dimensions when within limit", () => {
    expect(calculateResizeDimensions(800, 600, 2000)).toEqual({ width: 800, height: 600 });
  });

  it("scales down landscape images", () => {
    expect(calculateResizeDimensions(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
  });

  it("scales down portrait images", () => {
    expect(calculateResizeDimensions(3000, 4000, 2000)).toEqual({ width: 1500, height: 2000 });
  });
});
