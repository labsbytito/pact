import { approvedRelease } from './release.js';

const scenes = {
  think: {
    kicker: 'SPACE TO THINK', title: 'Good conversation.\nA clearer next move.',
    description: 'Ask a question, untangle an idea, or work through a plan. Start naturally. You don’t need a perfect prompt.',
    points: ['Conversation powered by Claude', 'A companion right in Chrome'], name: 'A new idea', next: 'context', nextLabel: 'Next: bring the page along',
    messages: [ ['user', 'I want to make more time for the things I keep saving.'], ['assistant', 'Let’s start with one. What’s something you’d love to actually do?'], ['user', 'That coastal walk. A whole afternoon, without rushing.'], ['assistant', 'A good place to start. Want to think through a simple plan?'] ]
  },
  context: {
    kicker: 'KEEP THE INSPIRATION CLOSE', title: 'The page is part\nof the conversation.',
    description: 'Bring a supported page into the conversation. Ask about what caught your eye, without starting the explanation from scratch.',
    points: ['Page context where access is allowed', 'Check what Pact could actually read'], name: 'That coastal walk', next: 'act', nextLabel: 'Next: take the next step',
    messages: [ ['note', 'Illustrative page context · Coastal walking guide'], ['user', 'Help me plan an afternoon around this walk.'], ['assistant', 'We can work from the page details Pact can access. What day are you thinking?'], ['user', 'Next Saturday. I’d like to be home before sunset.'], ['assistant', 'Let’s work out the route, travel time, and what we still need to check.'] ]
  },
  act: {
    kicker: 'A BRIDGE TO THE REAL WORLD', title: 'When you’re ready,\nbring in Fo.',
    description: 'Move from a conversation to a supported task through your Fo account. Review the next step and follow the returned status in Pact.',
    points: ['Uses the services authorized in your Fo account', 'Proposals and results stay distinct'], name: 'That coastal walk', next: 'think', nextLabel: 'Back to the conversation',
    messages: [ ['user', 'Ask Fo to research the route and travel options.'], ['assistant', 'Here’s a proposed research task. Check the scope before you approve.'], ['approval', 'Research the coastal walk and public transport options for Saturday. Do not book or contact anyone.'], ['note', 'Example proposal only. Nothing is submitted from this website.'] ]
  }
};
const tabs = [...document.querySelectorAll('[data-scene]')];
let current = 'think';
function showScene(key, focus = false) {
  const scene = scenes[key];
  current = key;
  tabs.forEach(tab => {
    const active = tab.dataset.scene === key;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active && focus) tab.focus();
  });
  document.querySelector('#demo-panel').setAttribute('aria-labelledby', `tab-${key}`);
  document.querySelector('#demo-kicker').textContent = scene.kicker;
  const title = document.querySelector('#demo-title');
  title.replaceChildren(...scene.title.split('\n').flatMap((line, i) => i ? [document.createElement('br'), document.createTextNode(line)] : [document.createTextNode(line)]));
  document.querySelector('#demo-description').textContent = scene.description;
  document.querySelector('#pact-name').textContent = scene.name;
  const points = document.querySelector('#demo-points');
  points.replaceChildren(...scene.points.map(text => { const p = document.createElement('span'); p.textContent = text; return p; }));
  const thread = document.querySelector('#product-thread');
  thread.replaceChildren(...scene.messages.map(([type, text], index) => {
    const el = document.createElement('div');
    el.className = type === 'approval' ? 'approval-card' : `bubble ${type}`;
    el.style.animationDelay = `${index * 70}ms`;
    if (type === 'approval') {
      const label = document.createElement('span'); label.textContent = 'PROPOSED TASK';
      const copy = document.createElement('p'); copy.textContent = text;
      const action = document.createElement('span'); action.className = 'approval-example'; action.textContent = 'Approval happens in Pact';
      el.append(label, copy, action);
    } else el.textContent = text;
    return el;
  }));
  document.querySelector('#next-scene').replaceChildren(document.createTextNode(scene.nextLabel + ' '), Object.assign(document.createElement('span'), { textContent: '→' }));
}
tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => showScene(tab.dataset.scene));
  tab.addEventListener('keydown', event => {
    let target;
    if (event.key === 'ArrowRight') target = (i + 1) % tabs.length;
    if (event.key === 'ArrowLeft') target = (i + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') target = 0;
    if (event.key === 'End') target = tabs.length - 1;
    if (target !== undefined) { event.preventDefault(); showScene(tabs[target].dataset.scene, true); }
  });
});
document.querySelector('#next-scene').addEventListener('click', () => showScene(scenes[current].next));
showScene('think');

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
if ('IntersectionObserver' in window && !reduced.matches) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
  }), { threshold: .08 });
  document.querySelectorAll('.intro-grid,.section-heading,.control-heading,.control-row,.install-grid,.connection-copy').forEach(el => { el.classList.add('reveal'); observer.observe(el); });
  reduced.addEventListener('change', () => { if (reduced.matches) document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible')); });
}

document.querySelector('#copy-address').addEventListener('click', async () => {
  const status = document.querySelector('#copy-status');
  try {
    await Promise.race([navigator.clipboard.writeText('chrome://extensions'), new Promise((_, reject) => setTimeout(() => reject(new Error('Clipboard unavailable')), 1200))]);
    status.textContent = 'Copied. Paste into Chrome’s address bar.';
  }
  catch { status.textContent = 'Copy this address: chrome://extensions'; }
});

async function loadRelease() {
  try {
    const response = await fetch('./release.json', { cache: 'no-store' });
    if (!response.ok) return;
    const release = approvedRelease(await response.json(), location.href);
    if (!release) return;
    // Verify that a real ZIP exists before exposing a download. HEAD is adequate
    // for same-origin static release assets; external storage must allow CORS.
    const artifact = await fetch(release.downloadUrl, { method: 'HEAD', cache: 'no-store' });
    const contentType = artifact.headers.get('content-type') || '';
    if (!artifact.ok || /text\/html/i.test(contentType)) return;
    const button = document.querySelector('#download');
    button.href = release.downloadUrl;
    button.setAttribute('download', 'pact-judges.zip');
    button.hidden = false;
    document.querySelector('#pending-guide').hidden = true;
    document.querySelector('#release-label').textContent = `PACT ${release.version} · VERIFIED PACKAGE`;
    document.querySelector('#release-note').textContent = 'Download the ZIP, then follow the three steps to get started in Chrome.';
    document.querySelector('#release-meta').textContent = `SHA-256: ${release.sha256}`;
  } catch { /* The initial pending state remains accurate on network/schema errors. */ }
}
void loadRelease();
