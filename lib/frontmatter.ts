import { parse as yamlParse, stringify as yamlStringify } from "yaml";

export interface FrontmatterResult {
  attributes: Record<string, unknown>;
  body: string;
}

export function parseFrontmatter(content: string): FrontmatterResult {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { attributes: {}, body: content };
  }
  const attributes = yamlParse(match[1]) ?? {};
  const body = match[2].trim();
  return { attributes, body };
}

export function stringifyFrontmatter(
  attributes: Record<string, unknown>,
  body: string,
): string {
  const frontmatter: Record<string, unknown> = {
    layout: "item.11ty.tsx",
    tags: ["cameras"],
    ...attributes,
  };

  // Remove empty arrays to keep output clean
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value) && value.length === 0) {
      delete frontmatter[key];
    }
  }

  const yaml = yamlStringify(frontmatter, { lineWidth: 0 }).trimEnd();
  return `---\n${yaml}\n---\n\n${body.trim()}\n`;
}
