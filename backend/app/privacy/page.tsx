export default function Privacy() {
  return (
    <main style={{ maxWidth: 640, padding: "48px 20px", fontSize: 14, lineHeight: 1.5 }}>
      <h1 style={{ fontSize: 15, fontWeight: 600 }}>Privacy</h1>
      <p>Pact reads a page only when you ask. It sends that page, your messages, and an approved Fo request to the processors below. It does not sell data and it does not show ads.</p>
      <p>Processors: Anthropic (the reply), Wajo/Fo (the approved request), Vercel (hosting), and Upstash (the encrypted journal and rate limits).</p>
      <p>What we store: an install id, encrypted Fo tokens, the action journal, per-Pact Fo conversation handles, and rate counters. Page text stays in the journal only as part of an approved request. We keep the journal for 30 days, except uncertain runs, which stay until you delete your data.</p>
      <p>Delete your data from Settings → Connections → Delete my data. That calls <code>/api/install/delete</code> and removes the install’s server records. Pacts saved in Chrome stay on your computer until you delete them there.</p>
      <p>Limited Use: Pact uses connected services only to carry out the request you approved. We do not use that data for ads or to train a public model.</p>
      <p>Contact: hello@labsbytito.com</p>
    </main>
  );
}
