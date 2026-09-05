import qrcode from "qrcode-generator";

/**
 * Rendered as SVG rects rather than a canvas so it stays crisp on any screen, prints,
 * and needs no ref/effect. Error-correction level M survives a bit of glare from across
 * a picnic table.
 */
export default function QR({ text, size = 220 }: { text: string; size?: number }) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const cells: string[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) cells.push(`M${c} ${r}h1v1h-1z`);
    }
  }
  return (
    <svg
      viewBox={`-1 -1 ${n + 2} ${n + 2}`}
      width={size}
      height={size}
      style={{ background: "#fff", borderRadius: 10, display: "block" }}
      role="img"
      aria-label="QR code for this event link"
    >
      <path d={cells.join("")} fill="#2a2118" shapeRendering="crispEdges" />
    </svg>
  );
}
