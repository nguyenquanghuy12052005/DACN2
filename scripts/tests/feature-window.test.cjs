const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {FEATURES,summarize,replay,createCollector} = require('../lib/feature-window.cjs');
const start = Date.parse('2026-11-06T00:00:00Z');
function request(id,ms,ip='192.0.2.1',route='/courses') {
  return {event:'gateway_request',request_id:id,started_at:new Date(start+ms).toISOString(),client_ip:ip,route,method:'GET',connection_id:1,protocol:'HTTP/2.0',query_group:'none',is_static:false,upstream_headers_ms:10};
}
test('hand-calculated IP, route, IAT, H2, GREASE and upstream values',()=>{
  const result = summarize([request('1',0),request('2',200,'192.0.2.2','/courses/:id')],new Map([[1,{ja4:'x',has_grease:true}]]));
  assert.equal(result.values.h_ip,1);
  assert.equal(result.values.h_uri,1);
  assert.equal(result.values.r_ip,1);
  assert.equal(result.values.iat,200);
  assert.equal(result.values.s_mux,2);
  assert.equal(result.values.r_no_grease,0);
  assert.equal(result.values.rho_ja4,.5);
  assert.equal(result.values.t_up,10);
  assert.equal(result.reasons.m_cross,'compatibility_rules_unavailable');
});
test('all twelve formulas including known mismatch, query/static mix and Markov',()=>{
  const events = [request('1',0),request('2',200,'192.0.2.2','/courses/:id')];
  Object.assign(events[0],{ua_family:'chromium'});
  Object.assign(events[1],{ua_family:'firefox',query_group:'present',is_static:true});
  const result = summarize(events,
    new Map([[1,{ja4:'verified',has_grease:true}]]),
    new Map(),{transitions:{},unseen_probability:.25},
    new Map([[1,{status:'headers_observed',akamai:{md5:'verified'}}]]),
    {entries:[{ja4:'verified',akamai_md5:'verified',ua_families:['chromium']}]});
  for(const key of FEATURES) assert.equal(typeof result.values[key],'number',key);
  assert.equal(result.values.m_cross,.5);
  assert.equal(result.values.h_query,1);
  assert.equal(result.values.r_static,.5);
  assert.equal(result.values.l_markov,Math.log(.25));
});
test('unknown UA/fingerprint remains unavailable; malformed IP excluded',()=>{
  const result = summarize([{...request('1',0,'invalid'),ua_family:'unknown'}],new Map(),new Map(),null,new Map(),{entries:[]});
  assert.equal(result.values.h_ip,null);
  assert.equal(result.values.m_cross,null);
  assert.equal(result.reasons.m_cross,'no_known_fingerprint_ua_pair');
});
test('fragmented collector, flush while recording, close, labels and overwrite refusal',async()=>{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'dacn2-feature-live-'));
  try {
    const collector = createCollector(dir,'fragmented',{label:'Normal'});
    const event = {...request('fragment',0),started_at:new Date().toISOString()};
    const line = JSON.stringify(event)+'\n';
    collector.ingest(line.slice(0,31));
    collector.ingest(line.slice(31));
    await new Promise(resolve=>setTimeout(resolve,10));
    await collector.flush();
    assert.equal(fs.existsSync(path.join(dir,'windows.csv')),true);
    const manifest = await collector.close();
    assert.equal(manifest.state,'closed');
    assert.equal(manifest.window_label,'Normal');
    assert.equal(manifest.rows,1);
    assert.throws(()=>collector.ingest(line),/closed/);
    assert.throws(()=>createCollector(dir,'again'),/overwrite/);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
test('late completion stays in start window and recovery revises CSV',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dacn2-feature-late-'));
  try {
    fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({session_id:'late',started_at:new Date(start).toISOString()}));
    fs.writeFileSync(path.join(dir,'events.jsonl'),'');
    const before=await replay(dir,new Date(start+10000).toISOString());
    const event={...request('late',4900),completed_at:new Date(start+9000).toISOString()};
    fs.appendFileSync(path.join(dir,'events.jsonl'),JSON.stringify(event)+'\n');
    const after=await replay(dir,new Date(start+10000).toISOString());
    assert.equal(after.late_completions,1);
    assert.notEqual(before.csv_sha256,after.csv_sha256);
    const rows=fs.readFileSync(path.join(dir,'windows.csv'),'utf8').trim().split('\n');
    assert.match(rows[1],/"complete"/);
    assert.match(rows[2],/"empty"/);
    const bad={version:'bad',kind:'train_reference',train_session_ids:['late'],transitions:{},unseen_probability:.1};
    fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({...after,split_role:'holdout'}));
    await assert.rejects(replay(dir,new Date(start+10000).toISOString(),bad),/split provenance/);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('missing observations stay null and valid zero stays zero',()=>{
  const empty = summarize([],new Map());
  for(const value of Object.values(empty.values)) assert.equal(value,null);
  assert.equal(summarize([request('1',0)],new Map()).values.h_ip,0);
});
test('Markov unknown transitions and intervals across windows',()=>{
  const previous = new Map();
  summarize([request('a',4900)],new Map(),previous);
  const result = summarize([request('b',5100,'a','/other')],new Map(),previous,{transitions:{},unseen_probability:.1});
  assert.equal(result.values.iat,200);
  assert.equal(result.values.l_markov,Math.log(.1));
});
test('replay handles duplicates, exact boundaries, partial windows and damaged log deterministically',async()=>{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'dacn2-feature-'));
  try {
    fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({session_id:'test',started_at:new Date(start).toISOString()}));
    fs.writeFileSync(path.join(dir,'events.jsonl'),[request('a',0),request('a',0),request('b',5000)].map(JSON.stringify).join('\n')+'\n{broken');
    const first = await replay(dir,new Date(start+6000).toISOString());
    const csv = fs.readFileSync(path.join(dir,'windows.csv'),'utf8');
    assert.equal(first.rows,2);
    assert.equal(first.duplicates,1);
    assert.equal(first.malformed_lines,1);
    assert.match(csv,/"partial"/);
    const second = await replay(dir,new Date(start+6000).toISOString());
    assert.equal(second.csv_sha256,first.csv_sha256);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
