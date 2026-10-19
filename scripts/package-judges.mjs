#!/usr/bin/env node
import { readdir, readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(process.argv[2] || resolve(project, '.output/judges'));
const build = resolve(project, '.output/chrome-mv3');
if (output === build || output.startsWith(build + '/')) throw new Error('Output must be outside the extension build.');
const entries = [];
async function walk(dir, prefix = '') {
 for (const item of (await readdir(dir)).sort()) {
  const name = prefix + item, full = resolve(dir, item), stat = await lstat(full);
  if (stat.isSymbolicLink()) throw new Error(`Symlink refused: ${name}`);
  if (stat.isDirectory()) { if (!/^(assets|chunks|icon)(\/|$)/.test(name)) throw new Error(`Unexpected directory: ${name}`); await walk(full, name + '/'); continue; }
  if (!/^(manifest\.json|background\.js|theme-boot\.js|page-reader\.js|sidepanel\.html|mic-permission\.html|(?:assets|chunks|icon)\/[a-zA-Z0-9_./-]+\.(?:js|css|svg|png|jpg|jpeg|webp|woff2?))$/.test(name)) throw new Error(`Unexpected build file: ${name}`);
  const data = await readFile(full);
  if (/\.(js|json|html|css|svg)$/.test(name) && /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sk-ant-[A-Za-z0-9_-]{12,}|sk-proj-[A-Za-z0-9_-]{12,}/.test(data.toString())) throw new Error(`Credential-like content refused: ${name}`);
  entries.push({ name, data });
 }
}
await walk(build);
const manifest = JSON.parse(entries.find(e => e.name === 'manifest.json')?.data.toString() || '{}');
if (manifest.manifest_version !== 3 || !manifest.host_permissions?.[0]?.startsWith('https://') || manifest.host_permissions.slice(1).some(h => !['http://*/*','https://*/*'].includes(h))) throw new Error('A hosted HTTPS Manifest V3 build is required.');
for (const name of [manifest.background?.service_worker, manifest.side_panel?.default_path, 'page-reader.js', ...Object.values(manifest.icons ?? {})]) if (!entries.some(e => e.name === name)) throw new Error(`Missing extension asset: ${name}`);
const origin = new URL(manifest.host_permissions[0]).origin;
const guide = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Install Pact</title><style>body{font:17px/1.6 system-ui,sans-serif;color:#262422;background:#faf6ef;margin:40px auto;max-width:740px;padding:0 24px}h1{font-size:36px;letter-spacing:-1px}h2{font-size:21px}aside{padding:16px 20px;border-radius:10px;background:#fff;border:1px solid #d9ccc0}.steps{display:grid;gap:14px;margin:24px 0}.step{background:#fff;padding:18px;border-radius:10px;border:1px solid #e6ded5}.step strong{display:block;font-size:18px}.mock{border-radius:8px;background:#eee8de;padding:15px;display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:12px;font-size:14px}.pill{padding:6px 12px;background:#303936;color:white;border-radius:6px}code{font-size:15px;overflow-wrap:anywhere}small{font-size:13px}a{color:#425c52}</style><main><h1>Pact</h1><p>Your conversation beside the web.</p>${process.env.PACT_RELEASE_READY ? `<aside>Pact connects to <code>${origin}</code>. No terminal, API key, local server, or separate Fo installation is needed for this hosted build.</aside>` : `<aside><strong>Release candidate — backend update pending.</strong><br>The operator must deploy the matching backend and verify a real Claude reply before distributing this to judges. It connects to <code>${origin}</code>.</aside>`}<div class="steps"><section class="step"><strong>1 · Extract the ZIP</strong>Keep the extracted folder somewhere permanent. Inside it you’ll see <b>manifest.json</b> next to this guide.<div class="mock">📁 pact-judges <span>manifest.json<br>START-HERE.html</span></div></section><section class="step"><strong>2 · Open Chrome’s extensions page</strong>Type <code>chrome://extensions</code> into Chrome’s address bar.<div class="mock">Chrome address bar <span class="pill">chrome://extensions</span></div></section><section class="step"><strong>3 · Turn on Developer mode</strong>Use the switch in the upper-right corner.<div class="mock">Extensions <span class="pill">Developer mode &nbsp; ●</span></div></section><section class="step"><strong>4 · Load Pact</strong>Click <b>Load unpacked</b> and choose the extracted folder, the one that directly contains <code>manifest.json</code>.<div class="mock"><span class="pill">Load unpacked</span> → 📁 pact-judges</div></section></div><h2>Open it</h2><p>Open an ordinary webpage. In Chrome’s puzzle-piece menu, pin Pact, then click its icon. Use <b>+</b> to read the page or attach a file. Ask a question to start chatting.</p><h2>Connect your tools</h2><p>Choose <b>Settings → Connections → Connect Fo</b> and sign in with your own Fo account. Pact uses the services you authorize inside Fo. Account access, service connections and credits depend on Fo. You can chat and read pages without connecting Fo.</p><h2>Your files and chats</h2><p>Up to 3 files: text up to 24KB each, PDF up to 900KB, and PNG/JPEG/WebP/GIF images up to 10MB before resizing. Export Word files as PDF; export spreadsheets as CSV. Attachments go to Claude with the chat, and are kept in this Chrome profile for follow-up questions. Deleting a Pact removes its file contents; accepted or uncertain Fo action records remain.</p><p>In <b>History</b>, choose <b>New Pact</b> to select a companion. Change a Pact’s look any time from its “…” menu. Rename, pin, archive, restore or delete chats from History.</p><h2>If something needs attention</h2><p>Page reading works on ordinary websites when Chrome permits access. Restricted Chrome pages and some protected/video content cannot be read. If Fo asks for sign-in, reconnect in Settings. An available tool or Fo reply is not proof an external task completed.</p><p>Keep the extracted folder in place. Remove Pact from <code>chrome://extensions</code> when finished; save any chat details you need first.</p><small>Only compiled extension files are included. The manifest public key preserves the extension identity; it is not a credential. Installation follows <a href="https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked">Chrome’s official unpacked-extension instructions</a>.</small></main></html>`;
// Fixed timestamps, ordering and compression keep identical builds reproducible.
const table = Array.from({length:256}, (_, n) => { for(let k=0;k<8;k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
const crc32 = bytes => { let crc=0xffffffff; for(const b of bytes) crc=table[(crc ^ b)&255] ^ (crc>>>8); return (crc ^ 0xffffffff)>>>0; };
function zip(files) {
 const chunks=[], central=[]; let offset=0;
 for(const file of [...files].sort((a,b)=>a.name.localeCompare(b.name,'en'))) {
  const name=Buffer.from(file.name), compressed=deflateRawSync(file.data), crc=crc32(file.data);
  const head=Buffer.alloc(30); head.writeUInt32LE(0x04034b50); head.writeUInt16LE(20,4); head.writeUInt16LE(8,8); head.writeUInt16LE(0x5c21,12); head.writeUInt32LE(crc,14); head.writeUInt32LE(compressed.length,18); head.writeUInt32LE(file.data.length,22); head.writeUInt16LE(name.length,26);
  chunks.push(head,name,compressed);
  const row=Buffer.alloc(46); row.writeUInt32LE(0x02014b50); row.writeUInt16LE(20,4); row.writeUInt16LE(20,6); row.writeUInt16LE(8,10); row.writeUInt16LE(0x5c21,14); row.writeUInt32LE(crc,16); row.writeUInt32LE(compressed.length,20); row.writeUInt32LE(file.data.length,24); row.writeUInt16LE(name.length,28); row.writeUInt32LE(offset,42); central.push(row,name); offset+=head.length+name.length+compressed.length;
 }
 const directory=Buffer.concat(central), end=Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length,8); end.writeUInt16LE(files.length,10); end.writeUInt32LE(directory.length,12); end.writeUInt32LE(offset,16); return Buffer.concat([...chunks,directory,end]);
}
await mkdir(output,{recursive:true});
await writeFile(resolve(output,'pact-extension.zip'),zip(entries));
await writeFile(resolve(output,'pact-judges.zip'),zip([{name:'START-HERE.html',data:Buffer.from(guide)},...entries]));
await writeFile(resolve(output,'START-HERE.html'),guide);
const sums=[];
for(const name of ['pact-judges.zip','pact-extension.zip','START-HERE.html']) sums.push(`${createHash('sha256').update(await readFile(resolve(output,name))).digest('hex')}  ${name}`);
await writeFile(resolve(output,'SHA256SUMS.txt'),sums.join('\n')+'\n');
console.log(`Packaged ${entries.length} compiled files for ${origin} at ${relative(project,output)}. ${process.env.PACT_RELEASE_READY ? 'Verified release.' : 'Release candidate; backend deployment and live account verification pending.'}`);
