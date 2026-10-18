import { useEffect, useState } from "react";
import { listGrantedSites, revokeGrantedSite } from "../../lib/site-access";

/** Settings card for sites the user allowed. */
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
    <>
      <p className="settings-group-label">Sites Pact can read</p>
      <div className="settings-card">
        <div className="settings-row stacked">
          <span>Per-site access</span>
          <span className="settings-value">
            Asked when you read the page or select an item
          </span>
        </div>
        {sites.length === 0 ? (
          <div className="settings-row stacked">
            <span className="settings-value">No sites allowed yet</span>
          </div>
        ) : (
          sites.map((site) => (
            <div className="settings-row" key={site}>
              <span className="settings-value">
                {site.replace(/\/\*$/, "")}
              </span>
              <button
                type="button"
                className="settings-chip"
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
    </>
  );
}
