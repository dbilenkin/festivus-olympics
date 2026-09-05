/**
 * The eight charts, carried over from the single-file app as string builders.
 *
 * They stay string functions on purpose. They are already pure, non-interactive and
 * hand-tuned to the pixel; rewriting eight layout algorithms as JSX would risk
 * off-by-one regressions in exchange for nothing.
 *
 * esc() is a SECURITY control here, not formatting. Names arrive from a wide-open API
 * and are interpolated into markup that gets set as innerHTML -- drop it on one
 * interpolation and you have stored XSS firing on every phone at the party. The server
 * also rejects angle brackets; this is the second layer.
 */
import type { EventState, PlayerId, TeamKey } from "../domain/types";
import type { IndividualRow } from "../lib/scoring";
import { relayTeamTotal } from "../lib/scoring";
import { fmtClock, fmtShort, mean } from "../lib/time";
import { gColor, inkOn, niceMax, pColor as basePColor } from "../lib/palette";

export interface ChartCtx {
  players: EventState["players"];
  games: EventState["games"];
  rounds: EventState["rounds"];
  relays: EventState["relays"];
  teamName: (k: TeamKey) => string;
  pColor: (id: PlayerId) => string;
}

export const ctxOf = (s: EventState): ChartCtx => ({
  players: s.players, games: s.games, rounds: s.rounds, relays: s.relays,
  teamName: (k) => s.teams[k].name,
  pColor: basePColor,
});

const esc = (s: unknown): string =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

interface StackRow { pid: PlayerId; name: string; total: number; parts: number[] }
interface RangeRow { name: string; color: string; vals: { v: number; who: string; when: string }[];
  best: number; worst: number; avg: number; n: number }
interface LegRow { label: string; k: TeamKey; total: number; parts: (number | null)[] }
interface PieRow { id: string; name: string; color: string; pent: number; relay: number;
  n: number; total: number }

const trunc = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + "\u2026" : t);

export function chartLeaderboard(res: IndividualRow[], C: ChartCtx): string {
  const rows = res.filter((r) => r.best != null).sort((a, b) => a.best! - b.best!);
  if(!rows.length) return "";
  const W=760, PADL=112, PADR=62, PADT=26, ROW=42;
  const H = PADT + rows.length*ROW + 26;
  const max = niceMax(Math.max.apply(null, rows.map(r=>Math.max(r.best!, r.avg ?? 0))));
  const sx = (v: number) => PADL + (v/max)*(W-PADL-PADR);
  let g = "";
  for(let i=0;i<=4;i++){
    const v = max*i/4, x = sx(v);
    g += '<line class="grid-l" x1="'+x+'" y1="'+(PADT-8)+'" x2="'+x+'" y2="'+(H-24)+'"/>'+
         '<text class="lbl sm" x="'+x+'" y="'+(H-10)+'" text-anchor="middle">'+fmtShort(v)+'</text>';
  }
  rows.forEach((r,i)=>{
    const y = PADT + i*ROW;
    g += '<text class="lbl" x="'+(PADL-10)+'" y="'+(y+17)+'" text-anchor="end">'+esc(r.name)+'</text>';
    g += '<rect x="'+PADL+'" y="'+(y+2)+'" width="'+(sx(r.best!)-PADL)+'" height="15" rx="3" fill="'+C.pColor(r.pid)+'" stroke="#2a2118" stroke-width="1.5"/>';
    g += '<text class="val" x="'+(sx(r.best!)+6)+'" y="'+(y+14)+'">'+fmtShort(r.best!)+'</text>';
    if(r.avg!=null){
      g += '<rect x="'+PADL+'" y="'+(y+20)+'" width="'+(sx(r.avg!)-PADL)+'" height="10" rx="3" fill="'+C.pColor(r.pid)+'" opacity=".38" stroke="#2a2118" stroke-width="1"/>';
      g += '<text class="val" x="'+(sx(r.avg!)+6)+'" y="'+(y+29)+'" opacity=".65">'+fmtShort(r.avg!)+'</text>';
    }
  });
  g += '<line class="axis-l" x1="'+PADL+'" y1="'+(PADT-8)+'" x2="'+PADL+'" y2="'+(H-24)+'"/>';
  return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;min-width:520px;height:auto">'+g+'</svg>'+
    '<div class="legend"><span><i style="background:var(--barn)"></i>Best pentathlon</span>'+
    '<span><i style="background:var(--barn);opacity:.4"></i>Average pentathlon</span></div>';
}

