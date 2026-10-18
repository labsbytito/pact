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
    // The companion is the only host granted at install. Page access is optional
    // and requested one origin at a time from a side-panel click. activeTab
    // still covers the toolbar icon and the selection context menu. The tabs
    // permission is not requested.
    host_permissions: ["http://127.0.0.1:4317/*"],
    optional_host_permissions: ["http://*/*", "https://*/*"],
    action: { default_title: "Make a Pact" },
    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      128: "icon/128.png",
    },
  },
});
