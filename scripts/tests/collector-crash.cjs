'use strict';
// Process-termination recovery proof, entirely file-based and independent of Live/DB.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const {createCollector,replay} = require('../lib/feature-window.cjs');

async function worker(directory) {
  const collector = createCollector(directory,'crash-fixture');
  const manifest = JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
  const start = Date.parse(manifest.started_at);
  const event = {
    event:'gateway_request',request_id:'first',started_at:manifest.started_at,
    client_ip:'192.0.2.1',connection_id:1,protocol:'HTTP/1.1',
    route:'/courses',method:'GET',query_group:'none',is_static:false,
    upstream_headers_ms:5,
  };
  collector.ingest(JSON.stringify(event)+'\n');
  await new Promise(resolve=>setTimeout(resolve,20));
  await collector.flush();
  collector.ingest(JSON.stringify({...event,request_id:'second',
    started_at:new Date(start+1).toISOString()})+'\n');
  fs.appendFileSync(path.join(directory,'events.jsonl'),'{"event":"gateway_request"');
  process.send({ready:true});
  setInterval(()=>{},1000);
}

async function main() {
  const directory = path.resolve(__dirname,'../../.local-backups/m2/crash-'+Date.now());
  const child=spawn(process.execPath,[__filename,'--worker',directory],{
    windowsHide:true,stdio:['ignore','pipe','pipe','ipc'],
  });
  const closed=once(child,'close');
  let errorText='';
  child.stderr.on('data',chunk=>{errorText+=chunk.toString().slice(0,4096);});
  const deadline=setTimeout(()=>child.kill('SIGKILL'),10000);
  try {
    await new Promise((resolve,reject)=>{
      child.once('message',resolve);
      child.once('error',reject);
      child.once('exit',()=>reject(Error('Crash worker exited before ready: '+errorText)));
    });
    const before=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
    assert.equal(before.state,'recording');
    child.kill('SIGKILL');
    await closed;
    const end=new Date(Date.parse(before.started_at)+5000).toISOString();
    const recovered=await replay(directory,end);
    const csv=fs.readFileSync(path.join(directory,'windows.csv'),'utf8');
    assert.equal(recovered.rows,1);
    assert.equal(recovered.malformed_lines,1);
    assert.match(csv,/""requests"":2/);
    assert.notEqual(recovered.csv_sha256,before.csv_sha256);
    const repeated=await replay(directory,end);
    assert.equal(repeated.csv_sha256,recovered.csv_sha256);
    const result={pass:true,directory,requestsRecovered:2,damagedTailLines:1,
      replayStable:true,recoveredHash:recovered.csv_sha256};
    fs.writeFileSync(path.join(directory,'recovery-result.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
  } finally {
    clearTimeout(deadline);
    child.kill('SIGKILL');
    await closed;
  }
}
if(process.argv[2]==='--worker') {
  worker(process.argv[3]).catch(error=>{console.error(error);process.exit(1);});
} else {
  main().catch(error=>{console.error(error);process.exitCode=1;});
}
