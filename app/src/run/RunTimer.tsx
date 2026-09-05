import { useEffect, useRef, useState } from "react";
import { useRunClock, clearRun, type RunPersist } from "./useRunClock";
import {
  armAudio, feedbackLap, feedbackFinish,
  acquireWakeLock, releaseWakeLock, wakeLockSupported,
} from "./feedback";
import { fmtRun } from "../lib/time";
import { gColor } from "../lib/palette";

interface Props {
  who: string;
  legs: string[];
  restore?: RunPersist | null;
  onSave: (splits: number[]) => void;
  onExit: () => void;
}

export default function RunTimer({ who, legs, restore, onSave, onExit }: Props) {
  const { idx, marks, done, advance, undo, reset, clockEl, splitEl, splits } =
    useRunClock(legs, who, restore);
  const [sound, setSound] = useState(true);
  const prevMarks = useRef(marks.length);

  /* Screen must not sleep mid-pentathlon. The sentinel dies whenever the page hides,
     so re-acquire when it comes back. */
  useEffect(() => {
    if (idx < 0 || done) return;
    void acquireWakeLock();
    const onVis = () => { if (document.visibilityState === "visible") void acquireWakeLock(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); void releaseWakeLock(); };
  }, [idx, done]);

  /* Match the iOS status bar to the dark timer ground. */
  useEffect(() => {
    const el = document.querySelector('meta[name="theme-color"]');
    const prev = el?.getAttribute("content") ?? "#8f2a1f";
    el?.setAttribute("content", "#14100c");
    return () => el?.setAttribute("content", prev);
  }, []);

  /* Fire feedback only on an actual bank, never on a re-render. */
  useEffect(() => {
    if (marks.length > prevMarks.current) {
      if (done) feedbackFinish(sound); else feedbackLap(sound);
    }
    prevMarks.current = marks.length;
  }, [marks.length, done, sound]);

  const onPointerDown = (e: React.PointerEvent) => {
    const t = e.nativeEvent.timeStamp || performance.now(); // hardware time, first line
    if (!e.isPrimary || done) return;
    e.preventDefault();          // suppress the synthetic click
    armAudio();                  // must happen inside the gesture for iOS
    advance(t);
  };

  const cur = idx < 0 ? legs[0] : legs[Math.min(idx, legs.length - 1)];
  const next = idx >= 0 && idx + 1 < legs.length ? legs[idx + 1] : null;
  const total = splits.reduce((a, b) => a + Math.round(b * 100) / 100, 0);

  if (done) {
    return (
      <div className="run-root">
        <div className="run-head">
          <div className="run-kick">Run complete</div>
          <div className="run-who">{who}</div>
        </div>
        <div className="run-body" style={{ justifyContent: "center" }}>
          <div className="run-clock run-clock-done">{fmtRun(total)}</div>
          <div className="run-sub">total across all {legs.length} stations</div>
          <ol className="run-legs">
            {legs.map((l, i) => (
              <li key={i} className="done">
                <span className="n">{i + 1}</span>
                <span className="g">{l}</span>
                <span className="t">{splits[i].toFixed(2)}s</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="run-foot">
          <button className="rbtn rbtn-go" onClick={() => {
            onSave(splits.map((v) => Math.round(v * 100) / 100)); clearRun();
          }}>Save to sheet</button>
          <button className="rbtn" onClick={reset}>Run again</button>
          <button className="rbtn rbtn-x" onClick={() => { clearRun(); onExit(); }}>Discard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="run-root">
      <div className="run-head">
        <div className="run-kick">{idx < 0 ? `${legs.length} stations, one clock` : `Now running · ${idx + 1} of ${legs.length}`}</div>
        <div className="run-who">{who}</div>
      </div>

      {/* The ENTIRE middle of the screen is the button. No aiming with cold hands. */}
      <button className="run-body" onPointerDown={onPointerDown} aria-label={idx < 0 ? "Start the clock" : `Bank ${cur} and start ${next ?? "the finish"}`}>
        <div className="run-station" style={{ color: gColor(Math.max(0, idx)) }}>{cur}</div>
        <div ref={clockEl} className="run-clock">0:00.00</div>
        <div className="run-sub">this station <b ref={splitEl}>0.00</b>s</div>
        <div className="run-cta">
          {idx < 0 ? "TAP TO START" : next ? <>TAP <span className="arw">&rarr;</span> {next.toUpperCase()}</> : "TAP TO FINISH"}
        </div>
      </button>

      <div className="run-strip">
        {legs.map((l, i) => (
          <div key={i} className={"pip " + (i < marks.length ? "done" : i === idx ? "now" : "todo")}>
            <span>{i + 1}</span>
            <em>{i < marks.length ? `${splits[i].toFixed(1)}s` : l.slice(0, 3)}</em>
          </div>
        ))}
      </div>

      <div className="run-foot">
        {marks.length > 0 && <button className="rbtn" onClick={undo}>&#8630; Undo last</button>}
        <button className="rbtn" onClick={() => setSound((s) => !s)}>{sound ? "Sound on" : "Sound off"}</button>
        <button className="rbtn rbtn-x" onClick={() => {
          if (!marks.length || confirm("Throw this run away?")) { clearRun(); onExit(); }
        }}>Cancel</button>
      </div>

      {!wakeLockSupported() && idx >= 0 && (
        <div className="run-note">Your browser can&rsquo;t hold the screen awake &mdash; set Auto-Lock to Never.</div>
      )}
    </div>
  );
}