/* --- 2. where the time goes: best round, stacked by station --- */
export function chartStacked(res: IndividualRow[], C: ChartCtx): string {
  const rows = res.map((r): StackRow | null => {
    let bi = -1, bv = Infinity;
    r.totals.forEach((t,i)=>{ if(t!=null && t<bv){ bv=t; bi=i; } });
    if(bi<0) return null;
    const sc = C.rounds[bi].scores[r.pid] || {};
    return { pid:r.pid, name:r.name, total:bv, parts:C.games.map(g=>sc[g.id]||0) };
  }).filter((r): r is StackRow => r !== null).sort((a, b) => a.total - b.total);
  if(!rows.length) return "";
  const W=760, PADL=112, PADR=62, PADT=26, ROW=34;
  const H = PADT + rows.length*ROW + 26;
  const max = niceMax(Math.max.apply(null, rows.map(r=>r.total)));
  const sw = (v: number) => (v/max)*(W-PADL-PADR);
  let g = "";
  for(let i=0;i<=4;i++){
    const x = PADL + sw(max*i/4);
    g += '<line class="grid-l" x1="'+x+'" y1="'+(PADT-8)+'" x2="'+x+'" y2="'+(H-24)+'"/>'+
         '<text class="lbl sm" x="'+x+'" y="'+(H-10)+'" text-anchor="middle">'+fmtShort(max*i/4)+'</text>';
  }
  rows.forEach((r,i)=>{
    const y = PADT + i*ROW;
    g += '<text class="lbl" x="'+(PADL-10)+'" y="'+(y+16)+'" text-anchor="end">'+esc(r.name)+'</text>';
    let x = PADL;
    r.parts.forEach((v,j)=>{
      const w = sw(v);
      if(w > .5){
        g += '<rect x="'+x+'" y="'+(y+2)+'" width="'+w+'" height="21" fill="'+gColor(j)+'" stroke="#2a2118" stroke-width="1.2"/>';
        if(w > 34) g += '<text class="val" x="'+(x+w/2)+'" y="'+(y+16)+'" text-anchor="middle" style="fill:'+inkOn(gColor(j))+'">'+Math.round(v)+'</text>';
      }
      x += w;
    });
    g += '<text class="val" x="'+(x+6)+'" y="'+(y+16)+'">'+fmtShort(r.total!)+'</text>';
  });
  g += '<line class="axis-l" x1="'+PADL+'" y1="'+(PADT-8)+'" x2="'+PADL+'" y2="'+(H-24)+'"/>';
  return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;min-width:520px;height:auto">'+g+'</svg>'+
    '<div class="legend">'+C.games.map((gm,j)=>'<span><i style="background:'+gColor(j)+'"></i>'+esc(gm.name)+'</span>').join("")+'</div>';
}

