/**
 * Placeholder shell. The real screens land in a later phase; this exists so the
 * hosting pipeline can be proven end-to-end before any app logic depends on it.
 */
export default function App() {
  return (
    <main
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "48px 20px",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontSize: "clamp(30px,8vw,58px)",
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: "-.03em",
          lineHeight: 0.9,
          color: "var(--barn)",
          margin: 0,
        }}
      >
        Pond Neck<br />Olympics
      </h1>
      <p
        style={{
          fontFamily: "var(--sans)",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: ".2em",
          textTransform: "uppercase",
          color: "var(--dirt)",
          marginTop: 14,
        }}
      >
        Rebuild in progress
      </p>
      <p style={{ fontFamily: "var(--sans)", fontSize: 14, lineHeight: 1.7, marginTop: 28 }}>
        The working scorekeeper lives here while this is being built:
      </p>
      <a
        href="legacy/"
        style={{
          display: "inline-block",
          fontFamily: "var(--sans)",
          fontWeight: 800,
          fontSize: 14,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          background: "var(--corn)",
          color: "var(--ink)",
          border: "3px solid var(--ink)",
          borderRadius: 10,
          boxShadow: "0 3px 0 var(--ink)",
          padding: "13px 22px",
          textDecoration: "none",
          marginTop: 6,
        }}
      >
        Open the scorekeeper
      </a>
    </main>
  );
}
