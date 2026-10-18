const localArea = () =>
  typeof chrome !== "undefined" && chrome.storage?.local
    ? chrome.storage.local
    : undefined;

const syncArea = () =>
  typeof chrome !== "undefined" && chrome.storage?.sync
    ? chrome.storage.sync
    : undefined;

function memoryRead<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function memoryWrite(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export async function read<T>(key: string, fallback: T): Promise<T> {
  const storage = localArea();
  if (storage) {
    const result = await storage.get(key);
    return (result[key] as T) ?? fallback;
  }
  return memoryRead(key, fallback);
}

export async function write(key: string, value: unknown) {
  const storage = localArea();
  if (storage) await storage.set({ [key]: value });
  else memoryWrite(key, value);
}

/**
 * Prefer chrome.storage.sync, then local, then window localStorage.
 * Used for small preferences like the companion appearance.
 */
export async function readSync<T>(key: string, fallback: T): Promise<T> {
  const sync = syncArea();
  if (sync) {
    try {
      const result = await sync.get(key);
      if (result[key] !== undefined) return result[key] as T;
    } catch {
      /* fall through to local */
    }
  }
  return read(key, fallback);
}

export async function writeSync(key: string, value: unknown) {
  const sync = syncArea();
  if (sync) {
    try {
      await sync.set({ [key]: value });
      return;
    } catch {
      /* fall through to local */
    }
  }
  await write(key, value);
}
