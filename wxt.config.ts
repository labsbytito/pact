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
    host_permissions: ["http://127.0.0.1:4317/*"],
    action: { default_title: "Make a Pact" },
    commands: {
      open_pact: {
        suggested_key: {
          default: "Alt+Shift+P",
          mac: "Alt+Shift+P",
        },
        description: "Open Pact side panel",
      },
    },
    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      128: "icon/128.png",
    },
  },
});
