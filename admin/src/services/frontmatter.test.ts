import { describe, it, expect } from "vitest";
import { parseFrontmatter, stringifyFrontmatter } from "@shared/frontmatter";

describe("parseFrontmatter", () => {
  it("parses frontmatter and body from markdown", () => {
    const content = `---
manufacturer: Nikon
model: FE
---

This is the body.`;

    const result = parseFrontmatter(content);
    expect(result.attributes.manufacturer).toBe("Nikon");
    expect(result.attributes.model).toBe("FE");
    expect(result.body).toBe("This is the body.");
  });

  it("handles arrays in frontmatter", () => {
    const content = `---
relatedFiles:
  - nikon-fe-manual
  - nikon-fe-parts
---

Body text.`;

    const result = parseFrontmatter(content);
    expect(result.attributes.relatedFiles).toEqual(["nikon-fe-manual", "nikon-fe-parts"]);
  });

  it("returns empty attributes and full content when no frontmatter", () => {
    const content = "Just plain text with no frontmatter.";
    const result = parseFrontmatter(content);
    expect(result.attributes).toEqual({});
    expect(result.body).toBe("Just plain text with no frontmatter.");
  });

  it("handles empty body after frontmatter", () => {
    const content = `---
manufacturer: Canon
model: AE-1
---
`;
    const result = parseFrontmatter(content);
    expect(result.attributes.manufacturer).toBe("Canon");
    expect(result.body).toBe("");
  });

  it("handles troubleshooting array of objects", () => {
    const content = `---
manufacturer: Nikon
model: FE
troubleshooting:
  - symptom: Shutter stuck
    cause: Old lubricant
    solution: CLA needed
---

Body.`;

    const result = parseFrontmatter(content);
    expect(result.attributes.troubleshooting).toEqual([
      { symptom: "Shutter stuck", cause: "Old lubricant", solution: "CLA needed" },
    ]);
  });
});

describe("stringifyFrontmatter", () => {
  it("produces valid frontmatter with layout and tags", () => {
    const result = stringifyFrontmatter(
      { manufacturer: "Pentax", model: "K1000" },
      "Camera description.",
    );
    expect(result).toContain("---\n");
    expect(result).toContain("layout: item.11ty.tsx");
    expect(result).toContain("tags:");
    expect(result).toContain("- cameras");
    expect(result).toContain("manufacturer: Pentax");
    expect(result).toContain("model: K1000");
    expect(result).toContain("Camera description.");
  });

  it("removes empty arrays from output", () => {
    const result = stringifyFrontmatter(
      { manufacturer: "Pentax", model: "MX", relatedFiles: [], relatedLinks: [] },
      "Body.",
    );
    expect(result).not.toContain("relatedFiles");
    expect(result).not.toContain("relatedLinks");
  });

  it("preserves non-empty arrays", () => {
    const result = stringifyFrontmatter(
      { manufacturer: "Nikon", model: "FE", relatedFiles: ["nikon-fe-manual"] },
      "Body.",
    );
    expect(result).toContain("relatedFiles:");
    expect(result).toContain("- nikon-fe-manual");
  });

  it("roundtrips through parse and stringify", () => {
    const original = {
      manufacturer: "Nikon",
      model: "F3",
      relatedFiles: ["nikon-f3-service-manual"],
      relatedLinks: ["nikon-f3-video"],
      troubleshooting: [
        { symptom: "Meter off", cause: "Battery", solution: "Replace battery" },
      ],
    };
    const body = "A professional SLR.";

    const stringified = stringifyFrontmatter(original, body);
    const parsed = parseFrontmatter(stringified);

    expect(parsed.attributes.manufacturer).toBe("Nikon");
    expect(parsed.attributes.model).toBe("F3");
    expect(parsed.attributes.relatedFiles).toEqual(["nikon-f3-service-manual"]);
    expect(parsed.attributes.relatedLinks).toEqual(["nikon-f3-video"]);
    expect(parsed.attributes.troubleshooting).toEqual(original.troubleshooting);
    expect(parsed.body).toBe(body);
  });
});
