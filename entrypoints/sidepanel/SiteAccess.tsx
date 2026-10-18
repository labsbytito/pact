import { useEffect, useState } from "react";
import { listGrantedSites, revokeGrantedSite } from "../../lib/site-access";

// Settings markup for sites the user allowed. Restyle by keeping these two
// functions: listGrantedSites and revokeGrantedSite.
export function SiteAccessSettings() {
  const [sites, setSites] = useState<string[]>([]);
  async function refresh() {
    setSites(await listGrantedSites());
  }
  useEffect(() => {
    void refresh();
    if (typeof chrome === "undefined" || !chrome.permissions?.onAdded) return;
    const update = () => void refresh();
    chrome.permissions.onAdded.addListener(update);
    chrome.permissions.onRemoved.addListener(update);
    return () => {
      chrome.permissions.onAdded.removeListener(update);
      chrome.permissions.onRemoved.removeListener(update);
    };
  }, []);
  return (
    <div className="settings-section">
      <h3>Sites Pact can read</h3>
      <p className="setting-description">
        Pact asks for one site at a time, when you choose Read current page or
        Select item. Remove a site here to revoke that access.
      </p>
      {sites.length === 0 ? (
        <p className="setting-description">No sites allowed yet.</p>
      ) : (
        sites.map((site) => (
          <div className="setting-line" key={site}>
            <span>{site.replace(/\/\*$/, "")}</span>
            <button
              className="text-button"
              onClick={() => {
                void revokeGrantedSite(site).then(refresh);
              }}
            >
              Remove
            </button>
          </div>
        ))
      )}
    </div>
  );
}
