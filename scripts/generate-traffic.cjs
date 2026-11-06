'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { performance } = require('node:perf_hooks');
const { parseOptions, validateSession, seededRandom } = require('./lib/traffic-plan.cjs');
const { replay } = require('./lib/feature-window.cjs');

const root = path.resolve(__dirname, '..');
const base = path.join(root, '.local-backups/traffic');
const lockFile = path.join(base, 'session.lock');
const origin = 'http://127.0.0.1:5173';
const gateway = 'https://127.0.0.1:18444';
let interrupted = false;
process.on('SIGINT', () => { interrupted = true; });
process.on('SIGTERM', () => { interrupted = true; });

async function snapshot() {
  const response = await fetch(origin + '/api/live/snapshot', { signal: AbortSignal.timeout(3000), redirect: 'error' });
  if (!response.ok) throw Error('Live snapshot unavailable');
  return response.json();
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJSON(file, value) {
  const temporary = file + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2));
  fs.renameSync(temporary, file);
}

function requestStop() {
  const lock = readJSON(lockFile);
  if (!/^traffic-[a-f0-9-]{36}$/.test(lock.id)) throw Error('Invalid generator lock');
  fs.writeFileSync(path.join(base, lock.id, 'stop.request'), '');
  console.log('Generator stop requested; Live remains available.');
}

async function exportDataset(source, destination, records, startedAt, endedAt, scenario, sessionId) {
  const selected = new Set(records.map(row => row.request_id).filter(Boolean));
  // Source collector already imposes a bounded 100k-event session.
  const events = fs.readFileSync(path.join(source, 'events.jsonl'), 'utf8')
    .split('\n').filter(Boolean).map(line => JSON.parse(line));
  const requests = events.filter(event => event.event === 'gateway_request' && selected.has(event.request_id));
  const missingResponses = records.filter(row => !row.request_id).length;
  const unjoined = selected.size - new Set(requests.map(event => event.request_id)).size;
  const trustworthy = records.length > 0 && missingResponses === 0 && unjoined === 0;
  const connections = new Set(requests.map(event => event.connection_id));
  const metadata = events.filter(event => ['gateway_tls', 'gateway_h2'].includes(event.event) && connections.has(event.connection_id));
  fs.mkdirSync(destination);
  fs.writeFileSync(path.join(destination, 'events.jsonl'), [...metadata, ...requests].map(event => JSON.stringify(event)).join('\n') + '\n');
  const profiles = path.join(source, 'fingerprint-profiles.json');
  if (fs.existsSync(profiles)) fs.copyFileSync(profiles, path.join(destination, 'fingerprint-profiles.json'));
  writeJSON(path.join(destination, 'manifest.json'), {
    schema_version: 'traffic-window.v1',
    session_id: sessionId,
    source_gateway_session_id: path.basename(path.dirname(source)),
    split_group_id: path.basename(path.dirname(source)),
    started_at: startedAt,
    state: 'closed',
    window_label: trustworthy ? scenario : null,
    requested_scenario: scenario,
    data_quality: trustworthy ? 'joined' : 'incomplete',
    label_source: 'operator_scenario_intent',
    dataset_scope: 'generator_attributed_requests',
    selected_request_count: requests.length,
    unjoined_request_count: unjoined,
    missing_response_ids: missingResponses,
  });
  return replay(destination, endedAt);
}

