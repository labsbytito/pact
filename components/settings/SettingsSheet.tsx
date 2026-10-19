import { useEffect, useState } from "react";
import { COLOR_SWATCHES, SHAPE_OPTIONS, type CompanionAppearance } from "../../lib/character";
import type { AccentPreference, MotionPreference, Settings, ThemePreference } from "../../lib/model";
import { connectFo, deleteInstall, disconnectFo } from "../../lib/backend";
import { listMicrophones, openMicPermissionPage, openMicSiteSettings, queryMicPermission, type MicPermission } from "../../lib/mic";
import { PactBlob } from "../companion/PactBlob";
import { ArrowLeftIcon, ChevronIcon, CloseIcon } from "../icons";
import { MenuSelect } from "./MenuSelect";

const pages = ["General", "Connections", "Companion", "About"] as const;
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
  onRefresh,
  onDeleted,
  demo,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
  fo?: string;
  wide: boolean;
  onRefresh?: () => void;
  onDeleted?: () => void;
  demo?: boolean;
}) {
  const [page, setPage] = useState<Page | null>(wide ? "General" : null);
  useEffect(() => { if (wide && !page) setPage("General"); }, [wide, page]);
  useEffect(() => {
    if (page !== "Connections" || !onRefresh) return;
    const timer = window.setInterval(onRefresh, 3000);
    return () => window.clearInterval(timer);
  }, [page, onRefresh]);
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
        {wide && (
          <button className="icon-btn settings-close" type="button" aria-label="Close settings" onClick={onClose}>
            <CloseIcon />
          </button>
        )}
        {!wide && !page && (
          <>
            <button className="icon-btn" type="button" aria-label="Close settings" onClick={onClose}><ArrowLeftIcon /></button>
            <h2>Settings</h2>
            {pages.map((item) => (
              <button key={item} className="stack-row" type="button" onClick={() => setPage(item)}>
                {item}<ChevronIcon />
              </button>
            ))}
          </>
        )}
        {page && (
          <>
            {!wide && (
              <button className="icon-btn" type="button" aria-label="Back" onClick={() => setPage(null)}><ArrowLeftIcon /></button>
            )}
            <h2>{page}</h2>
            {page === "General" && <General settings={settings} onChange={onChange} />}
            {page === "Connections" && <Connections fo={fo} onRefresh={onRefresh} onDeleted={onDeleted} />}
            {page === "Companion" && <Companion companion={companion} onChange={onChange} />}
            {page === "About" && <About demo={demo} />}
          </>
        )}
      </div>
    </div>
  );
}

