const browserStorage = () =>
  typeof chrome !== "undefined" && chrome.storage?.local;
export async function read<T>(key: string, fallback: T): Promise<T> {
  const storage = browserStorage();
  if (storage) {
    const result = await storage.get(key);
    return (result[key] as T) ?? fallback;
  }
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}
export async function write(key: string, value: unknown) {
  const storage = browserStorage();
  if (storage) await storage.set({ [key]: value });
  else localStorage.setItem(key, JSON.stringify(value));
}
