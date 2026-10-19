const status = document.getElementById("status");
const allow = document.getElementById("allow");
const closeBtn = document.getElementById("close");
const settingsBtn = document.getElementById("settings");

function setStatus(text: string) {
  if (status) status.textContent = text;
}

async function openSiteSettings() {
  const site = encodeURIComponent(`chrome-extension://${chrome.runtime.id}/`);
  await chrome.tabs.create({
    url: `chrome://settings/content/siteDetails?site=${site}`,
    active: true,
  });
}

async function requestMic() {
  setStatus("Waiting for Chrome’s permission prompt…");
  settingsBtn?.classList.add("hidden");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    await chrome.storage.local.set({ micGranted: true, micGrantedAt: Date.now() });
    setStatus("Microphone allowed. You can close this window and return to Pact.");
    chrome.runtime.sendMessage({ type: "pact-mic-granted" }).catch(() => {});
  } catch (error) {
    await chrome.storage.local.set({ micGranted: false });
    const blocked = error instanceof DOMException && error.name === "NotAllowedError";
    if (blocked) {
      setStatus("Permission was blocked. Open mic settings to allow Pact, then try again.");
      settingsBtn?.classList.remove("hidden");
    } else {
      setStatus("Could not reach the microphone. Check that one is connected and try again.");
    }
  }
}

allow?.addEventListener("click", () => void requestMic());
closeBtn?.addEventListener("click", () => window.close());
settingsBtn?.addEventListener("click", () => void openSiteSettings());
void requestMic();