/* --- 3. round-by-round lines --- */
export function chartProgress(res: IndividualRow[], C: ChartCtx): string {
  if(C.rounds.length < 2) return "";
  const rows = res.filter(r=>r.totals.some(t=>t!=null));
  if(!rows.length) return "";
  const W = Math.max(760, 140 + C.rounds.length*110);
  const PADL=64, PADR=100, PADT=22, PADB=44, H=380;
  const all = rows.flatMap(r=>r.totals).filter(t=>t!=null);
  const max = niceMax(Math.max.apply(null, all)), min = 0;
  const sx = (i: number) => PADL + (C.rounds.length===1?0:i*(W-PADL-PADR)/(C.rounds.length-1));
  const sy = (v: number) => H-PADB - ((v-min)/(max-min))*(H-PADT-PADB);
  let g = "";
  for(let i=0;i<=5;i++){
    const v = max*i/5, y = sy(v);
    g += '<line class="grid-l" x1="'+PADL+'" y1="'+y+'" x2="'+(W-PADR+20)+'" y2="'+y+'"/>'+
         '<text class="lbl sm" x="'+(PADL-8)+'" y="'+(y+4)+'" text-anchor="end">'+fmtShort(v)+'</text>';
  }
  C.rounds.forEach((r,i)=>{
    g += '<text class="lbl" x="'+sx(i)+'" y="'+(H-PADB+22)+'" text-anchor="middle">'+esc(r.label)+'</text>';
  });
  const ends: { name: string; c: string; x: number; y: number; ly: number }[] = [];
  rows.forEach(r=>{
    const pts = r.totals.map((t, i) => (t == null ? null : [sx(i), sy(t)] as [number, number]))
      .filter((p): p is [number, number] => p !== null);
    if(!pts.length) return;
    const c = C.pColor(r.pid);
    if(pts.length>1) g += '<polyline points="'+pts.map(p=>p[0]+","+p[1]).join(" ")+'" fill="none" stroke="'+c+'" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>';
    pts.forEach(p=> g += '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="5" fill="'+c+'" stroke="#2a2118" stroke-width="1.5"/>');
    const last = pts[pts.length-1];
    ends.push({ name:r.name, c, x:last[0], y:last[1], ly:last[1] });
  });
  // nudge end labels apart so close finishers don't print on top of each other
  ends.sort((a,b)=>a.ly-b.ly);
  const GAP = 15;
  for(let i=1;i<ends.length;i++) if(ends[i].ly - ends[i-1].ly < GAP) ends[i].ly = ends[i-1].ly + GAP;
  const over = ends.length ? ends[ends.length-1].ly - (H-PADB) : 0;
  if(over > 0) ends.forEach(e => e.ly -= over);
  ends.forEach(e=>{
    if(Math.abs(e.ly - e.y) > 2)
      g += '<path d="M'+(e.x+6)+' '+e.y+' L'+(e.x+13)+' '+e.ly+'" stroke="'+e.c+'" stroke-width="1.4" fill="none" opacity=".65"/>';
    g += '<text class="lbl" x="'+(e.x+16)+'" y="'+(e.ly+4)+'" style="fill:'+e.c+'">'+esc(e.name)+'</text>';
  });
  g += '<line class="axis-l" x1="'+PADL+'" y1="'+PADT+'" x2="'+PADL+'" y2="'+(H-PADB)+'"/>'+
       '<line class="axis-l" x1="'+PADL+'" y1="'+(H-PADB)+'" x2="'+(W-PADR+20)+'" y2="'+(H-PADB)+'"/>';
  return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;min-width:'+W+'px;height:auto">'+g+'</svg>';
}

/* --- 4. small multiples: best time per station --- */
export function chartStationSmalls(res: IndividualRow[], C: ChartCtx): string {
  const cards = C.games.map((gm,j)=>{
    const rows = res.map((r) => ({ pid: r.pid, name: r.name, v: r.perGameBest[gm.id] }))
      .filter((r): r is { pid: string; name: string; v: number } => r.v != null)
      .sort((a, b) => a.v - b.v);
    if(!rows.length) return "";
    const W=320, PADT=22, PADB=40, PADL=10, H=190;
    const max = niceMax(Math.max.apply(null, rows.map(r=>r.v)));
    const bw = (W-PADL*2)/rows.length;
    let g = '<text class="lbl" x="'+(W/2)+'" y="14" text-anchor="middle" style="fill:'+gColor(j)+';font-size:13px;font-weight:900">'+esc(gm.name)+'</text>';
    rows.forEach((r,i)=>{
      const h = (r.v/max)*(H-PADT-PADB);
      const x = PADL + i*bw + bw*.16, w = bw*.68, y = H-PADB-h;
      g += '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="2" fill="'+(i===0?gColor(j):C.pColor(r.pid))+'" stroke="#2a2118" stroke-width="1.2" opacity="'+(i===0?1:.72)+'"/>';
      g += '<text class="val" x="'+(x+w/2)+'" y="'+(y-4)+'" text-anchor="middle">'+r.v.toFixed(1)+'</text>';
      g += '<text class="lbl sm" x="'+(x+w/2)+'" y="'+(H-PADB+13)+'" text-anchor="middle" transform="rotate(-38 '+(x+w/2)+' '+(H-PADB+13)+')">'+esc(r.name)+'</text>';
    });
    g += '<line class="axis-l" x1="'+PADL+'" y1="'+(H-PADB)+'" x2="'+(W-PADL)+'" y2="'+(H-PADB)+'"/>';
    return '<div style="background:#fff;border:2px solid var(--ink);border-radius:10px;padding:6px">'+
      '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto">'+g+'</svg></div>';
  }).join("");
  return cards ? '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px">'+cards+'</div>' : "";
}

