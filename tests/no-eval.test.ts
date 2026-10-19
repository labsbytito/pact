import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const roots = ["entrypoints", "components", "hooks", "lib", "backend/lib", "backend/app"];

async function files(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const found: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await files(path)));
    else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) found.push(path);
  }
  return found;
}

test("source does not call eval or new Function", async () => {
  const paths = (await Promise.all(roots.map((root) => files(root)))).flat();
  assert.ok(paths.length > 10);
  for (const path of paths) {
    const source = await readFile(path, "utf8");
    assert.equal(/\beval\s*\(|\bnew\s+Function\s*\(/.test(source), false, path);
  }
});
