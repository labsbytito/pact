import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { toolInfo } from "../pact/toolInfo";
import { connectFo, disconnectFo, deleteInstall, loadFoStatus } from "../../lib/backend";

export function Connections({
  fo,
  onRefresh,
  onDeleted,
}: {
  fo?: string;
  onRefresh?: () => void;
  onDeleted?: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [tools, setTools] = useState<{ name: string; description?: string; url?: string }[]>([]);

  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const signedIn = fo === "signed in";

  async function refreshStatus() {
    const body = await loadFoStatus();
    setTools(body.tools ?? []);
    setLoaded(true);
    setLoadError(false);
    onRefresh?.();
  }

  useEffect(() => {
    let stop = false;
    void loadFoStatus()
      .then((body) => {
        if (stop) return;
        setTools(body.tools ?? []);
        setLoaded(true);
        setLoadError(false);
      })
      .catch(() => {
        if (stop) return;
        setTools([]);
        setLoadError(true);
      });
    return () => {
      stop = true;
    };
  }, [fo]);

  async function connectAccount() {
    const result = await connectFo();
    if (result.url) await chrome.tabs.create({ url: result.url });
    onRefresh?.();
  }

  async function run(id: string, work: () => Promise<void>) {
    setBusy(id);
    setNote("");
    try {
      await work();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Pact couldn't update that connection.");
    } finally {
      setBusy("");
    }
  }

  const state = foState(fo, busy === "fo");
  const grouped = new Map<string, { name: string; can: string }[]>();
  for (const tool of tools) {
    const info = toolInfo(tool.name, tool.description);
    grouped.set(info.group, [...(grouped.get(info.group) ?? []), { name: info.name, can: info.can }]);
  }
  const confirmDisconnect = () => {
    if (!window.confirm("Disconnect Fo? Pact won't be able to send requests until you connect again. Your Fo account and its services are not changed.")) return;
    void run("fo", async () => {
      await disconnectFo();
      setNote("Disconnected from Fo.");
      onRefresh?.();
    });
  };
  return (
    <>
      <div className="group-label">Fo account</div>
      <div className="group">
        <div className="set-row conn">
          <span className="conn-icon"><Sparkles size={16} aria-hidden="true" /></span>
          <span className="conn-name">Fo</span>
          <span className="conn-state" data-state={state.tone} role="status">{state.label}</span>
          <button className="text-btn" type="button" disabled={busy === "fo"} onClick={() => void run("fo", connectAccount)}>{state.action}</button>
        </div>
        {(signedIn || fo === "needs reconnect") && (
          <div className="set-row">
            <span>Disconnect Fo<small className="set-desc">Signs Pact out of Fo. Nothing is deleted in Fo.</small></span>
            <button className="ghost-btn danger-btn" type="button" disabled={busy === "fo"} onClick={confirmDisconnect}>Disconnect Fo</button>
          </div>
        )}
      </div>
      <p className="conn-note">{state.help} Add or manage services inside Fo; what Fo can reach depends on your Fo account and its permissions.</p>
      <div className="row-actions"><button className="text-btn" type="button" disabled={!!busy} onClick={() => void run("refresh", refreshStatus)}>Refresh connection</button></div>
      {note && <p className="conn-note" role="status">{note}</p>}
      <div className="group-label">What Pact can ask Fo to do</div>
      <div className="group">
        {tools.length ? [...grouped.entries()].map(([group, items]) => (
          <div className="tool-group" key={group}>
            <h4>{group}</h4>
            {items.map((item) => <div className="tool-item" key={item.name}>{item.name}<span className="set-desc">{item.can}</span></div>)}
          </div>
        )) : <p className="conn-note">{loadError ? "Couldn't reach Fo to list its tools. Check your connection and try Refresh." : !signedIn ? "No tools yet. Connect Fo to see what it offers." : loaded ? "Fo didn't report any tools. Try Refresh." : "Checking with Fo…"}</p>}
      </div>
      <p className="conn-note">This list comes live from Fo. It doesn't show which of your services are linked, and nothing runs until you approve a request.</p>
      <div className="group-label">Data</div>
      <div className="group">
        <div className="set-row">
          <span>Delete my data</span>
          <button
            className="ghost-btn"
            type="button"
            onClick={() => {
              if (!window.confirm("Delete your Pact data from the server? This can't be undone.")) return;
              void run("delete", async () => {
                await deleteInstall();
                setNote("Your Pact data was deleted.");
                onDeleted?.();
              });
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </>
  );
}

function foState(fo: string | undefined, connecting: boolean) {
  if (connecting) return { label: "Connecting…", tone: "busy", action: "Connect", help: "Finish signing in on the Fo tab that opened." };
  if (fo === "signed in") return { label: "Connected", tone: "ok", action: "Reconnect", help: "Pact can send requests to Fo, only after you approve each one." };
  if (fo === "needs reconnect") return { label: "Needs reconnect", tone: "warn", action: "Reconnect", help: "Fo's sign-in expired. Reconnect to keep sending requests." };
  if (fo === "signed out") return { label: "Signed out", tone: "off", action: "Connect", help: "Connect your Fo account once so Pact can hand off requests you approve." };
  return { label: "Checking…", tone: "busy", action: "Connect", help: "Checking your Fo connection." };
}
