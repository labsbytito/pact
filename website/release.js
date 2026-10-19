// A release must be explicitly verified before the page offers a download.
export function approvedRelease(data, base = 'https://pact.invalid/') {
  if (!data || data.status !== 'ready' || data.backendStatus !== 'verified') return null;
  if (typeof data.version !== 'string' || !/^[\w.+-]{1,50}$/.test(data.version)) return null;
  if (typeof data.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(data.sha256)) return null;
  if (typeof data.downloadUrl !== 'string') return null;
  try {
    const url = new URL(data.downloadUrl, base);
    const origin = new URL(base);
    if (url.username || url.password || url.search || url.hash || !url.pathname.endsWith('.zip')) return null;
    if (url.protocol !== 'https:' && !(url.origin === origin.origin && ['localhost', '127.0.0.1'].includes(url.hostname))) return null;
    return { version: data.version, downloadUrl: url.href, sha256: data.sha256.toLowerCase() };
  } catch { return null; }
}
