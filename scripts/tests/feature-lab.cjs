'use strict';
// Explicitly bounded, loopback-only integration proof; no database is involved.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const http2 = require('node:http2');
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const {setTimeout:delay} = require('node:timers/promises');
const {runCommand} = require('../lib/lab-command.cjs');
const {createCollector,summarize} = require('../lib/feature-window.cjs');
const root=path.resolve(__dirname,'../..');
async function main() {
  const id='feature-lab-'+Date.now();
  const out=path.join(root,'.local-backups/m2',id);
  fs.mkdirSync(out,{recursive:true});
  let gateway, client, upstream, collector;
  const emergency=setTimeout(()=>gateway?.kill(),30000);
  try {
    await runCommand('go',['run','./scripts/team-cert/main.go','-out',out],{cwd:root,timeout:90000});
    const binary=path.join(out,'gateway.exe');
    await runCommand('go',['build','-o',binary,'.'],{cwd:path.join(root,'gateway'),timeout:90000});
    upstream=http.createServer((req,res)=>{
      setTimeout(()=>{
        res.setHeader('Content-Type',req.url.endsWith('.css')?'text/css':'application/json');
        res.end(req.url.endsWith('.css')?'body{}':'{}');
      },30);
    });
    upstream.listen(0,'127.0.0.1');
    await once(upstream,'listening');
    const reservation = require('node:net').createServer();
    reservation.listen(0,'127.0.0.1');
    await once(reservation,'listening');
    const port=reservation.address().port;
    await new Promise(resolve=>reservation.close(resolve));
    collector=createCollector(path.join(out,'dataset'),id);
    const env={...process.env,DACN2_LISTEN_ADDR:'127.0.0.1:'+port,
      DACN2_UPSTREAM_URL:'http://127.0.0.1:'+upstream.address().port,
      DACN2_BROWSER_ORIGIN:'',DACN2_BROWSER_TOKEN:'',DACN2_BROWSER_COURSE_IDS:'',
      DACN2_NETWORK_MODE:''};
    delete env.DACN2_TLS_KEYLOG;
    gateway=spawn(binary,[],{cwd:out,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
    const closed=once(gateway,'close');
    gateway.stdout.on('data',data=>{
      fs.appendFileSync(path.join(out,'gateway.jsonl'),data);
      collector.ingest(data);
    });
    gateway.stderr.on('data',data=>fs.appendFileSync(path.join(out,'gateway.stderr.log'),data));
    const ca=fs.readFileSync(path.join(out,'cert.pem'));
    let ready=false;
    for(let i=0;i<40;i++) {
      try {
        await new Promise((resolve,reject)=>{
          https.get({hostname:'127.0.0.1',port,path:'/gateway/health',ca},res=>{res.resume();res.on('end',resolve);}).on('error',reject);
        });
        ready=true;break;
      } catch {await delay(100);}
    }
    assert.equal(ready,true);
    client=http2.connect('https://127.0.0.1:'+port,{ca,servername:'localhost',localAddress:'127.0.0.1'});
    await once(client,'connect');
    const streamIds=[];
    async function send(route) {
      await new Promise((resolve,reject)=>{
        const request=client.request({':path':route,'user-agent':'DACN2 verification client'});
        request.on('response',headers=>{
          streamIds.push(request.id);
          assert.equal(headers[':status'],200);
        });
        request.on('data',()=>{});
        request.on('end',resolve);
        request.on('error',reject);
        request.end();
      });
    }
    for(let i=0;i<6;i++) await send(i%2?'/courses?view=list':'/courses');
    await Promise.all(['/asset.css','/courses/1','/courses?view=grid','/courses'].map(send));
    const agent=new https.Agent({ca,keepAlive:true,localAddress:'127.0.0.2'});
    try {
      for(let i=0;i<2;i++) await new Promise((resolve,reject)=>{
        https.get({hostname:'127.0.0.1',port,path:'/courses',agent},res=>{res.resume();res.on('end',resolve);}).on('error',reject);
      });
    } finally {agent.destroy();}
    client.close();
    await delay(100);
    gateway.kill();
    await closed;
    const manifest=await collector.close();
    const events=fs.readFileSync(path.join(out,'dataset/events.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
    const requests=events.filter(e=>e.event==='gateway_request'&&e.route!='/gateway/health');
    const h2requests=requests.filter(e=>e.protocol==='HTTP/2.0');
    assert.equal(requests.length,12);
    assert.equal(h2requests.length,10);
    assert.equal(new Set(streamIds).size,10);
    assert.equal(new Set(h2requests.map(e=>e.connection_id)).size,1);
    assert.equal(new Set(requests.map(e=>e.client_ip)).size,2);
    const features=summarize(requests,new Map(events.filter(e=>e.event==='gateway_tls').map(e=>[e.connection_id,e])));
    assert.equal(features.values.s_mux,10);
    assert.equal(features.values.r_static,1/12);
    assert.ok(features.values.h_query>0);
    assert.ok(features.values.h_ip>0);
    assert.ok(features.values.t_up>=20);
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:true,session:id,requests:12,h2:10,streamIds,values:features.values,manifest},null,2));
    console.log(JSON.stringify({pass:true,out,requests:12,h2:10,streams:streamIds.length}));
  } finally {
    clearTimeout(emergency);
    client?.destroy();
    gateway?.kill();
    if(upstream) await new Promise(resolve=>upstream.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
