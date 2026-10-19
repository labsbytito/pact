import { useEffect, useState } from "react";
import { Info, Link2, Settings as SettingsIcon, Smile, type LucideIcon } from "lucide-react";
import { COLOR_SWATCHES, SHAPE_OPTIONS, type CompanionAppearance, type CompanionMood } from "../../lib/character";
import type { AccentPreference, AskBefore, BackgroundPreference, MotionPreference, ResponseStyle, Settings, TextSize, ThemePreference } from "../../lib/model";
import { listMicrophones, openMicPermissionPage, openMicSiteSettings, queryMicPermission, type MicPermission } from "../../lib/mic";
import { PactBlob } from "../companion/PactBlob";
import { Connections } from "./Connections";
import { MenuSelect } from "./MenuSelect";

const pages = [
  { id: "General", icon: SettingsIcon },
  { id: "Connections", icon: Link2 },
  { id: "Companion", icon: Smile },
  { id: "About", icon: Info },
] as const;
export type SettingsPage = (typeof pages)[number]["id"];

const accents: { id: AccentPreference; label: string }[] = [
  { id: "teal", label: "Teal" },
  { id: "blue", label: "Blue" },
  { id: "black", label: "Black" },
];

const moods: { id: CompanionMood; label: string }[] = [
  { id: "idle", label: "Calm" },
  { id: "happy", label: "Happy" },
  { id: "thinking", label: "Thinking" },
  { id: "sleepy", label: "Sleepy" },
];

function navIcon(Icon: LucideIcon) {
  return <Icon size={16} strokeWidth={1.75} aria-hidden="true" />;
}

export function SettingsSheet({
  settings,
  onChange,
  fo,
  navWide,
  page,
  onPage,
  onRefresh,
  onDeleted,
  demo,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  fo?: string;
  navWide: boolean;
  page: SettingsPage;
  onPage: (page: SettingsPage) => void;
  onRefresh?: () => void;
  onDeleted?: () => void;
  demo?: boolean;
}) {
  useEffect(() => {
    if (page !== "Connections" || !onRefresh) return;
    const timer = window.setInterval(onRefresh, 3000);
    return () => window.clearInterval(timer);
  }, [page, onRefresh]);
  const companion = settings.companion ?? { shape: 0, color: "#F59E0B", v: 2 as const };
  return (
    <div className={navWide ? "settings wide" : "settings"}>
      <nav aria-label="Settings">
        {pages.map((item) => (
          <button key={item.id} type="button" aria-current={page === item.id ? "page" : undefined} onClick={() => onPage(item.id)}>
            {navIcon(item.icon)}
            {item.id}
          </button>
        ))}
      </nav>
      <div className="settings-body">
        <h2>{page}</h2>
        {page === "General" && <General settings={settings} onChange={onChange} />}
        {page === "Connections" && <Connections fo={fo} onRefresh={onRefresh} onDeleted={onDeleted} />}
        {page === "Companion" && <Companion companion={companion} onChange={onChange} />}
        {page === "About" && <About demo={demo} />}
      </div>
    </div>
  );
}