/* --- 5. relay head to head --- */
export function chartRelays(C: ChartCtx): string {
  const rows = C.relays.map((r) => ({ label: r.label, a: relayTeamTotal(r, "A"), b: relayTeamTotal(r, "B") }))
    .filter((r) => r.a != null || r.b != null);
  if(!rows.length) return "";
  const W=760, PADL=118, PADR=70, PADT=20, ROW=52;
  const H = PADT + rows.length*ROW + 26;
  const max = niceMax(Math.max.apply(null, rows.flatMap(r=>[r.a||0,r.b||0])));
  const sw = (v: number) => (v/max)*(W-PADL-PADR);
  let g = "";
  for(let i=0;i<=4;i++){
    const x = PADL + sw(max*i/4);
    g += '<line class="grid-l" x1="'+x+'" y1="'+(PADT-6)+'" x2="'+x+'" y2="'+(H-24)+'"/>'+
         '<text class="lbl sm" x="'+x+'" y="'+(H-10)+'" text-anchor="middle">'+fmtShort(max*i/4)+'</text>';
  }
  rows.forEach((r,i)=>{
    const y = PADT + i*ROW;
    g += '<text class="lbl" x="'+(PADL-10)+'" y="'+(y+26)+'" text-anchor="end">'+esc(r.label)+'</text>';
    ([["a", "#8f2a1f"], ["b", "#2c4470"]] as const).forEach(([k, c], n) => {
      const v = r[k as "a" | "b"]; if (v == null) return;
      const yy = y + 2 + n*22;
      const win = r.a!=null && r.b!=null && ((k==="a"&&r.a<r.b)||(k==="b"&&r.b<r.a));
      g += '<rect x="'+PADL+'" y="'+yy+'" width="'+sw(v)+'" height="18" rx="3" fill="'+c+'" stroke="#2a2118" stroke-width="'+(win?2.5:1.2)+'"/>';
      g += '<text class="val" x="'+(PADL+sw(v)+6)+'" y="'+(yy+13)+'">'+fmtShort(v)+(win?" 🏆":"")+'</text>';
    });
  });
  g += '<line class="axis-l" x1="'+PADL+'" y1="'+(PADT-6)+'" x2="'+PADL+'" y2="'+(H-24)+'"/>';
  return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;min-width:520px;height:auto">'+g+'</svg>'+
    '<div class="legend"><span><i style="background:#8f2a1f"></i>'+esc(C.teamName("A"))+'</span>'+
    '<span><i style="background:#2c4470"></i>'+esc(C.teamName("B"))+'</span></div>';
}