function General({ settings, onChange }: { settings: Settings; onChange: (patch: Partial<Settings>) => void }) {
  return (
    <>
      <div className="group-label">Look</div>
      <div className="group">
        <MenuSelect label="Theme" value={settings.theme ?? "system"} options={[
          { value: "system", label: "Follow System" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]} onChange={(value) => onChange({ theme: value as ThemePreference })} />
        <MenuSelect label="Accent" value={settings.accent === "character" ? "pact" : settings.accent ?? "pact"} options={accents.map((item) => ({ value: item.id, label: item.label }))} onChange={(value) => onChange({ accent: value as AccentPreference })} />
        <MenuSelect label="Animations" value={settings.motion ?? "on"} options={[
          { value: "on", label: "On" },
          { value: "reduced", label: "Reduced" },
          { value: "off", label: "Off" },
        ]} onChange={(value) => onChange({ motion: value as MotionPreference })} />
      </div>
      <div className="group-label">Microphone</div>
      <Microphone settings={settings} onChange={onChange} />
    </>
  );
}

function Connections({ fo, onRefresh, onDeleted }: { fo?: string; onRefresh?: () => void; onDeleted?: () => void }) {
  const [note, setNote] = useState("");
  const label = fo === "signed in" ? "Fo is connected" : fo === "needs reconnect" ? "Fo needs to reconnect" : "Fo is not connected";
  return (
    <div className="group">
      <div className="set-row"><span>{note || label}</span></div>
      <div className="set-row">
        <button className="text-btn" type="button" onClick={() => void connectFo().then(async (result) => {
          if (result.url) await chrome.tabs.create({ url: result.url });
          onRefresh?.();
        }).catch((error: Error) => setNote(error.message))}>Connect Fo</button>
        <button className="text-btn" type="button" onClick={() => {
          if (!window.confirm("Sign out of Fo?")) return;
          void disconnectFo().then(() => { setNote("Signed out of Fo"); onRefresh?.(); }).catch((error: Error) => setNote(error.message));
        }}>Sign out</button>
      </div>
      <div className="set-row">
        <span>Delete my data</span>
        <button className="ghost-btn" type="button" onClick={() => {
          if (!window.confirm("Delete your Pact data from the server? This can't be undone.")) return;
          void deleteInstall().then(() => { setNote("Your Pact data was deleted."); onDeleted?.(); }).catch((error: Error) => setNote(error.message));
        }}>Delete</button>
      </div>
    </div>
  );
}

function Companion({ companion, onChange }: { companion: CompanionAppearance; onChange: (patch: Partial<Settings>) => void }) {
  return (
    <div className="group">
      <div className="shapes">
        {SHAPE_OPTIONS.map((option) => (
          <button key={option.shape} className="shape-btn" type="button" aria-pressed={companion.shape === option.shape} aria-label={option.name} title={option.name} onClick={() => onChange({ companion: { ...companion, shape: option.shape } })}>
            <PactBlob size={24} state="still" appearance={{ shape: option.shape, color: companion.color }} />
          </button>
        ))}
      </div>
      <div className="swatches">
        {COLOR_SWATCHES.map((swatch) => (
          <button key={swatch.color} className="swatch" type="button" aria-label={swatch.name} title={swatch.name} aria-pressed={companion.color === swatch.color} style={{ background: swatch.color }} onClick={() => onChange({ companion: { ...companion, color: swatch.color } })} />
        ))}
      </div>
    </div>
  );
}

function Microphone({ settings, onChange }: { settings: Settings; onChange: (patch: Partial<Settings>) => void }) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [perm, setPerm] = useState<MicPermission>("unknown");
  useEffect(() => {
    let stop = false;
    const load = async (state: MicPermission) => {
      if (stop) return;
      setPerm(state);
      const list = await listMicrophones();
      const seen = new Set<string>(["default"]);
      if (!stop) setDevices(list.filter((item) => item.deviceId && !seen.has(item.deviceId) && seen.add(item.deviceId)));
    };
    void queryMicPermission().then(load);
    const onMessage = (message: { type?: string }) => {
      if (message?.type === "pact-mic-granted") void load("granted");
    };
    chrome.runtime?.onMessage?.addListener(onMessage);
    return () => { stop = true; chrome.runtime?.onMessage?.removeListener(onMessage); };
  }, []);
  const mic = perm === "granted" ? "Allowed" : perm === "denied" ? "Blocked in Chrome" : "Not allowed yet";
  const saved = settings.micDeviceId ?? "default";
  const options = [
    { value: "default", label: "System Default" },
    ...devices.map((device) => ({ value: device.deviceId, label: device.label || "Microphone" })),
  ];
  if (saved !== "default" && !options.some((item) => item.value === saved))
    options.push({ value: saved, label: "Saved microphone" });
  return (
    <div className="group">
      <div className="set-row"><span>{mic}</span><button className="text-btn" type="button" onClick={() => void (perm === "denied" ? openMicSiteSettings() : openMicPermissionPage()).catch(() => setPerm("unknown"))}>Allow</button></div>
      <MenuSelect label="Device" value={saved} options={options} onChange={(value) => onChange({ micDeviceId: value })} />
    </div>
  );
}

function About({ demo }: { demo?: boolean }) {
  return (
    <div className="group">
      <div className="set-row"><span>Pact reads the page you choose, suggests one step, and only sends it to Fo when you approve.</span></div>
      {demo && <div className="set-row"><span>Demo mode is on. Approve runs a local mock, and nothing is sent to Fo.</span></div>}
    </div>
  );
}
