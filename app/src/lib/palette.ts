/** Colour. The station palette is the one validated with the dataviz checker:
 *  it passes the lightness band, chroma floor, CVD separation, normal-vision floor
 *  and 3:1 contrast against the cream chart surface. Do not re-pick by eye. */

export const GAME_COLORS = ["#a8331f", "#b8891f", "#4a7c3f", "#2f5aa0", "#c9622b"] as const;

export const PLAYER_COLORS = [
  "#8f2a1f", "#e8b93b", "#4a7c3f", "#2c4470",
  "#6b3f6e", "#c9622b", "#3f8f8a", "#a3143c",
] as const;

export const FIGURES = [
  "s-cheer-a", "s-man", "s-cheer-b", "s-man",
  "s-cheer-c", "s-man", "s-cheer-a", "s-man",
] as const;

export const gColor = (i: number): string => GAME_COLORS[i % GAME_COLORS.length];

/**
 * Colour keyed off a STABLE identity, never array position.
 *
 * The legacy app used the player's index in the array. Once state merges across
 * devices, two phones can hold slightly different orderings and show different
 * colours for the same person mid-event -- confusing exactly when it matters.
 * Deriving from the id makes every device agree.
 */
export function slotForId(id: string): number {
  const m = /^p(\d+)$/.exec(id);
  if (m) return (parseInt(m[1], 10) - 1) % PLAYER_COLORS.length;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % PLAYER_COLORS.length;
}

export const pColor = (id: string): string => PLAYER_COLORS[slotForId(id)];
export const pFigure = (id: string): string => FIGURES[slotForId(id)];

/** Readable text colour for a label sitting on top of a filled mark. */
export function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.62 ? "#2a2118" : "#fff8e2";
}

/** Round an axis maximum up so the four tick labels land on whole seconds/minutes
 *  (0:40, 1:20, 2:00) rather than 0:38 / 1:15. */
const TICK_STEPS = [1, 2, 5, 10, 15, 20, 30, 40, 60, 90, 120, 180, 240, 300, 600];
export function niceMax(v: number): number {
  if (!isFinite(v) || v <= 0) return 10;
  const want = v / 4;
  for (const st of TICK_STEPS) if (st >= want) return st * 4;
  return Math.ceil(want / 600) * 600 * 4;
}
