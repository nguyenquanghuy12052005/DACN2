const {test} = require('node:test');
const assert = require('node:assert/strict');
const {summarize} = require('../lib/feature-window.cjs');
const at = ms => new Date(1700000000000+ms).toISOString();
const req = (id,time,connection=1) => ({request_id:id,started_at:at(time),connection_id:connection,
  client_ip:'127.0.0.2',route:'/courses',protocol:'HTTP/2.0',ua_family:'chromium',
  query_hash:'none',is_static:false,upstream_response_ms:200});

test('v2 uses request-weighted GREASE, exact query digests, seconds and peer sequences across reconnects',()=>{
  const requests=[req('a',0),req('b',200,2),req('c',400)];
  requests[1].query_hash='a'.repeat(64); requests[2].query_hash='b'.repeat(64);
  const result=summarize(requests,new Map([[1,{ja4:'a',has_grease:false}],[2,{ja4:'b',has_grease:true}]]),
    new Map(),null,new Map(),null,{streams:[{connection_id:1,stream_id:1,status:'opened'},
      {connection_id:2,stream_id:1,status:'opened'},{connection_id:1,stream_id:3,status:'opened'}]});
  assert.equal(result.values.r_no_grease,2/3);
  assert.equal(result.values.r_ip,.6);
  assert.equal(result.values.iat,.2);
  assert.ok(Math.abs(result.values.t_up-.2)<1e-12);
  assert.ok(Math.abs(result.values.h_query-Math.log2(3))<1e-10);
  assert.equal(result.values.s_mux,1.5);
});
test('v2 cannot silently substitute v1 query flags, headers latency or handled-request counts',()=>{
  const event=req('a',0); delete event.query_hash; delete event.upstream_response_ms;
  event.query_group='present'; event.upstream_headers_ms=5;
  const result=summarize([event],new Map());
  for(const feature of ['h_query','s_mux','t_up']) assert.equal(result.values[feature],null);
});
test('v2 stream capture errors withhold s_mux and unknown fingerprint mismatch stays missing',()=>{
  const result=summarize([req('a',0)],new Map(),new Map(),null,new Map(),{entries:[]},
    {streams:[{status:'opened',connection_id:1,stream_id:1},{status:'capacity',connection_id:1,stream_id:3}]});
  assert.equal(result.values.s_mux,null);
  assert.equal(result.coverage.h2_capture_errors,1);
  assert.equal(result.values.m_cross,null);
});
