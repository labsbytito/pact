import { useEffect, useState, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
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

  const signedIn = fo === "signed in";

  async function refreshStatus() {
    const body = await loadFoStatus();
    setTools(body.tools ?? []);
    onRefresh?.();
  }

  useEffect(() => {
    let stop = false;
    void loadFoStatus()
      .then((body) => {
        if (!stop) setTools(body.tools ?? []);
      })
      .catch(() => {
        if (!stop) setTools([]);
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

  return (
    <>
      <div className="group-label">Services</div>
      <div className="group">
        <ServiceRow
          icon={<Sparkles size={16} aria-hidden="true" />}
          name="Fo"
          status={signedIn ? "Connected" : "Not connected"}
          action={signedIn ? "Disconnect" : "Connect"}
          disabled={busy === "fo"}
          onAction={() => {
            if (signedIn) {
              if (!window.confirm("Sign out of Fo?")) return;
              void run("fo", async () => {
                await disconnectFo();
                setNote("Signed out of Fo");
                onRefresh?.();
              });
              return;
            }
            void run("fo", connectAccount);
          }}
        />
      </div>
      <p className="conn-note">Connect your Fo account once. Pact can ask Fo to work with the Google and workspace services, phone, email and custom connectors you authorize there. Add or manage services inside Fo. Access depends on your Fo account and its permissions.</p>
      <div className="row-actions"><button className="text-btn" type="button" disabled={!!busy} onClick={() => void run("refresh", refreshStatus)}>Refresh connection</button></div>
      <div className="group-label">Live Fo tools</div>
      <div className="group">{tools.length ? tools.map((tool) => <div className="set-row" key={tool.name}><span>{tool.name}</span><span className="conn-meta">Available</span></div>) : <p className="conn-note">No live tools available. Connect or refresh Fo.</p>}</div>
      <p className="conn-note">Available tools do not confirm which services are connected or that an action has completed. Pact shows Fo’s returned status after a request.</p>
      {note && <p className="conn-note">{note}</p>}
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

function ServiceRow({
  icon,
  name,
  status,
  action,
  disabled,
  onAction,
}: {
  icon: ReactNode;
  name: string;
  status: "Connected" | "Not connected";
  action: string;
  disabled?: boolean;
  onAction: () => void;
}) {
  return (
    <div className="set-row conn">
      <span className="conn-icon">{icon}</span>
      <span className="conn-name">{name}</span>
      <span className="conn-meta">{status}</span>
      <button className="text-btn" type="button" disabled={disabled} onClick={onAction}>{action}</button>
    </div>
  );
}
