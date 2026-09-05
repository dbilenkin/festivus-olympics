import { Component, type ReactNode } from "react";

/** A render crash must never leave a blank screen on a phone in a field. Show what broke
 *  and offer the two exits that always work: reload, or the standalone scorekeeper. */
export default class ErrorBoundary extends Component<
  { children: ReactNode }, { err: Error | null }
> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { console.error("render crash", err); }

  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="wrap">
        <div className="card" style={{ borderColor: "var(--barn)" }}>
          <h2>Something broke</h2>
          <p className="note" style={{ marginBottom: 12 }}>
            Your scores are safe &mdash; they live on the server and in this browser, not
            in the screen that crashed.
          </p>
          <pre className="crash">{String(this.state.err?.message ?? this.state.err)}</pre>
          <button className="bigbtn" onClick={() => location.reload()}>Reload</button>
          <p className="note" style={{ marginTop: 12, textAlign: "center" }}>
            <a href="legacy/">Open the standalone scorekeeper</a>
          </p>
        </div>
      </div>
    );
  }
}
