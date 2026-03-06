export const BULLET_COLOURS = [
  "red",
  "pink",
  "purple",
  "deep-purple",
  "blue",
  "cyan",
  "teal",
  "green",
  "yellow",
  "orange",
] as const;

export const CALLOUT_TYPES = ["caution", "note", "reminder"] as const;

export const BULLET_STYLES = [...BULLET_COLOURS, ...CALLOUT_TYPES] as const;
export type BulletStyle = (typeof BULLET_STYLES)[number];

export const STYLE_HEX: Record<BulletStyle, string> = {
  red: "#e53935",
  pink: "#d81b60",
  purple: "#8e24aa",
  "deep-purple": "#5e35b1",
  blue: "#1e88e5",
  cyan: "#00acc1",
  teal: "#00897b",
  green: "#43a047",
  yellow: "#f9a825",
  orange: "#fb8c00",
  caution: "#e53935",
  note: "#1e88e5",
  reminder: "#555555",
};

export const CALLOUT_ICONS: Record<string, string> = {
  caution: "\u26A0",
  note: "\u2139",
  reminder: "\u21BB",
};

export const ANNOTATION_COLOUR_UNLINKED = "#999999";

export function bulletStyleHex(style: BulletStyle | undefined, index: number): string {
  if (style) return STYLE_HEX[style];
  return STYLE_HEX[BULLET_COLOURS[index % BULLET_COLOURS.length]];
}

export function isCallout(style: BulletStyle | undefined): style is "caution" | "note" | "reminder" {
  return style === "caution" || style === "note" || style === "reminder";
}