function General({ settings, onChange }: { settings: Settings; onChange: (patch: Partial<Settings>) => void }) {
  const accent = settings.accent === "pact" || settings.accent === "character" || settings.accent === "violet" || !settings.accent ? "teal" : settings.accent;
  return (
    <>
      <div className="group-label">Appearance</div>
      <div className="group">
        <MenuSelect label="Theme" value={settings.theme ?? "system"} options={[
          { value: "system", label: "Follow System" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]} onChange={(value) => onChange({ theme: value as ThemePreference })} />
        <MenuSelect label="Accent" value={accent} options={accents.map((item) => ({ value: item.id, label: item.label }))} onChange={(value) => onChange({ accent: value as AccentPreference })} />
        <MenuSelect label="Background" value={settings.background ?? "dusk"} options={[
          { value: "dusk", label: "Dusk" },
          { value: "ocean", label: "Ocean" },
          { value: "sunrise", label: "Sunrise" },
          { value: "plain", label: "Plain" },
        ]} onChange={(value) => onChange({ background: value as BackgroundPreference })} />
        <MenuSelect label="Animations" value={settings.motion ?? "on"} options={[
          { value: "on", label: "On" },
          { value: "reduced", label: "Reduced" },
          { value: "off", label: "Off" },
        ]} onChange={(value) => onChange({ motion: value as MotionPreference })} />
      </div>
      <div className="group-label">Behavior</div>
      <div className="group">
        <MenuSelect label="Response style" value={settings.responseStyle ?? "detailed"} options={[
          { value: "short", label: "Short" },
          { value: "detailed", label: "Detailed" },
        ]} onChange={(value) => onChange({ responseStyle: value as ResponseStyle })} />
        <MenuSelect label="Ask before acting" value={settings.askBefore ?? "suggested"} options={[
          { value: "suggested", label: "Only for things Pact suggests" },
          { value: "always", label: "Always" },
        ]} onChange={(value) => onChange({ askBefore: value as AskBefore })} />
        <MenuSelect label="Send with Enter" value={settings.sendWithEnter === false ? "off" : "on"} options={[
          { value: "on", label: "On" },
          { value: "off", label: "Off" },
        ]} onChange={(value) => onChange({ sendWithEnter: value !== "off" })} />
        <MenuSelect label="Text size" value={settings.textSize ?? "default"} options={[
          { value: "default", label: "Default" },
          { value: "large", label: "Large" },
        ]} onChange={(value) => onChange({ textSize: value as TextSize })} />
      </div>
      <div className="group-label">System</div>
      <Microphone settings={settings} onChange={onChange} />
    </>
  );
}

function Companion({ companion, onChange }: { companion: CompanionAppearance; onChange: (patch: Partial<Settings>) => void }) {
  const mood = companion.mood ?? "idle";
  const patch = (next: Partial<CompanionAppearance>) => onChange({ companion: { ...companion, ...next, v: 2 } });
  return (
    <>
      <div className="group-label">Shape</div>
      <div className="group">
        <div className="shapes">
          {SHAPE_OPTIONS.map((option) => {
            const selected = companion.shape === option.shape;
            return (
              <button key={option.shape} className="shape-btn" type="button" aria-pressed={selected} aria-label={option.name} title={option.name} onClick={() => patch({ shape: option.shape })}>
                <PactBlob size={40} live={selected} state={selected ? mood : "still"} appearance={{ shape: option.shape, color: companion.color, mood, v: 2 }} />
              </button>
            );
          })}
        </div>
      </div>
      <div className="group-label">Color</div>
      <div className="group">
        <div className="swatches">
          {COLOR_SWATCHES.map((swatch) => (
            <button key={swatch.color} className="swatch" type="button" aria-label={swatch.name} title={swatch.name} aria-pressed={companion.color === swatch.color} style={{ background: swatch.color }} onClick={() => patch({ color: swatch.color })} />
          ))}
        </div>
      </div>
      <div className="group-label">Mood</div>
      <div className="group">
        <div className="moods">
          {moods.map((item) => (
            <button key={item.id} className="mood-btn" type="button" aria-pressed={mood === item.id} onClick={() => patch({ mood: item.id })}>{item.label}</button>
          ))}
        </div>
      </div>
    </>
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
      const seen = new Set<string>();
      if (!stop) setDevices(list.filter((item) => {
        if (!item.deviceId || item.deviceId === "default" || /^default$/i.test(item.label)) return false;
        if (seen.has(item.deviceId)) return false;
        seen.add(item.deviceId);
        return true;
      }));
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
    options.push({ value: saved, label: "Saved microphone (unavailable)" });
  return (
    <div className="group">
      <MenuSelect label="Microphone" value={saved} options={options} onChange={(value) => onChange({ micDeviceId: value })} />
      <div className="set-row">
        <span>Permission</span>
        <span className="conn-meta">{mic}</span>
        {perm !== "granted" && (
          <button className="text-btn" type="button" onClick={() => void (perm === "denied" ? openMicSiteSettings() : openMicPermissionPage()).catch(() => setPerm("unknown"))}>Allow</button>
        )}
      </div>
      <p className="conn-note">The side panel can't ask for the microphone. Allow opens a Pact page where Chrome can.</p>
    </div>
  );
}

function About({ demo }: { demo?: boolean }) {
  return (
    <div className="group">
      <div className="set-row"><span>Pact reads the page you choose. When you ask it to do something, it sends that to Fo and shows the result here. Steps it suggests on its own wait until you approve.</span></div>
      {demo && <div className="set-row"><span>Demo mode is on. Approve runs a local mock, and nothing is sent to Fo.</span></div>}
    </div>
  );
}
