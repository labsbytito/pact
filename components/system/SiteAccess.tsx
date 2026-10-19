export function SiteAccess({ host, onAllow }: { host: string; onAllow: () => void }) {
  return (
    <div className="card">
      <h3>Allow this site</h3>
      <p className="meta">Pact needs permission to read {host}.</p>
      <button className="primary-btn" type="button" onClick={onAllow}>Allow</button>
    </div>
  );
}
