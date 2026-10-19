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
    // Pact reads whichever page you open it on (YouTube, Reddit, docs, PDFs). Granting all sites up front means no per-site prompts.
    const hosts = new Set<string>([`${apiOrigin()}/*`, "http://*/*", "https://*/*"]);
    if (mode === "development") {
      hosts.add("http://localhost:3000/*");
      hosts.add("http://127.0.0.1:3000/*");
    }
    const storeBuild = process.env.PACT_STORE_BUILD === "1";
    return {
      ...(storeBuild ? {} : { key: identity.key }),
      name: "Pact",
      description: "Read a page, pick one next step, and let Fo do it after you approve.",
      permissions: ["storage", "activeTab", "scripting", "sidePanel", "contextMenus"],
      host_permissions: [...hosts],
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
