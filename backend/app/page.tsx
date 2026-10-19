export default function Home() {
  return (
    <main style={{ maxWidth: 560, padding: "48px 20px" }}>
      <h1 style={{ fontSize: 15, fontWeight: 600 }}>Pact</h1>
      <p style={{ fontSize: 14, lineHeight: 1.5, color: "#a8a8a8" }}>
        A little intention. A real next step. This is the companion that keeps Claude and Fo
        off your browser. Open the Pact side panel in Chrome to use it.
      </p>
      <p style={{ fontSize: 13 }}>
        <a href="/privacy" style={{ color: "#f5f5f5" }}>Privacy</a>
        {" · "}
        <a href="/support" style={{ color: "#f5f5f5" }}>Support</a>
      </p>
    </main>
  );
}
