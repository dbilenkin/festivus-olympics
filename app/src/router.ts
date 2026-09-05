/** Hash routing, hand-rolled.
 *
 *  GitHub Pages project sites return a real 404 on deep links unless you do the
 *  404.html copy-trick, which then fights the service worker's navigate fallback and
 *  breaks link previews. A hash never 404s and works offline with no special casing.
 *  There are a handful of flat panels here; a router library would be ~20KB for this. */
import { useEffect, useState } from "react";

export interface Route { eventId: string | null; panel: string }

export function parseHash(h = location.hash): Route {
  const seg = h.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (seg[0] === "e" && seg[1]) return { eventId: seg[1], panel: seg[2] ?? "pent" };
  return { eventId: null, panel: seg[0] ?? "home" };
}

export const go = (eventId: string | null, panel = "pent") => {
  location.hash = eventId ? `#/e/${eventId}/${panel}` : `#/${panel}`;
};

export function useRoute(): Route {
  const [r, setR] = useState<Route>(() => parseHash());
  useEffect(() => {
    const on = () => setR(parseHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return r;
}

/** Events this device has opened before, so you never have to re-find a link. */
const RECENT = "pondneck.recent";
export interface Recent { id: string; name: string; at: number }
export const recents = (): Recent[] => {
  try { return JSON.parse(localStorage.getItem(RECENT) || "[]"); } catch { return []; }
};
export function remember(id: string, name: string) {
  const list = [{ id, name, at: Date.now() }, ...recents().filter((r) => r.id !== id)].slice(0, 8);
  try { localStorage.setItem(RECENT, JSON.stringify(list)); } catch { /* ignore */ }
}
