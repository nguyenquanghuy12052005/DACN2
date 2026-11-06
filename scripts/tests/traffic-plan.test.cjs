'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {scenarios,parseOptions,validateSession,seededRandom} = require('../lib/traffic-plan.cjs');
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
test('export labels only attributed requests; missing IDs invalidate label and secrets stay out',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dacn2-traffic-'));
  try {
    const source=path.join(dir,'source');
    fs.mkdirSync(source);
    const start='2026-11-06T00:00:00.000Z',end='2026-11-06T00:00:05.000Z';
    const event={event:'gateway_request',request_id:'owned',connection_id:1,
      started_at:start,method:'GET',route:'/courses',client_ip:'127.0.0.1',protocol:'HTTP/2.0'};
    fs.writeFileSync(path.join(source,'events.jsonl'),[event,{...event,request_id:'foreign'}].map(JSON.stringify).join('\n'));
    const result=await exportDataset(source,path.join(dir,'complete'),[{request_id:'owned'}],start,end,'Normal','generator1');
    assert.equal(result.window_label,'Normal');
    assert.equal(result.selected_request_count,1);
    assert.equal(fs.readFileSync(path.join(dir,'complete/events.jsonl'),'utf8').includes('foreign'),false);
    const bad=await exportDataset(source,path.join(dir,'incomplete'),[{request_id:null}],start,end,'Mixed_Traffic','generator2');
    assert.equal(bad.window_label,null);
    assert.equal(bad.data_quality,'incomplete');
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