/* --- 6. relay legs, stacked, so you can see which leg lost it --- */
export function chartRelayLegs(C: ChartCtx): string {
  const rows: LegRow[] = [];
  C.relays.forEach(r=>{
    (["A", "B"] as TeamKey[]).forEach((k) => {
      const t = relayTeamTotal(r, k);
      if(t!=null) rows.push({ label:trunc(r.label+" \u00b7 "+C.teamName(k), 30), k, total:t,
                              parts:r.entries[k].splits.slice(0, r.legs.length) });
    });
  });
  if(!rows.length) return "";
  const W=790, PADL=200, PADR=62, PADT=24, ROW=34;
  const H = PADT + rows.length*ROW + 26;
  const max = niceMax(Math.max.apply(null, rows.map(r=>r.total)));
  const sw = (v: number) => (v/max)*(W-PADL-PADR);
  let g = "";
  for(let i=0;i<=4;i++){
    const x = PADL + sw(max*i/4);
    g += '<line class="grid-l" x1="'+x+'" y1="'+(PADT-8)+'" x2="'+x+'" y2="'+(H-24)+'"/>'+
         '<text class="lbl sm" x="'+x+'" y="'+(H-10)+'" text-anchor="middle">'+fmtShort(max*i/4)+'</text>';
  }
  rows.forEach((r,i)=>{
    const y = PADT + i*ROW;
    g += '<text class="lbl" x="'+(PADL-10)+'" y="'+(y+16)+'" text-anchor="end" style="fill:'+
         (r.k==="A"?"#8f2a1f":"#2c4470")+'">'+esc(r.label)+'</text>';
    let x = PADL;
    r.parts.forEach((v,j)=>{
      const w = sw(v||0);
      if(w > .5){
        g += '<rect x="'+x+'" y="'+(y+2)+'" width="'+w+'" height="21" fill="'+gColor(j)+'" stroke="#2a2118" stroke-width="1.2"/>';
        if(w > 34) g += '<text class="val" x="'+(x+w/2)+'" y="'+(y+16)+'" text-anchor="middle" style="fill:'+inkOn(gColor(j))+'">'+Math.round(v!)+'</text>';
      }
      x += w;
    });
    g += '<text class="val" x="'+(x+6)+'" y="'+(y+16)+'">'+fmtShort(r.total!)+'</text>';
  });
  g += '<line class="axis-l" x1="'+PADL+'" y1="'+(PADT-8)+'" x2="'+PADL+'" y2="'+(H-24)+'"/>';
  return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;min-width:560px;height:auto">'+g+'</svg>'+
    '<div class="legend">'+C.games.map((gm,j)=>'<span><i style="background:'+gColor(j)+'"></i>'+esc(gm.name)+'</span>').join("")+'</div>';
}


