import { useEffect, useState } from "react";

/** Pick a layout rather than rendering both and hiding one -- 40 score inputs is enough
 *  to want only one copy of in the DOM. */
export function useMedia(query: string): boolean {
  const [match, setMatch] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    m.addEventListener("change", on);
    on();
    return () => m.removeEventListener("change", on);
  }, [query]);
  return match;
}
export const useWide = () => useMedia("(min-width: 760px)");
