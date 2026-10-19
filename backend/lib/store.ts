import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Redis } from "@upstash/redis";
import { storePath } from "./env";

export function diskForbidden() {
  return process.env.VERCEL === "1";
}

export interface Store {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
}

type Row = { value: string; exp?: number };

export function memoryStore(): Store {
  const rows = new Map<string, Row>();
  const live = (row: Row | undefined) => {
    if (!row) return null;
    if (row.exp && row.exp <= Date.now()) return null;
    return row.value;
  };
  return {
    async get(key) {
      return live(rows.get(key));
    },
    async set(key, value, ttlSeconds) {
      rows.set(key, {
        value,
        ...(ttlSeconds ? { exp: Date.now() + ttlSeconds * 1000 } : {}),
      });
    },
    async del(key) {
      rows.delete(key);
    },
  };
}

export function fileStore(path = storePath()): Store {
  let queue: Promise<unknown> = Promise.resolve();
  const read = async () => {
    try {
      return JSON.parse(await readFile(path, "utf8")) as Record<string, Row>;
    } catch {
      return {};
    }
  };
  const write = (data: Record<string, Row>) => {
    const task = queue.then(async () => {
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      await writeFile(path, JSON.stringify(data), { mode: 0o600 });
    });
    queue = task.catch(() => {});
    return task;
  };
  return {
    async get(key) {
      const row = (await read())[key];
      if (!row) return null;
      if (row.exp && row.exp <= Date.now()) return null;
      return row.value;
    },
    async set(key, value, ttlSeconds) {
      const data = await read();
      data[key] = {
        value,
        ...(ttlSeconds ? { exp: Date.now() + ttlSeconds * 1000 } : {}),
      };
      await write(data);
    },
    async del(key) {
      const data = await read();
      delete data[key];
      await write(data);
    },
  };
}

export function redisStore(): Store {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return {
    async get(key) {
      const value = await redis.get<string>(key);
      return value == null ? null : String(value);
    },
    async set(key, value, ttlSeconds) {
      if (ttlSeconds) await redis.set(key, value, { ex: ttlSeconds });
      else await redis.set(key, value);
    },
    async del(key) {
      await redis.del(key);
    },
  };
}

// Next dev bundles each route on its own, so a module-level singleton drops
// held plans between interpret and approve. One store per process.
const processStore = globalThis as typeof globalThis & { __pactStore?: Store };

export function openStore() {
  if (processStore.__pactStore) return processStore.__pactStore;
  if (process.env.PACT_STORE === "memory") processStore.__pactStore = memoryStore();
  else if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  )
    processStore.__pactStore = redisStore();
  else if (diskForbidden())
    throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required");
  else processStore.__pactStore = fileStore();
  return processStore.__pactStore;
}

export function useStore(store: Store) {
  processStore.__pactStore = store;
}
