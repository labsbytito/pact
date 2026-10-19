import { captionKit } from "../lib/captions";
import { readPageSnapshot, type CaptureMode } from "../lib/page-reader";

export default defineUnlistedScript(() => {
  const caps = captionKit();
  (globalThis as unknown as {
    __pactRead?: (mode: CaptureMode, selection: string) => Promise<unknown>;
  }).__pactRead = (mode, selection) => readPageSnapshot(mode, selection, caps);
});
