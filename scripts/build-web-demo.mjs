#!/usr/bin/env node
// Publishes the SAME side-panel build as a no-install web demo at website/try/.
// Run after `wxt build` (scripts/release.mjs does this). Page reading and the mic grant
// page need the real extension; chat, files, history, settings and Fo approvals work.
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = resolve(root, '.output/chrome-mv3');
const out = resolve(root, 'website/try');
const keep = new Set(['index.html']); // hand-written wrapper page
for (const name of readdirSync(out, { withFileTypes: true }).map(d => d.name)) if (!keep.has(name)) rmSync(resolve(out, name), { recursive: true, force: true });
for (const dir of ['assets', 'chunks', 'icon']) cpSync(resolve(build, dir), resolve(out, dir), { recursive: true });
cpSync(resolve(build, 'theme-boot.js'), resolve(out, 'theme-boot.js'));
const rewrite = (file, pairs) => { let text = readFileSync(file, 'utf8'); for (const [from, to] of pairs) text = text.split(from).join(to); writeFileSync(file, text); };
let html = readFileSync(resolve(build, 'sidepanel.html'), 'utf8');
html = html.replace(/(src|href)="\//g, '$1="/try/').replace('<script src="/try/theme-boot.js"></script>', '<script src="/try/shim.js"></script>\n    <script src="/try/theme-boot.js"></script>');
writeFileSync(resolve(out, 'app.html'), html);
writeFileSync(resolve(out, 'shim.js'), `// Web-demo shim: the panel runs as a normal web page, so chrome.* APIs are absent.
window.chrome = window.chrome || {};
document.documentElement.dataset.web = '1';
const style = document.createElement('style');
style.textContent = '[data-web] .summarize-btn{display:none!important}';
document.head.appendChild(style);
`);
for (const file of readdirSync(resolve(out, 'assets')).filter(f => f.endsWith('.css'))) rewrite(resolve(out, 'assets', file), [['url(/assets/', 'url(/try/assets/']]);
for (const file of readdirSync(resolve(out, 'chunks')).filter(f => f.startsWith('pdf.worker'))) rewrite(resolve(out, 'chunks', file), [['/assets/', '/try/assets/']]);
console.log('Web demo staged at website/try/ from the shipped extension build.');