/* --- 7. station report card: best / average / worst, per station, one shared axis --- */
export function chartStationRange(C: ChartCtx): string {
  const SURF = "#fffaf0";
  const rows = C.games.map((g, j): RangeRow | null => {
    const vals: { v: number; who: string; when: string }[] = [];
    C.rounds.forEach(rd => C.players.forEach(pl=>{
      const v = (rd.scores[pl.id]||{})[g.id];
      if(v!=null && isFinite(v)) vals.push({ v, who:pl.name, when:rd.label });
    }));
    if(!vals.length) return null;
    const nums = vals.map(x=>x.v);
    const best = Math.min.apply(null,nums), worst = Math.max.apply(null,nums);
    return { name: g.name, color: gColor(j), vals, best, worst, avg: mean(nums)!, n: vals.length };
  }).filter((r): r is RangeRow => r !== null);
  if(!rows.length) return "";
  rows.sort((a,b)=>a.avg-b.avg);                       // quickest station on top

  const W=800, PADL=196, PADR=80, PADT=26, ROW=52;
  const AXIS = 34, H = PADT + rows.length*ROW + AXIS;
  const max = niceMax(Math.max.apply(null, rows.map(r=>r.worst)));
  const x = (v: number) => PADL + (v/max)*(W-PADL-PADR);
  const clampX = (v: number) => Math.max(PADL+16, Math.min(W-PADR-16, v));
  let g = "";

  for(let i=0;i<=4;i++){
    const v = max*i/4, gx = x(v);
    g += '<line class="grid-l" x1="'+gx+'" y1="'+(PADT-10)+'" x2="'+gx+'" y2="'+(H-AXIS+6)+'"/>'+
         '<text class="lbl sm" x="'+gx+'" y="'+(H-AXIS+22)+'" text-anchor="middle">'+fmtShort(v)+'</text>';
  }
  g += '<text class="lbl sm" x="'+((PADL+W-PADR)/2)+'" y="'+(H-4)+'" text-anchor="middle">seconds — further right is slower</text>';

  rows.forEach((r,i)=>{
    const y = PADT + i*ROW, cy = y + 19;
    g += '<rect x="'+(PADL-172)+'" y="'+(cy-6)+'" width="12" height="12" rx="3" fill="'+r.color+'"/>';
    g += '<text class="lbl" x="'+(PADL-154)+'" y="'+(cy+4)+'">'+esc(r.name)+'</text>';
    g += '<text class="lbl sm" x="'+(PADL-14)+'" y="'+(cy+4)+'" text-anchor="end">'+r.n+' runs</text>';

    const xb = x(r.best), xw = x(r.worst), xa = x(r.avg);
    g += '<rect x="'+xb+'" y="'+(cy-5)+'" width="'+Math.max(2,xw-xb)+'" height="10" rx="5" fill="'+r.color+'" opacity=".26"/>';
    g += '<line x1="'+xb+'" y1="'+(cy-9)+'" x2="'+xb+'" y2="'+(cy+9)+'" stroke="'+r.color+'" stroke-width="2.5" stroke-linecap="round"/>';
    g += '<line x1="'+xw+'" y1="'+(cy-9)+'" x2="'+xw+'" y2="'+(cy+9)+'" stroke="'+r.color+'" stroke-width="2.5" stroke-linecap="round"/>';
    r.vals.forEach(a=>{
      g += '<circle cx="'+x(a.v)+'" cy="'+cy+'" r="3.4" fill="'+r.color+'" opacity=".85" stroke="'+SURF+'" stroke-width="1.6">'+
           '<title>'+esc(a.who+" — "+a.v.toFixed(2)+"s ("+a.when+")")+'</title></circle>';
    });
    g += '<g transform="translate('+xa+','+cy+') rotate(45)">'+
           '<rect x="-6.4" y="-6.4" width="12.8" height="12.8" rx="2" fill="'+r.color+'" stroke="'+SURF+'" stroke-width="2.5">'+
           '<title>average '+r.avg.toFixed(2)+'s</title></rect></g>';

    g += '<text class="val" x="'+clampX(xa)+'" y="'+(cy-14)+'" text-anchor="middle">'+r.avg.toFixed(1)+'</text>';
    if(xw - xb >= 76){
      g += '<text class="val" x="'+clampX(xb)+'" y="'+(cy+24)+'" text-anchor="middle" opacity=".72">'+r.best.toFixed(1)+'</text>';
      g += '<text class="val" x="'+clampX(xw)+'" y="'+(cy+24)+'" text-anchor="middle" opacity=".72">'+r.worst.toFixed(1)+'</text>';
    } else {
      g += '<text class="val" x="'+(xw+9)+'" y="'+(cy+4)+'" opacity=".72">'+r.best.toFixed(1)+'–'+r.worst.toFixed(1)+'</text>';
    }
  });
  g += '<line class="axis-l" x1="'+PADL+'" y1="'+(PADT-10)+'" x2="'+PADL+'" y2="'+(H-AXIS+6)+'"/>';

  const glyph = (inner: string) => '<svg viewBox="0 0 16 16" style="width:14px;height:14px;vertical-align:-3px;margin-right:5px">'+inner+'</svg>';
  return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;min-width:620px;height:auto">'+g+'</svg>'+
    '<div class="legend">'+
      '<span>'+glyph('<rect x="6.5" y="1" width="3" height="14" rx="1.5" fill="#6b4c33"/>')+'Best &amp; worst</span>'+
      '<span>'+glyph('<g transform="translate(8,8) rotate(45)"><rect x="-5" y="-5" width="10" height="10" rx="1.5" fill="#6b4c33"/></g>')+'Average</span>'+
      '<span>'+glyph('<circle cx="8" cy="8" r="3.4" fill="#6b4c33" opacity=".85"/>')+'One run</span>'+
      '<span>'+glyph('<rect x="1" y="5" width="14" height="6" rx="3" fill="#6b4c33" opacity=".26"/>')+'Full spread</span>'+
    '</div>';
}


/* --- 8. share of the day's clock, by station (part-to-whole, 5 slices) --- */
function stationTimeTotals(C: ChartCtx): PieRow[] {
  const rows: PieRow[] = C.games.map((g, j) => ({
    id: g.id, name: g.name, color: gColor(j), pent: 0, relay: 0, n: 0, total: 0 }));
  const by: Record<string, PieRow> = {}; rows.forEach((r) => { by[r.id] = r; });
  C.rounds.forEach(rd => C.players.forEach(pl => C.games.forEach(g=>{
    const v = (rd.scores[pl.id]||{})[g.id];
    if(v!=null && isFinite(v)){ by[g.id].pent += v; by[g.id].n++; }
  })));
  C.relays.forEach(r => (["A", "B"] as TeamKey[]).forEach((k) => {
    const e = r.entries[k]; if(!e) return;
    r.legs.forEach((gid,i)=>{
      const v = e.splits[i];
      if(v!=null && isFinite(v) && by[gid]){ by[gid].relay += v; by[gid].n++; }
    });
  }));
  rows.forEach(r => r.total = r.pent + r.relay);
  return rows.filter(r => r.total > 0);
}