async function main() {
  if (process.argv[2] === 'stop') return requestStop();
  const options = parseOptions(process.argv.slice(2));
  const liveLock = readJSON(path.join(root, '.local-backups/ui-live/session.lock'));
  const liveDirectory = path.join(root, '.local-backups/ui-live', liveLock.sessionId);
  if (!/^\d+$/.test(liveLock.sessionId)) throw Error('Invalid Live lock');
  const liveReport = readJSON(path.join(liveDirectory, 'result.json'));
  validateSession(liveLock, liveReport, await snapshot());
  const { chromium } = require('../dashboard/node_modules/playwright');
  const id = 'traffic-' + randomUUID();
  const out = path.join(base, id);
  fs.mkdirSync(base, { recursive: true });
  const lockFd = fs.openSync(lockFile, 'wx');
  fs.writeSync(lockFd, JSON.stringify({ id, pid: process.pid }));
  fs.closeSync(lockFd);
  fs.mkdirSync(out);
  const records = [];
  const clients = [];
  const rng = seededRandom(options.seed);
  let browser, state = 'starting', failure = null;
  let startedAt, endedAt, skipped = 0;
  const manifest = {
    id, options, source_gateway_session_id: liveLock.sessionId,
    split_group_id: liveLock.sessionId,
    purpose: 'bounded_scenario_pilot', engine: 'installed-chrome',
    limitations: ['single-host loopback identities', 'API-only query/static variation absent',
      'scenario labels express generator intent, not proven saturation', 'Markov requires later train-only reference'],
  };
  const emergency = setTimeout(() => { interrupted = true; browser?.close().catch(() => {}); }, (options.seconds + 60) * 1000);
  let monitor;
  try {
    browser = await chromium.launch({
      channel: 'chrome', headless: true, timeout: 20000,
      args: ['--ignore-certificate-errors-spki-list=' + liveReport.browserSPKI,
        '--disable-background-networking'],
    });
    for (const role of ['human', 'bot']) {
      for (let index = 0; index < options[role]; index++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        page.setDefaultTimeout(4000);
        // Dashboard provides the exact lab origin and session metadata; all workload uses HTTPS directly.
        await page.goto(origin + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 10000 });
        const settings = await page.evaluate(() => ({
          gateway: document.querySelector('meta[name="dacn2-gateway"]')?.content,
          token: document.querySelector('meta[name="dacn2-session"]')?.content,
          ids: document.querySelector('meta[name="dacn2-fixtures"]')?.content,
        }));
        if (settings.gateway !== gateway || !/^[a-f0-9]{64}$/.test(settings.token || '')) throw Error('Invalid lab endpoint/session metadata');
        const ids = (settings.ids || '').split(',');
        if (!ids.length || ids.some(value => !/^[1-9][0-9]*$/.test(value))) throw Error('Invalid fixture IDs');
        clients.push({ role, id: role + '-' + index, page, settings, course: ids[index % Math.min(2, ids.length)], busy: false, next: 0, actions: 0 });
      }
    }
    validateSession(liveLock, liveReport, await snapshot());
    startedAt = new Date().toISOString();
    state = 'running';
    writeJSON(path.join(out, 'manifest.json'), { ...manifest, state, started_at: startedAt });
    const deadline = performance.now() + options.seconds * 1000;
    const inFlight = new Set();
    let cursor = 0;
    monitor = setInterval(() => {
      if (fs.existsSync(path.join(out, 'stop.request'))) interrupted = true;
      try {
        if (readJSON(path.join(root, '.local-backups/ui-live/session.lock')).sessionId !== liveLock.sessionId) interrupted = true;
      } catch { interrupted = true; }
    }, 250);
    async function act(client) {
      client.busy = true;
      const action = client.actions++;
      const registration = client.role === 'human' && action % 4 === 3;
      const route = registration ? '/courses/' + client.course + '/registrations' : '/courses';
      const started = new Date().toISOString();
      let result;
      try {
        result = await client.page.evaluate(async ({ target, token, registration, code }) => {
          const response = await fetch(target, {
            method: registration ? 'POST' : 'GET',
            headers: { 'X-DACN2-Session': token, ...(registration ? { 'Content-Type': 'application/json' } : {}) },
            body: registration ? JSON.stringify({ studentCode: code }) : undefined,
            signal: AbortSignal.timeout(4000),
            redirect: 'error',
          });
          await response.arrayBuffer();
          return { status: response.status, request_id: response.headers.get('X-Request-ID'),
            connection_id: response.headers.get('X-DACN2-Connection-ID'), protocol: response.headers.get('X-DACN2-Protocol') };
        }, { target: gateway + route, token: client.settings.token, registration,
          code: 'G_' + id.slice(-8) + '_' + client.id + '_' + action });
      } catch {
        result = { status: null, request_id: null, error: 'request_failed_or_timeout' };
      }
      const record = { generator_session_id: id, client_id: client.id,
        ground_truth: client.role === 'human' ? 'legitimate' : 'attack',
        started_at: started, completed_at: new Date().toISOString(),
        method: registration ? 'POST' : 'GET',
        route: registration ? '/courses/:id/registrations' : '/courses', ...result };
      records.push(record);
      fs.appendFileSync(path.join(out, 'ground-truth.jsonl'), JSON.stringify(record) + '\n');
      client.busy = false;
      client.next = performance.now() + (client.role === 'human' ? 500 + Math.floor(rng() * 1000) : 0);
    }
    // One fixed dispatch interval bounds offered rate. No catch-up bursts or unbounded queue.
    while (!interrupted && performance.now() < deadline) {
      const tick = performance.now();
      let client;
      for (let offset = 0; offset < clients.length; offset++) {
        const index = (cursor + offset) % clients.length;
        if (!clients[index].busy && clients[index].next <= tick) {
          client = clients[index];
          cursor = (index + 1) % clients.length;
          break;
        }
      }
      if (client) {
        const task = act(client);
        inFlight.add(task);
        task.then(() => inFlight.delete(task), () => {
          inFlight.delete(task);
          failure = 'Ground-truth recording failed';
          interrupted = true;
        });
      } else skipped++;
      await delay(Math.ceil(Math.max(1, 1000 / options.rps - (performance.now() - tick))));
    }
    await Promise.all(inFlight);
    endedAt = new Date().toISOString();
    state = failure ? 'failed' : interrupted ? 'interrupted' : 'completed';
  } catch (error) {
    state = 'failed';
    failure = error.code === 'ENOENT' ? 'Required local file missing' : 'Generator setup or runtime failed; check Live and installed Chrome';
  } finally {
    clearTimeout(emergency);
    clearInterval(monitor);
    await browser?.close().catch(() => {});
    endedAt ||= new Date().toISOString();
    let dataset;
    if (startedAt) {
      await delay(300);
      try {
        dataset = await exportDataset(path.join(liveDirectory, 'dataset'), path.join(out, 'dataset'),
          records, startedAt, endedAt, options.scenario, id);
        if (dataset.data_quality !== 'joined') {
          state = 'failed';
          failure = 'Incomplete request attribution; inspect ground-truth.jsonl and source logs';
        }
      } catch {
        state = 'failed';
        failure = 'Dataset export failed; retain ground-truth.jsonl and source Live logs for recovery';
      }
    }
    writeJSON(path.join(out, 'manifest.json'), { ...manifest, state, failure,
      started_at: startedAt || null, ended_at: endedAt, skipped_dispatches: skipped,
      requests: records.length, errors: records.filter(row => row.status === null).length,
      statuses: records.reduce((counts, row) => { const key = String(row.status); counts[key] = (counts[key] || 0) + 1; return counts; }, {}),
      dataset: dataset || null, cleanup: 'generator_browser_closed_live_retained' });
    fs.unlinkSync(lockFile);
    console.log(JSON.stringify({ state, out, requests: records.length, rows: dataset?.rows, unjoined: dataset?.unjoined_request_count, failure }));
    if (state === 'failed') process.exitCode = 1;
  }
}

if (require.main === module) main().catch(error => {
  console.error(error.code === 'EEXIST' ? 'A generator is already running. Use: node scripts/generate-traffic.cjs stop' : error.message);
  process.exitCode = 1;
});
module.exports = { exportDataset };
