import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export function backendRoot() {
  return join(here, "..");
}

export function localPath(...parts: string[]) {
  return join(backendRoot(), ".local", ...parts);
}

export function localDirectoryUrl(...parts: string[]) {
  const url = pathToFileURL(localPath(...parts));
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}