export function chartStationPie(C: ChartCtx): string {
  const SURF = "#fffaf0";
  const rows = stationTimeTotals(C);
  if(!rows.length) return "";
  const grand = rows.reduce((a,b)=>a+b.total,0);
  const sorted = rows.slice().sort((a,b)=>b.total-a.total);

  const SZ = 310, cx = SZ/2, cy = SZ/2, R = 128;
  let ang = -Math.PI/2;                       // start at 12 o'clock, run clockwise
  let g = "";
  sorted.forEach(row=>{
    const frac = row.total/grand;
    const a0 = ang, a1 = ang + frac*Math.PI*2; ang = a1;
    const d = sorted.length === 1
      ? 'M '+cx+' '+(cy-R)+' A '+R+' '+R+' 0 1 1 '+(cx-0.01)+' '+(cy-R)+' Z'
      : 'M '+cx+' '+cy+
        ' L '+(cx+R*Math.cos(a0))+' '+(cy+R*Math.sin(a0))+
        ' A '+R+' '+R+' 0 '+((a1-a0) > Math.PI ? 1 : 0)+' 1 '+
        (cx+R*Math.cos(a1))+' '+(cy+R*Math.sin(a1))+' Z';
    // the 2px surface stroke IS the gap between wedges, not an ink border
    g += '<path d="'+d+'" fill="'+row.color+'" stroke="'+SURF+'" stroke-width="2.5">'+
         '<title>'+esc(row.name+" — "+fmtClock(row.total)+" ("+(frac*100).toFixed(1)+"%)")+'</title></path>';
    if(frac >= .07){                          // only label a wedge the text actually fits in
      const am = (a0+a1)/2;
      g += '<text x="'+(cx+R*0.62*Math.cos(am))+'" y="'+(cy+R*0.62*Math.sin(am)+5)+'" '+
           'text-anchor="middle" class="val" style="fill:'+inkOn(row.color)+';font-size:13px">'+
           (frac*100).toFixed(1)+'%</text>';
    }
  });

  const table = '<table><thead><tr><th>Station</th><th class="num">Total</th><th class="num">Share</th>'+
    '<th class="num">Runs</th></tr></thead><tbody>'+
    sorted.map(row=>{
      const frac = row.total/grand;
      return '<tr><td><span style="display:inline-flex;align-items:center;gap:8px">'+
        '<span style="width:12px;height:12px;border-radius:3px;background:'+row.color+';display:block;flex:0 0 auto"></span>'+
        '<b>'+esc(row.name)+'</b></span></td>'+
        '<td class="num">'+fmtClock(row.total)+'</td>'+
        '<td class="num">'+(frac*100).toFixed(1)+'%</td>'+
        '<td class="num" style="color:var(--dirt)">'+row.n+'</td></tr>';
    }).join("")+
    '</tbody><tfoot><tr><td>Whole day</td><td class="num">'+fmtClock(grand)+'</td>'+
    '<td class="num">100%</td><td class="num">'+sorted.reduce((a,b)=>a+b.n,0)+'</td></tr></tfoot></table>';

  return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;align-items:center">'+
    '<div style="text-align:center">'+
      '<svg viewBox="0 0 '+SZ+' '+SZ+'" style="width:100%;max-width:330px;height:auto">'+g+'</svg>'+
    '</div>'+
    '<div>'+
      '<div style="font-family:var(--sans);font-size:10px;font-weight:900;letter-spacing:.2em;'+
        'text-transform:uppercase;color:var(--dirt)">Total time on the clock</div>'+
      '<div style="font-family:var(--sans);font-size:44px;font-weight:900;line-height:1;color:var(--barn);margin:2px 0 14px">'+
        fmtClock(grand)+'</div>'+
      '<div class="tbl-wrap">'+table+'</div>'+
    '</div>'+
  '</div>';
}
