import { useEffect, useRef, useState } from "react";

/**
 * An input that saves as you type, debounced.
 *
 * Not on blur: on a phone blur is not guaranteed. You can type and then lock the screen,
 * switch apps, or have the keyboard dismissed without the field ever losing focus, and a
 * blur-only save loses it silently. The outbox collapses repeated writes per key, so
 * typing a whole name is still one request.
 *
 * A value arriving from another device is adopted only while this field is idle -- it
 * must never overwrite something being typed.
 */
export default function LiveInput<T>({
  value, format, parse, onCommit, delay = 500, ...rest
}: {
  value: T;
  format: (v: T) => string;
  parse: (raw: string) => T;
  onCommit: (v: T) => void;
  delay?: number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [text, setText] = useState(() => format(value));
  const dirty = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => { if (!dirty.current) setText(format(value)); }, [value, format]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const commit = (raw: string) => {
    const next = parse(raw);
    if (next !== value) onCommit(next);
    dirty.current = false;
  };

  return (
    <input
      {...rest}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        dirty.current = true;
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => commit(raw), delay);
      }}
      onBlur={(e) => { window.clearTimeout(timer.current); commit(e.target.value); }}
    />
  );
}
