#!/usr/bin/env node
// Builds the hosted extension, packages the judge ZIP and stages it for the website.
// Pass --verified only after scripts/live-smoke.mjs passes against the deployed backend.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const verified = process.argv.includes('--verified');
const env = { ...process.env };
for (const line of readFileSync(resolve(root, '.env.production'), 'utf8').split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2]; }
const run = (cmd, args, extra = {}) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit', env: { ...env, ...extra } });
run('pnpm', ['exec', 'wxt', 'build']);
run('node', ['scripts/package-judges.mjs', resolve(root, '.output/judges')], { PACT_RELEASE_READY: verified ? '1' : '' });
const zip = resolve(root, '.output/judges/pact-judges.zip');
const dest = resolve(root, 'website/downloads');
mkdirSync(dest, { recursive: true });
copyFileSync(zip, resolve(dest, 'pact-judges.zip'));
const sha256 = createHash('sha256').update(readFileSync(zip)).digest('hex');
const version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version;
const release = verified
  ? { status: 'ready', version, downloadUrl: './downloads/pact-judges.zip', sha256, backendStatus: 'verified', notes: 'Verified against the live backend.' }
  : { status: 'pending', version: null, downloadUrl: null, sha256: null, backendStatus: 'unverified', notes: 'The judge download is being verified. The installation guide is ready below.' };
writeFileSync(resolve(root, 'website/release.json'), JSON.stringify(release, null, 2) + '\n');
console.log(`${verified ? 'Staged VERIFIED' : 'Staged UNVERIFIED (website stays pending)'} release ${version} sha256=${sha256}`);
