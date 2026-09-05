/**
 * The deeper cuts. Same house style as the ported charts: pure string builders, every
 * interpolated name through esc(), hand-tuned pixels.
 *
 * Colour follows the dataviz rules already used here: the validated categorical palette
 * for identity, and for "compared to the field" a DIVERGING scale built from the warm
 * and cool poles of that palette with a neutral middle. Red/green is deliberately not
 * used for good/bad -- it is the one pairing colourblind readers cannot separate.
 */
import type { EventState, GameId, PlayerId } from "../domain/types";
import {
  individualResults, relativeForm, headToHead, improvement, extremes,
} from "../lib/scoring";
import { fmtShort } from "../lib/time";
import { gColor, pColor, niceMax } from "../lib/palette";

const esc = (s: unknown): string =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const SURF = "#fffaf0";

/* ---------------------------------------------------------------- consistency */
/**
 * Best -> worst spread per competitor, with the average marked. Now that average
 * decides the day, the length of this bar is the story: a short bar is someone you
 * can rely on, a long one is someone who is one bad round from losing it.
 */
export function chartConsistency(state: EventState): string {
  const rows = individualResults(state)
    .filter((r) => r.avg != null && r.completed > 0)
    .sort((a, b) => a.avg! - b.avg!);
  if (!rows.length) return "";

  const W = 800, PADL = 132, PADR = 74, PADT = 26, ROW = 44;
  const AXIS = 34, H = PADT + rows.length * ROW + AXIS;
  const max = niceMax(Math.max(...rows.map((r) => r.worst ?? r.avg ?? 0)));
  const x = (v: number) => PADL + (v / max) * (W - PADL - PADR);
  let g = "";

  for (let i = 0; i <= 4; i++) {
    const v = max * i / 4, gx = x(v);
    g += `<line class="grid-l" x1="${gx}" y1="${PADT - 10}" x2="${gx}" y2="${H - AXIS + 6}"/>`
       + `<text class="lbl sm" x="${gx}" y="${H - AXIS + 22}" text-anchor="middle">${fmtShort(v)}</text>`;
  }
  g += `<text class="lbl sm" x="${(PADL + W - PADR) / 2}" y="${H - 4}" text-anchor="middle">`
     + `pentathlon time &mdash; shorter bar means steadier</text>`;

  rows.forEach((r, i) => {
    const y = PADT + i * ROW, cy = y + 16;
    const c = pColor(r.pid);
    const xb = x(r.best!), xw = x(r.worst!), xa = x(r.avg!);
    g += `<text class="lbl" x="${PADL - 12}" y="${cy + 4}" text-anchor="end">${esc(r.name)}</text>`;
    g += `<rect x="${xb}" y="${cy - 5}" width="${Math.max(2, xw - xb)}" height="10" rx="5" fill="${c}" opacity=".26"/>`;
    g += `<line x1="${xb}" y1="${cy - 9}" x2="${xb}" y2="${cy + 9}" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`;
    g += `<line x1="${xw}" y1="${cy - 9}" x2="${xw}" y2="${cy + 9}" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`;
    g += `<g transform="translate(${xa},${cy}) rotate(45)">`
       + `<rect x="-6.4" y="-6.4" width="12.8" height="12.8" rx="2" fill="${c}" stroke="${SURF}" stroke-width="2.5"/></g>`;
    g += `<text class="val" x="${xa}" y="${cy - 14}" text-anchor="middle">${fmtShort(r.avg!)}</text>`;
    const swing = r.worst! - r.best!;
    g += `<text class="val" x="${W - PADR + 8}" y="${cy + 4}" opacity=".7">&plusmn;${swing.toFixed(0)}s</text>`;
  });
  g += `<line class="axis-l" x1="${PADL}" y1="${PADT - 10}" x2="${PADL}" y2="${H - AXIS + 6}"/>`;

  const glyph = (inner: string) =>
    `<svg viewBox="0 0 16 16" style="width:14px;height:14px;vertical-align:-3px;margin-right:5px">${inner}</svg>`;
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;min-width:600px;height:auto">${g}</svg>`
    + `<div class="legend">`
    + `<span>${glyph('<rect x="6.5" y="1" width="3" height="14" rx="1.5" fill="#6b4c33"/>')}Best &amp; worst round</span>`
    + `<span>${glyph('<g transform="translate(8,8) rotate(45)"><rect x="-5" y="-5" width="10" height="10" rx="1.5" fill="#6b4c33"/></g>')}Average &mdash; this is the ranking</span>`
    + `<span>&plusmn; the swing between their best and worst</span></div>`;
}

