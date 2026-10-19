import { useEffect, useState } from "react";
import { COLOR_SWATCHES, SHAPE_OPTIONS, type CompanionAppearance } from "../../lib/character";
import type { AccentPreference, MotionPreference, Settings, ThemePreference } from "../../lib/model";
import { connectFo, deleteInstall, disconnectFo } from "../../lib/backend";

const pages = ["Account", "Appearance", "Microphone", "About"] as const;
type Page = (typeof pages)[number];
const accents: { id: AccentPreference; label: string }[] = [
  { id: "pact", label: "Pact color" },
  { id: "blue", label: "Blue" },
  { id: "teal", label: "Teal" },
  { id: "violet", label: "Violet" },
  { id: "black", label: "Black" },
];

export function SettingsSheet({
  settings,
  onChange,
  onClose,
  fo,
  wide,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
  fo?: string;
  wide: boolean;
}) {
  const [page, setPage] = useState<Page | null>(wide ? "Account" : null);
  useEffect(() => { if (wide && !page) setPage("Account"); }, [wide, page]);
  const companion = settings.companion ?? { shape: 0, color: COLOR_SWATCHES[0]!.color };
  return (
    <div className="settings">
      {wide && (
        <nav aria-label="Settings">
          {pages.map((item) => (
            <button key={item} type="button" aria-current={page === item ? "page" : undefined} onClick={() => setPage(item)}>{item}</button>
          ))}
        </nav>
      )}
      <div className="settings-body">
        {!wide && !page && (
          <>
            <button className="icon-btn" type="button" aria-label="Close settings" onClick={onClose}>←</button>
            <h2>Settings</h2>
            {pages.map((item) => (
              <button key={item} className="stack-row" type="button" onClick={() => setPage(item)}>
                {item}<span aria-hidden="true">›</span>
              </button>
            ))}
          </>
        )}
        {page && (
          <>
            <button className="icon-btn" type="button" aria-label="Back" onClick={() => (wide ? onClose() : setPage(null))}>←</button>
            <h2>{page}</h2>
            {page === "Account" && <Account fo={fo} />}
            {page === "Appearance" && <Appearance settings={settings} companion={companion} onChange={onChange} />}
            {page === "Microphone" && <Microphone settings={settings} onChange={onChange} />}
            {page === "About" && <About />}
          </>
        )}
      </div>
    </div>
  );
}

function Account({ fo }: { fo?: string }) {
  const [note, setNote] = useState(fo === "signed in" ? "Fo is connected" : "Fo is not connected");
  return (
    <>
      <div className="group-label">Fo</div>
      <div className="group">
        <div className="set-row"><span>{note}</span></div>
        <div className="set-row">
          <button className="text-btn" type="button" onClick={() => void connectFo().then(async (result) => {
            if (result.url) await chrome.tabs.create({ url: result.url });
            else setNote("Fo is connected");
          }).catch((error: Error) => setNote(error.message))}>Connect Fo</button>
          <button className="text-btn" type="button" onClick={() => void disconnectFo().then(() => setNote("Signed out of Fo"))}>Sign out</button>
        </div>
        <div className="set-row">
          <span>Delete my data</span>
          <button className="ghost-btn" type="button" onClick={() => void deleteInstall().then(() => setNote("Deleted from the server"))}>Delete</button>
        </div>
      </div>
    </>
  );
}

function Appearance({
  settings,
  companion,
  onChange,
}: {
  settings: Settings;
  companion: CompanionAppearance;
  onChange: (patch: Partial<Settings>) => void;
}) {
  return (
    <>
      <div className="group-label">Look</div>
      <div className="group">
        <label className="set-row">Theme
          <select value={settings.theme ?? "system"} onChange={(event) => onChange({ theme: event.target.value as ThemePreference })}>
            <option value="system">Follow System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label className="set-row">Accent
          <select value={settings.accent === "character" ? "pact" : settings.accent ?? "pact"} onChange={(event) => onChange({ accent: event.target.value as AccentPreference })}>
            {accents.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="set-row">Animations
          <select value={settings.motion ?? "on"} onChange={(event) => onChange({ motion: event.target.value as MotionPreference })}>
            <option value="on">On</option>
            <option value="reduced">Reduced</option>
            <option value="off">Off</option>
          </select>
        </label>
      </div>
      <div className="group-label">Companion</div>
      <div className="group">
        <div className="shapes">
          {SHAPE_OPTIONS.map((option) => (
            <button key={option.shape} className="shape-btn" type="button" aria-pressed={companion.shape === option.shape} aria-label={option.name} onClick={() => onChange({ companion: { ...companion, shape: option.shape } })}>{option.name.slice(0, 2)}</button>
          ))}
        </div>
        <div className="swatches">
          {COLOR_SWATCHES.map((swatch) => (
            <button key={swatch.color} className="swatch" type="button" aria-label={swatch.name} aria-pressed={companion.color === swatch.color} style={{ background: swatch.color }} onClick={() => onChange({ companion: { ...companion, color: swatch.color } })} />
          ))}
        </div>
      </div>
    </>
  );
}

function Microphone({ settings, onChange }: { settings: Settings; onChange: (patch: Partial<Settings>) => void }) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [mic, setMic] = useState("Microphone is off");
  async function allowMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter((item) => item.kind === "audioinput"));
      setMic("Microphone is allowed");
    } catch {
      setMic("Microphone is blocked");
    }
  }
  return (
    <div className="group">
      <div className="set-row"><span>{mic}</span><button className="text-btn" type="button" onClick={() => void allowMic()}>Allow</button></div>
      <label className="set-row">Device
        <select value={settings.micDeviceId ?? "default"} onChange={(event) => onChange({ micDeviceId: event.target.value })}>
          <option value="default">System Default</option>
          {devices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label || "Microphone"}</option>)}
        </select>
      </label>
    </div>
  );
}

function About() {
  return (
    <div className="group">
      <div className="set-row"><span>Pact keeps one request in front of you, and waits for you to approve it.</span></div>
    </div>
  );
}
