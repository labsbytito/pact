/** Microphone permission helpers for the side panel.
 * Chrome will not show a getUserMedia prompt inside a side panel.
 * Grant once on an extension page, then SpeechRecognition works in the panel.
 */

export type MicPermission = "granted" | "prompt" | "denied" | "unknown";

export async function queryMicPermission(): Promise<MicPermission> {
  try {
    const status = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    if (status.state === "granted") return "granted";
    if (status.state === "denied") return "denied";
    if (status.state === "prompt") return "prompt";
  } catch {
    /* Permissions API may reject "microphone" in some builds. */
  }
  try {
    const stored = await chrome.storage?.local?.get("micGranted");
    if (stored?.micGranted === true) return "granted";
    if (stored?.micGranted === false) return "denied";
  } catch {
    /* not in extension context */
  }
  return "unknown";
}

/** Open the extension mic grant page as a focused popup window. */
export async function openMicPermissionPage(): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.runtime?.id)
    throw new Error("Microphone setup needs the installed Pact extension.");
  const url = chrome.runtime.getURL("/mic-permission.html");
  try {
    await chrome.windows.create({
      url,
      type: "popup",
      width: 440,
      height: 360,
      focused: true,
    });
  } catch {
    await chrome.tabs.create({ url, active: true });
  }
}

/** Chrome site details for this extension — used when permission is blocked. */
export async function openMicSiteSettings(): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.runtime?.id)
    throw new Error("Open Chrome settings for this extension to allow the mic.");
  const site = encodeURIComponent(`chrome-extension://${chrome.runtime.id}/`);
  await chrome.tabs.create({
    url: `chrome://settings/content/siteDetails?site=${site}`,
    active: true,
  });
}

/** Briefly open the mic to confirm grant, then stop tracks. */
export async function probeMicrophone(deviceId?: string): Promise<void> {
  const constraints: MediaStreamConstraints =
    deviceId && deviceId !== "default"
      ? { audio: { deviceId: { exact: deviceId } } }
      : { audio: true };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  for (const track of stream.getTracks()) track.stop();
}

export async function listMicrophones(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "audioinput");
  } catch {
    return [];
  }
}
