'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { performance } = require('node:perf_hooks');
const { parseOptions, validateSession, seededRandom } = require('./lib/traffic-plan.cjs');
const { replay, VERSION } = require('./lib/feature-window.cjs');
const {labelFor}=require('./lib/training-data.cjs');
const {sourceProxy,nodeClient}=require('./lib/traffic-clients.cjs');

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

async function exportDataset(source, destination, records, startedAt, endedAt, scenario, sessionId, context={state:'completed'}) {
  const selected = new Set(records.map(row => row.request_id).filter(Boolean));
  // Source collector already imposes a bounded 100k-event session.
  const events = fs.readFileSync(path.join(source, 'events.jsonl'), 'utf8')
    .split('\n').filter(Boolean).map(line => JSON.parse(line));
  const requests = events.filter(event => event.event === 'gateway_request' && selected.has(event.request_id));
  const missingResponses = records.filter(row => !row.request_id).length;
  const unjoined = selected.size - new Set(requests.map(event => event.request_id)).size;
  const trustworthy = records.length > 0 && missingResponses === 0 && unjoined === 0 && context.state==='completed' && labelFor(records,scenario)!==null && requests.every(r=>r.schema_version===2);
  const connections = new Set(requests.map(event => event.connection_id));
  const metadata = events.filter(event => ['gateway_tls', 'gateway_h2', 'gateway_h2_stream'].includes(event.event) && connections.has(event.connection_id));
  fs.mkdirSync(destination);
  fs.writeFileSync(path.join(destination, 'events.jsonl'), [...metadata, ...requests].map(event => JSON.stringify(event)).join('\n') + '\n');
  const labelFile=path.join(destination,'request-labels.jsonl');
  fs.writeFileSync(labelFile,records.map(r=>JSON.stringify(r)+'\n').join(''));
  const profiles = path.join(source, 'fingerprint-profiles.json');
  if(context.profiles) writeJSON(path.join(destination,'fingerprint-profiles.json'),context.profiles);
  else if (fs.existsSync(profiles)) fs.copyFileSync(profiles, path.join(destination, 'fingerprint-profiles.json'));
  const labels=new Map(records.map(r=>[r.request_id,r])),windowLabels={};
  for(let t=Date.parse(startedAt),i=0;t<Date.parse(endedAt);t+=5000,i++) {
    const observed=requests.filter(r=>Date.parse(r.started_at)>=t&&Date.parse(r.started_at)<t+5000).map(r=>labels.get(r.request_id)).filter(Boolean);
    windowLabels[i]=trustworthy?labelFor(observed,scenario):null;
  }
  writeJSON(path.join(destination, 'manifest.json'), {
    schema_version: VERSION,
    session_id: sessionId,
    source_gateway_session_id: path.basename(path.dirname(source)),
    split_group_id: path.basename(path.dirname(source)),
    started_at: startedAt,
    state: 'closed',
    window_label: trustworthy ? labelFor(records,scenario) : null,
    window_labels:windowLabels,
    requested_scenario: scenario,
    data_quality: trustworthy ? 'joined' : 'incomplete',
    label_source: 'generator_ground_truth',
    events_sha256:createHash('sha256').update(fs.readFileSync(path.join(destination,'events.jsonl'))).digest('hex'),
    ground_truth_sha256:createHash('sha256').update(fs.readFileSync(labelFile)).digest('hex'),
    profiles_sha256:fs.existsSync(path.join(destination,'fingerprint-profiles.json'))?createHash('sha256').update(fs.readFileSync(path.join(destination,'fingerprint-profiles.json'))).digest('hex'):null,
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
  let browser, profiles, state = 'starting', failure = null;
  let startedAt, endedAt, skipped = 0;
  const manifest = {
    id, options, source_gateway_session_id: liveLock.sessionId,
    split_group_id: liveLock.sessionId,
    purpose: 'bounded_scenario_pilot', engine: options.engine,
    limitations: ['source aliases are real loopback endpoints, not distributed Internet users',
      'scenario labels express controlled workload roles, not proven saturation', 'Markov fitted later from Normal training groups only'],
  };
  const emergency = setTimeout(() => { interrupted = true; browser?.close().catch(() => {}); }, (options.seconds + 60) * 1000);
  let monitor;
  try {
    if(options.engine!=='node') browser = await chromium.launch({
      channel: 'chrome', headless: true, timeout: 20000,
      args: ['--ignore-certificate-errors-spki-list=' + liveReport.browserSPKI,
        '--disable-background-networking'],
    });
    const html=await(await fetch(origin+'/dashboard',{signal:AbortSignal.timeout(4000)})).text();
    const meta=name=>html.match(new RegExp('<meta[^>]*name="'+name+'"[^>]*content="([^"]*)"'))?.[1];
    const settings={gateway:meta('dacn2-gateway'),token:meta('dacn2-session'),ids:meta('dacn2-fixtures')};
    if(settings.gateway!==gateway||!/^[a-f0-9]{64}$/.test(settings.token??''))throw Error('Invalid local configuration');
    const ca=fs.readFileSync(path.join(liveDirectory,'tls/cert.pem'));
    const calibration=[];
    for (const role of ['human', 'bot']) {
      for (let index = 0; index < options[role]; index++) {
        const ids = (settings.ids || '').split(',');
        if (!ids.length || ids.some(value => !/^[1-9][0-9]*$/.test(value))) throw Error('Invalid fixture IDs');
        const engine=options.engine==='mixed'?(index%2?'node':'chrome'):options.engine;
        const localAddress='127.0.0.'+(10+(options.seed*4+clients.length)%128);
        const client={role,id:role+'-'+index,engine,settings,course:ids[index%Math.min(2,ids.length)],busy:false,next:0,actions:0};
        clients.push(client);
        if(engine==='node') {
          const transport=await nodeClient({localAddress,ca,token:settings.token});
          client.send=transport.send; client.close=transport.close;
        } else {
          const proxy=await sourceProxy(localAddress); client.close=()=>proxy.close();
          const context=await browser.newContext({proxy:{server:proxy.url,bypass:'<-loopback>'}});
          const page=await context.newPage();
          // Minimal controlled browser harness: no unrelated React requests/SSE.
          await page.route(origin+'/generator-client',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>DACN2 traffic client</title>'}));
          await page.goto(origin+'/generator-client',{waitUntil:'domcontentloaded',timeout:10000});
          client.send=(route,body)=>page.evaluate(async({target,token,body})=>{
            const response=await fetch(target,{method:body?'POST':'GET',headers:{'X-DACN2-Session':token,...(body?{'Content-Type':'application/json'}:{})},
              body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(4000),cache:'no-store',credentials:'omit',redirect:'error'});
            await response.arrayBuffer();
            return {status:response.status,request_id:response.headers.get('X-Request-ID'),connection_id:response.headers.get('X-DACN2-Connection-ID'),protocol:response.headers.get('X-DACN2-Protocol')};
          },{target:gateway+route,token:settings.token,body});
        }
        // Send the first HEADERS promptly: the bounded fingerprint observer has
        // a 2-second deadline and must not wait for other browsers to start.
        calibration.push({client,result:await client.send('/courses')});
      }
    }
    // Calibrate known installed client stacks BEFORE the scenario starts. Expected
    // families come from the controlled transport, never from an attack's UA.
    let baseline=[];
    const calibrationDeadline=performance.now()+2000;
    while(performance.now()<calibrationDeadline) {
      baseline=fs.readFileSync(path.join(liveDirectory,'dataset/events.jsonl'),'utf8').split('\n').filter(Boolean).map(JSON.parse);
      if(calibration.every(({result})=>baseline.some(e=>e.event==='gateway_request'&&e.request_id===result.request_id)))break;
      await delay(50);
    }
    const entries=[];
    for(const {client,result} of calibration) {
      const request=baseline.find(e=>e.event==='gateway_request'&&e.request_id===result.request_id);
      const tls=baseline.find(e=>e.event==='gateway_tls'&&e.connection_id===request?.connection_id);
      const h2=baseline.find(e=>e.event==='gateway_h2'&&e.connection_id===request?.connection_id);
      if(!tls?.ja4||!h2?.akamai?.md5)throw Error(`Client ${client.engine} calibration missing ${!request?'request':!tls?'TLS':h2?.akamai_reason??h2?.reason??'H2'} (status ${result.status})`);
      const key=tls.ja4+'|'+h2.akamai.md5;
      let entry=entries.find(e=>e.key===key);
      if(!entry){entry={key,ja4:tls.ja4,akamai_md5:h2.akamai.md5,ua_families:[]};entries.push(entry);}
      const family=client.engine==='node'?'node':'chromium';
      if(!entry.ua_families.includes(family))entry.ua_families.push(family);
    }
    profiles={version:'controlled-clients-v2',kind:'pre_scenario_controlled_calibration',calibrated_at:new Date().toISOString(),
      engines:{node:process.versions.node,chrome:browser?.version()??null},entries:entries.map(({key,...entry})=>entry)};
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
      // Vary cached/API visits and asset-fetching crawlers across seeds so a
      // single static-resource pattern does not uniquely determine the label.
      const fullFlow=['/lab/page','/lab/assets/app.css','/lab/assets/app.js','/lab/assets/icon.svg','/courses','/courses/'+client.course,'/courses/'+client.course+'/registrations'];
      const flow=options.seed%3===1?['/courses','/courses/'+client.course,fullFlow.at(-1)]:fullFlow;
      const registration = client.role === 'human' && action % flow.length === flow.length-1;
      const route = client.role==='human'?flow[action%flow.length]+(action%flow.length===4?'?view=list':''):
        (options.seed%3===0?fullFlow[action%(fullFlow.length-1)]:action%8===7?'/lab/page':'/courses?nonce='+Math.floor(rng()*1000000));
      const started = new Date().toISOString();
      let result;
      try {
        result = await client.send(route,registration?{studentCode:'G_'+id.slice(-8)+'_'+client.id+'_'+action}:undefined,
          client.role==='bot'&&action%3===0);
      } catch {
        result = { status: null, request_id: null, error: 'request_failed_or_timeout' };
      }
      const record = { generator_session_id: id, client_id: client.id,engine:client.engine,
        ground_truth: client.role === 'human' ? 'legitimate' : 'attack',
        started_at: started, completed_at: new Date().toISOString(),
        method: registration ? 'POST' : 'GET',
        route: registration ? '/courses/:id/registrations' : route.split('?')[0], ...result };
      records.push(record);
      fs.appendFileSync(path.join(out, 'ground-truth.jsonl'), JSON.stringify(record) + '\n');
      client.busy = false;
      client.next = performance.now() + (client.role === 'human' ? (client.engine==='chrome'?500:800) + Math.floor(rng() * 1000) : 0);
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
    failure = error.code === 'ENOENT' ? 'Required local file missing' : String(error.message).replace(/[a-f0-9]{64}/g,'[redacted]').slice(0,1000);
  } finally {
    clearTimeout(emergency);
    clearInterval(monitor);
    await browser?.close().catch(() => {});
    for(const client of clients) await client.close?.();
    endedAt ||= new Date().toISOString();
    let dataset;
    if (startedAt) {
      await delay(300);
      try {
        dataset = await exportDataset(path.join(liveDirectory, 'dataset'), path.join(out, 'dataset'),
          records, startedAt, endedAt, options.scenario, id,{state,profiles});
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
