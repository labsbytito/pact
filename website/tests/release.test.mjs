import test from 'node:test';
import assert from 'node:assert/strict';
import { approvedRelease } from '../release.js';
const ready = { status: 'ready', backendStatus: 'verified', version: '0.2.0', sha256: 'a'.repeat(64), downloadUrl: './downloads/pact-judges.zip' };
test('ready release needs verified backend, version, checksum and safe ZIP URL', () => {
  assert.equal(approvedRelease(ready).downloadUrl, 'https://pact.invalid/downloads/pact-judges.zip');
  for (const patch of [{status:'pending'}, {backendStatus:'unverified'}, {version:null}, {sha256:null}, {sha256:'short'}, {downloadUrl:'javascript:alert(1)'}, {downloadUrl:'https://a.invalid/page.html'}, {downloadUrl:'https://user:password@a.invalid/file.zip'}, {downloadUrl:'http://remote.invalid/file.zip'}, {downloadUrl:'https://a.invalid/file.zip?token=secret'}, {downloadUrl:null}]) assert.equal(approvedRelease({...ready,...patch}), null);
  assert.equal(approvedRelease(null), null);
  assert.ok(approvedRelease(ready, 'http://127.0.0.1:4173/'));
});
