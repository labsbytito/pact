import { useEffect, useState, type ReactNode } from "react";
import { Calendar, Link2, Mail, Sparkles } from "lucide-react";
import { connectFo, disconnectFo, deleteInstall, loadFoStatus } from "../../lib/backend";

const INTERNAL = new Set([
  "ask_fo",
  "get_fo_conversation",
  "get_fo_reply",
  "list_fo_conversations",
  "start_fo_call",
]);

function glyph(Icon: typeof Mail) {
  return <Icon size={16} strokeWidth={1.75} aria-hidden="true" />;
}

function labelFor(name: string) {
  return name
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function Connections({
  fo,
  onRefresh,
  onDeleted,
  onAsk,
}: {
  fo?: string;
  onRefresh?: () => void;
  onDeleted?: () => void;
  onAsk?: (text: string) => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [tools, setTools] = useState<{ name: string }[]>([]);
  const signedIn = fo === "signed in";

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

  async function connectService(id: string, ask: string) {
    await run(id, async () => {
      if (!signedIn) {
        await connectAccount();
        return;
      }
      onAsk?.(ask);
    });
  }

  const extras = tools.filter((tool) => {
    if (INTERNAL.has(tool.name)) return false;
    if (/gmail|google.?mail|inbox/i.test(tool.name)) return false;
    if (/calendar/i.test(tool.name)) return false;
    return true;
  });

  return (
    <>
      <div className="group-label">Services</div>
      <div className="group">
        <ServiceRow
          icon={glyph(Sparkles)}
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
        <ServiceRow
          icon={glyph(Mail)}
          name="Gmail"
          status="Not connected"
          action="Connect"
          disabled={busy === "gmail"}
          onAction={() => void connectService("gmail", "Connect my Gmail")}
        />
        <ServiceRow
          icon={glyph(Calendar)}
          name="Google Calendar"
          status="Not connected"
          action="Connect"
          disabled={busy === "calendar"}
          onAction={() => void connectService("calendar", "Connect my Google Calendar")}
        />
        {extras.map((tool) => (
          <ServiceRow
            key={tool.name}
            icon={glyph(Link2)}
            name={labelFor(tool.name)}
            status="Not connected"
            action="Connect"
            disabled={busy === tool.name}
            onAction={() => void connectService(tool.name, `Connect ${labelFor(tool.name)}`)}
          />
        ))}
      </div>
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
      <span className="conn-name">{icon}<span>{name}</span></span>
      <span className="conn-meta">{status}</span>
      <button className="text-btn" type="button" disabled={disabled} onClick={onAction}>{action}</button>
    </div>
  );
}
