#!/usr/bin/env node
// Verifies the hosted backend end to end the way a judge's extension would use it.
// Uses one install slot and one short Claude reply. Usage: node scripts/live-smoke.mjs [origin]
import { randomUUID } from 'node:crypto';
const origin = (process.argv[2] || process.env.WXT_PUBLIC_PACT_API || 'https://pact-nine-lyart.vercel.app').replace(/\/$/, '');
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); return ok; };
async function json(res) { try { return await res.json(); } catch { return {}; } }

const install = await fetch(`${origin}/api/install`, { method: 'POST' });
const issued = await json(install);
if (!check('issues an install token', install.ok && !!issued.token, install.ok ? '' : `HTTP ${install.status} ${issued.error ?? ''}`)) process.exit(1);
const auth = { Authorization: `Bearer ${issued.token}`, 'Content-Type': 'application/json' };

const health = await json(await fetch(`${origin}/api/health`, { headers: auth }));
check('health is ok', health.ok === true, `budget=${health.budget} model=${health.model}`);
check('model verified', health.modelVerified === true);
check('not running in demo mode', health.demo === false);
console.log('NOTE  install limit per IP per hour is PACT_RL_INSTALLS_HOUR (code default 60); not observable from outside');

const code = `PERIWINKLE-${Math.floor(1000 + Math.random() * 9000)}`;
const body = { responseStyle: 'short', askBefore: 'suggested', pact: { id: randomUUID(), intention: 'Check my file', messages: [{ role: 'user', text: 'What is the launch codeword in my attached file? Reply with the codeword only.' }], attachments: [{ name: 'note.txt', mime: 'text/plain', kind: 'text', text: `The launch codeword is ${code}.` }] } };
const reply = await fetch(`${origin}/api/interpret`, { method: 'POST', headers: auth, body: JSON.stringify(body) });
const answer = await json(reply);
check('Claude reads an attached file (backend delivers attachments)', reply.ok && String(answer.reply ?? '').includes(code), reply.ok ? String(answer.reply ?? '').slice(0, 80) : `HTTP ${reply.status} ${answer.error ?? ''}`);

const ok = results.every(Boolean);
console.log(ok ? '\nHosted backend verified.' : '\nHosted backend NOT verified. Do not publish the download.');
process.exit(ok ? 0 : 1);