/* ------------------------------------------------------------------ form grid */
/** Diverging scale: cool = quicker than the field, warm = slower, neutral = on it. */
function divergingFill(ratio: number): string {
  const t = Math.max(-1, Math.min(1, (ratio - 1) / 0.6));   // ±60% clamps to full strength
  if (Math.abs(t) < 0.08) return "#efe6d0";
  const [r1, g1, b1] = t < 0 ? [47, 90, 160] : [168, 51, 31];   // plain blue / barn red
  const k = Math.abs(t);
  const mix = (c: number) => Math.round(239 + (c - 239) * k);
  return `rgb(${mix(r1)},${mix(g1)},${mix(b1)})`;
}

/**
 * Who is good at what, relative to everyone else. A player's average at a station
 * divided by the field's average there. This is the chart that tells someone they are
 * the Cornhole guy even though they are fourth overall.
 */
export function chartForm(state: EventState): string {
  const forms = relativeForm(state);
  const games = state.games;
  const rows = forms.filter((f) => games.some((g) => f.byStation[g.id] != null));
  if (!rows.length || !games.length) return "";

  const CELL = 74, RH = 38, PADL = 132, PADT = 44;
  // right gutter sized to the longest caption, or "best at Horseshoes" gets clipped
  const longest = Math.max(0, ...games.map((g) => g.name.length));
  const PADR = 64 + longest * 7;
  const W = PADL + games.length * CELL + PADR;
  const H = PADT + rows.length * RH + 30;
  let g = "";

  games.forEach((gm, j) => {
    const cx = PADL + j * CELL + CELL / 2;
    g += `<text class="lbl" x="${cx}" y="${PADT - 22}" text-anchor="middle" `
       + `style="fill:${gColor(j)};font-size:11px">${esc(gm.name.slice(0, 10))}</text>`;
  });

  rows.forEach((f, i) => {
    const y = PADT + i * RH;
    g += `<text class="lbl" x="${PADL - 12}" y="${y + RH / 2 + 4}" text-anchor="end">${esc(f.name)}</text>`;
    let bestJ = -1, bestV = Infinity;
    games.forEach((gm, j) => {
      const v = f.byStation[gm.id];
      const cx = PADL + j * CELL;
      if (v == null) {
        g += `<rect x="${cx + 2}" y="${y + 2}" width="${CELL - 4}" height="${RH - 4}" rx="6" fill="#f2ece0"/>`;
        g += `<text class="lbl sm" x="${cx + CELL / 2}" y="${y + RH / 2 + 4}" text-anchor="middle">&ndash;</text>`;
        return;
      }
      if (v < bestV) { bestV = v; bestJ = j; }
      g += `<rect x="${cx + 2}" y="${y + 2}" width="${CELL - 4}" height="${RH - 4}" rx="6" `
         + `fill="${divergingFill(v)}" stroke="${SURF}" stroke-width="2"/>`;
      const pct = Math.round((v - 1) * 100);
      g += `<text class="val" x="${cx + CELL / 2}" y="${y + RH / 2 + 4}" text-anchor="middle" `
         + `style="fill:${Math.abs(v - 1) > 0.34 ? "#fff8e2" : "#2a2118"}">`
         + `${pct > 0 ? "+" : ""}${pct}%</text>`;
    });
    if (bestJ >= 0) {
      g += `<text class="lbl sm" x="${PADL + games.length * CELL + 10}" y="${y + RH / 2 + 4}">`
         + `best at ${esc(games[bestJ].name)}</text>`;
    }
  });

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;min-width:${W}px;height:auto">${g}</svg>`
    + `<div class="legend">`
    + `<span><i style="background:#2f5aa0"></i>Quicker than the field</span>`
    + `<span><i style="background:#efe6d0"></i>About average</span>`
    + `<span><i style="background:#a8331f"></i>Slower than the field</span>`
    + `<span>Each cell is that person&rsquo;s average at the station vs everyone else&rsquo;s</span></div>`;
}

