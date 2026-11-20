'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {scenarios,parseOptions,validateSession,seededRandom,clientPlans,nextAction,nextDelay,scenarioOrder} = require('../lib/traffic-plan.cjs');
const {exportDataset} = require('../generate-traffic.cjs');

test('scenario plans cap time/load and reject arbitrary target/duplicate options',()=>{
  for(const scenario of Object.keys(scenarios)) {
    const plan = parseOptions([scenario,'--seconds=5','--seed=7']);
    assert.ok(plan.human + plan.bot <= 4);
    assert.equal(plan.seconds,5);
  }
  for(const flags of [['Normal','--rps=21'],['Mixed_Traffic','--seconds=301'],
    ['Normal','--target=https://example.com'],['Normal','--seed=0'],
    ['Normal','--seconds=5','--seconds=10'],['unknown']]) {
    assert.throws(()=>parseOptions(flags));
  }
  const a=seededRandom(7),b=seededRandom(7);
  assert.deepEqual([a(),a(),a()],[b(),b(),b()]);
});
test('refuse main database, stale session, missing traffic mode and stopped runner',()=>{
  const lock={sessionId:'123'};
  const report={sessionId:'123',database:'dacn2_test',persistent:false,trafficLab:true,readyAt:'now'};
  const snapshot={sessionId:'123',database:'dacn2_test'};
  assert.doesNotThrow(()=>validateSession(lock,report,snapshot));
  for(const changed of [{database:'dacn2'},{trafficLab:false},{cleanup:true},{sessionId:'124'}]) {
    assert.throws(()=>validateSession(lock,{...report,...changed},snapshot));
  }
  assert.throws(()=>validateSession(lock,report,{...snapshot,database:'dacn2'}));
});

test('populations and rates overlap across classes, both engines run in every class, and seeds reproduce profiles',()=>{
  const summaries = {};
  for (const scenario of Object.keys(scenarios)) {
    const populations = new Set(), rates = new Set(), styles = new Set();
    for (let seed = 1; seed <= 100; seed++) {
      const options = parseOptions([scenario, '--seed=' + seed]);
      const clients = clientPlans(options);
      assert.deepEqual(clients, clientPlans(options));
      assert.ok(clients.length >= 3 && clients.length <= 4);
      assert.deepEqual(new Set(clients.map(c => c.engine)), new Set(['chrome', 'node']));
      const humans = clients.filter(c => c.role === 'human');
      assert.ok(humans.filter(c => c.engine === 'chrome').length >= humans.length / 2);
      assert.equal(clients.filter(c => c.role === 'bot').length, options.bot);
      populations.add(clients.length); rates.add(options.rps);
      clients.forEach(c => styles.add(c.style));
    }
    assert.deepEqual(populations, new Set([3, 4]));
    assert.equal(styles.size, 3);
    summaries[scenario] = rates;
  }
  const common = [...summaries.Normal].filter(rate => Object.values(summaries).every(rates => rates.has(rate)));
  assert.ok(common.length >= 3, 'class rates must overlap');
  assert.equal(parseOptions(['Normal', '--rps=20']).rps, 20);
  const orders = new Set(Array.from({length:30}, (_, i) => scenarioOrder(i + 1).join(',')));
  assert.ok(orders.size > 1, 'class must not always occupy the same warmup position');
  assert.deepEqual(new Set(scenarioOrder(1)), new Set(Object.keys(scenarios)));
});

test('both roles can use every route type, query, registration, UA override and nonzero variable pauses',()=>{
  const base = clientPlans(parseOptions(['Normal', '--seed=42']))[0];
  const samples = [];
  for (const role of ['human', 'bot']) {
    const client = {...base, role};
    const rng = seededRandom(99), actions = [], delays = [];
    for (let i = 0; i < 2000; i++) {
      actions.push(nextAction(client, ['1', '2', '3'], rng));
      delays.push(nextDelay(client, rng));
    }
    assert.ok(actions.some(a => a.registration));
    assert.ok(actions.some(a => a.route.includes('/lab/assets/')));
    assert.ok(actions.some(a => a.route.includes('?nonce=')));
    assert.ok(actions.some(a => a.route.includes('?view=')));
    assert.ok(actions.some(a => a.spoof) && actions.some(a => !a.spoof));
    assert.ok(delays.every(n => n > 0));
    assert.ok(new Set(delays).size > 10);
    samples.push(actions);
  }
  assert.deepEqual(samples[0], samples[1], 'the same workflow profile must not choose routes or UA from the role label');
});
test('export labels only attributed requests; missing IDs invalidate label and secrets stay out',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dacn2-traffic-'));
  try {
    const source=path.join(dir,'source');
    fs.mkdirSync(source);
    const start='2026-11-06T00:00:00.000Z',end='2026-11-06T00:00:05.000Z';
    const event={schema_version:2,event:'gateway_request',request_id:'owned',connection_id:1,
      started_at:start,method:'GET',route:'/courses',client_ip:'127.0.0.1',protocol:'HTTP/2.0'};
    fs.writeFileSync(path.join(source,'events.jsonl'),[event,{...event,request_id:'foreign'}].map(JSON.stringify).join('\n'));
    const result=await exportDataset(source,path.join(dir,'complete'),[{request_id:'owned',status:200,ground_truth:'legitimate',client_id:'human1',engine:'chrome'}],start,end,'Normal','generator1',{state:'completed',generator_version:'traffic-behavior.v3'});
    assert.equal(result.window_label,'Normal');
    assert.equal(result.generator_version,'traffic-behavior.v3');
    assert.equal(result.selected_request_count,1);
    assert.equal(fs.readFileSync(path.join(dir,'complete/events.jsonl'),'utf8').includes('foreign'),false);
    const bad=await exportDataset(source,path.join(dir,'incomplete'),[{request_id:null}],start,end,'Mixed_Traffic','generator2');
    assert.equal(bad.window_label,null);
    assert.equal(bad.data_quality,'incomplete');
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
