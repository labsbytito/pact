import { defineConfig } from "wxt";
import identity from "./extension-identity.json";
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    key: identity.key,
    name: "Pact — turn inspiration into action",
    description:
      "A little intention. A real next step. Your companion beside the web.",
    permissions: [
      "storage",
      "activeTab",
      "scripting",
      "sidePanel",
      "identity",
      "contextMenus",
    ],
    // A side-panel button is not an extension-action gesture, so activeTab is
    // not granted and Chrome omits tab.url. Host access on ordinary http(s)
    // pages is the narrowest permission that lets Select item inject there.
    // It does not include chrome://, file://, or other restricted schemes.
    // The Chrome Web Store stays blocked by Chrome even on https. The tabs
    // permission is not requested: it would expose every tab URL, including
    // pages this extension still cannot script. Loopback is covered by http://*/*.
    host_permissions: ["http://*/*", "https://*/*"],
    action: { default_title: "Make a Pact" },
    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      128: "icon/128.png",
    },
  },
});