/* ------------------------------------------------------------------- head to head */
/** Who actually beats whom, round for round. The bragging-rights chart. */
export function chartHeadToHead(state: EventState): string {
  const h = headToHead(state);
  const ps = individualResults(state)
    .filter((r) => r.avg != null)
    .sort((a, b) => a.avg! - b.avg!)
    .map((r) => ({ pid: r.pid, name: r.name }));
  if (ps.length < 2) return "";

  const CELL = 46, PADL = 118, PADT = 96;
  const W = PADL + ps.length * CELL + 20, H = PADT + ps.length * CELL + 20;
  let g = "";

  ps.forEach((p, j) => {
    const cx = PADL + j * CELL + CELL / 2;
    g += `<text class="lbl sm" x="${cx}" y="${PADT - 10}" text-anchor="start" `
       + `transform="rotate(-52 ${cx} ${PADT - 10})">${esc(p.name)}</text>`;
  });

  ps.forEach((a, i) => {
    const y = PADT + i * CELL;
    g += `<text class="lbl" x="${PADL - 10}" y="${y + CELL / 2 + 4}" text-anchor="end">${esc(a.name)}</text>`;
    ps.forEach((b, j) => {
      const x = PADL + j * CELL;
      if (a.pid === b.pid) {
        g += `<rect x="${x + 2}" y="${y + 2}" width="${CELL - 4}" height="${CELL - 4}" rx="7" fill="#e6ddc8"/>`;
        return;
      }
      const r = h[a.pid][b.pid];
      if (!r || r.played === 0) {
        g += `<rect x="${x + 2}" y="${y + 2}" width="${CELL - 4}" height="${CELL - 4}" rx="7" fill="#f2ece0"/>`;
        return;
      }
      const share = r.wins / r.played;
      g += `<rect x="${x + 2}" y="${y + 2}" width="${CELL - 4}" height="${CELL - 4}" rx="7" `
         + `fill="${divergingFill(1 - (share - 0.5) * 1.2)}" stroke="${SURF}" stroke-width="2"/>`;
      g += `<text class="val" x="${x + CELL / 2}" y="${y + CELL / 2 + 4}" text-anchor="middle" `
         + `style="fill:${Math.abs(share - 0.5) > 0.3 ? "#fff8e2" : "#2a2118"}">${r.wins}&ndash;${r.losses}</text>`;
    });
  });

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;min-width:${W}px;height:auto">${g}</svg>`
    + `<div class="legend"><span>Read across: how the person on the left did against each person along the top,`
    + ` counting only rounds they both finished.</span></div>`;
}

/* -------------------------------------------------------------------- momentum */
/** First complete round vs latest. Who is warming up and who is falling apart. */
export function chartMomentum(state: EventState): string {
  const rows = improvement(state).sort((a, b) => b.delta - a.delta);
  if (!rows.length) return "";
  const W = 760, PADL = 128, PADR = 90, PADT = 24, ROW = 34;
  const H = PADT + rows.length * ROW + 34;
  const max = Math.max(...rows.map((r) => Math.abs(r.delta)), 1);
  const mid = PADL + (W - PADL - PADR) / 2;
  const half = (W - PADL - PADR) / 2;
  let g = `<line class="axis-l" x1="${mid}" y1="${PADT - 8}" x2="${mid}" y2="${H - 30}"/>`;

  rows.forEach((r, i) => {
    const y = PADT + i * ROW, cy = y + 14;
    const w = (Math.abs(r.delta) / max) * (half - 12);
    const better = r.delta > 0;
    g += `<text class="lbl" x="${PADL - 12}" y="${cy + 4}" text-anchor="end">${esc(r.name)}</text>`;
    g += `<rect x="${better ? mid - w : mid}" y="${cy - 9}" width="${Math.max(2, w)}" height="18" rx="4" `
       + `fill="${better ? "#2f5aa0" : "#a8331f"}"/>`;
    g += `<text class="val" x="${better ? mid - w - 8 : mid + w + 8}" y="${cy + 4}" `
       + `text-anchor="${better ? "end" : "start"}">${better ? "-" : "+"}${Math.abs(r.delta).toFixed(0)}s</text>`;
  });
  g += `<text class="lbl sm" x="${mid - half / 2}" y="${H - 10}" text-anchor="middle">quicker than they started</text>`;
  g += `<text class="lbl sm" x="${mid + half / 2}" y="${H - 10}" text-anchor="middle">slower than they started</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;min-width:560px;height:auto">${g}</svg>`;
}

/* ------------------------------------------------------- hall of fame / shame */
export function fameAndShame(state: EventState): { fastest: string; slowest: string } {
  const { fastest, slowest } = extremes(state);
  const tile = (e: { v: number; name: string; game: string; when: string }, i: number, warm: boolean) =>
    `<li class="${i === 0 ? "top" : ""}"><span class="n">${i + 1}</span>`
    + `<span class="g">${esc(e.name)}<em>${esc(e.game)} &middot; ${esc(e.when)}</em></span>`
    + `<span class="t" style="color:${warm ? "#a8331f" : "#2f5aa0"}">${e.v.toFixed(2)}s</span></li>`;
  return {
    fastest: fastest.length ? `<ol class="fame">${fastest.map((e, i) => tile(e, i, false)).join("")}</ol>` : "",
    slowest: slowest.length ? `<ol class="fame">${slowest.map((e, i) => tile(e, i, true)).join("")}</ol>` : "",
  };
}

export type { GameId, PlayerId };
