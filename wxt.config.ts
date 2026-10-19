import { defineConfig } from "wxt";
import identity from "./extension-identity.json";

function apiOrigin() {
  const raw = process.env.WXT_PUBLIC_PACT_API || "http://localhost:3000";
  try {
    return new URL(raw).origin;
  } catch {
    return "http://localhost:3000";
  }
}

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: ({ mode }) => {
    const hosts = new Set<string>([`${apiOrigin()}/*`]);
    if (mode === "development") {
      hosts.add("http://localhost:3000/*");
      hosts.add("http://127.0.0.1:3000/*");
    }
    const storeBuild = process.env.PACT_STORE_BUILD === "1";
    return {
      ...(storeBuild ? {} : { key: identity.key }),
      name: "Pact — turn inspiration into action",
      description: "A little intention. A real next step. Your companion beside the web.",
      permissions: ["storage", "activeTab", "scripting", "sidePanel", "contextMenus"],
      host_permissions: [...hosts],
      optional_host_permissions: ["http://*/*", "https://*/*"],
      action: { default_title: "Make a Pact" },
      commands: {
        open_pact: {
          suggested_key: { default: "Alt+Shift+P", mac: "Alt+Shift+P" },
          description: "Open Pact side panel",
        },
      },
      icons: { 16: "icon/16.png", 32: "icon/32.png", 48: "icon/48.png", 128: "icon/128.png" },
    };
  },
});
