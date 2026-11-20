const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {labelFor,assignGroups,fitMarkov,validWindow,quality,prepareTraining,writeTrainingPartitions,CLASSES}=require('../lib/training-data.cjs');
const {FEATURES}=require('../lib/feature-window.cjs');
const {parse}=require('../collect-dataset.cjs');
const human=id=>({request_id:id,status:200,ground_truth:'legitimate',client_id:id,engine:'chrome'});
test('batch collection needs explicit bounded sessions/duration and refuses arbitrary flags',()=>{
  assert.equal(parse(['--sessions=25','--seconds=180']).sessions,25);
  for(const args of [[],['--sessions=31','--seconds=10'],['--sessions=1','--seconds=301'],['--sessions=1','--seconds=20','--target=https://example.com']]) assert.throws(()=>parse(args));
});
test('labels require actual role evidence and mixed windows need both roles',()=>{
  assert.equal(labelFor([human('a')],'Mixed_Traffic'),null);
  assert.equal(labelFor([human('a')],'Flash_Crowd'),null);
  assert.equal(labelFor([human('a'),human('b')],'Flash_Crowd'),'Flash_Crowd');
  assert.equal(labelFor([human('a'),{...human('b'),ground_truth:'attack'}],'Mixed_Traffic'),'Mixed_Traffic');
  assert.equal(labelFor([{...human('a'),status:null}],'Normal'),null);
});
test('group splitting keeps shared Gateway sessions together and fits Markov only from Normal train groups',()=>{
  const sessions=[];
  for(let i=0;i<10;i++) for(const label of ['Normal','Mixed_Traffic'])sessions.push({group:'gateway'+i,
    manifest:{session_id:label+i,window_label:label},labels:[],events:[
      {event:'gateway_request',request_id:'a',started_at:'2026-11-08T00:00:00Z',client_ip:'127.0.0.2',route:'/courses',method:'GET'},
      {event:'gateway_request',request_id:'b',started_at:'2026-11-08T00:00:01Z',client_ip:'127.0.0.2',route:'/lab/page',method:'GET'}]});
  const split=assignGroups(sessions),reference=fitMarkov(sessions,split);
  assert.deepEqual(new Set(split.values()),new Set(['train','validation','test']));
  assert.ok(reference.train_session_ids.every(id=>id.startsWith('Normal')));
  assert.ok(reference.train_group_ids.every(group=>split.get(group)==='train'));
  for(const row of Object.values(reference.transitions))assert.ok(Math.abs(Object.values(row).reduce((a,b)=>a+b,0)-1)<1e-12);
  const changed=sessions.map(s=>split.get(s.group)==='train'?s:{...s,events:[]});
  assert.deepEqual(fitMarkov(changed,split),reference,'holdout must not affect fitted reference');
});
test('quality rejects empty/partial, missing labels/features and insufficient corpus instead of filling zeros',()=>{
  assert.equal(validWindow({schema_version:'traffic-window.v1'}),false);
  assert.equal(validWindow({schema_version:'traffic-window.v2',window_status:'empty',window_label:'Normal'}),false);
  const report=quality([],[],new Map());
  assert.equal(report.ready,false);
  assert.ok(report.issues.some(s=>s.includes('25')));
  assert.ok(report.issues.some(s=>s.includes('2400')));
});
test('preparation refuses old unlabelled files and never emits training X on failure',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dacn2-train-'));
  try {
    const input=path.join(dir,'input'),dataset=path.join(input,'old','dataset');fs.mkdirSync(dataset,{recursive:true});
    fs.writeFileSync(path.join(dataset,'manifest.json'),JSON.stringify({schema_version:'traffic-window.v1'}));
    const output=path.join(dir,'output');
    const report=await prepareTraining(input,output);
    assert.equal(report.ready,false);assert.match(report.rejected_sources[0].reason,/v1/);
    assert.ok(!fs.existsSync(path.join(output,'train-X.csv')));
    assert.ok(fs.existsSync(path.join(output,'quality-report.json')));
    assert.ok(fs.existsSync(path.join(output,'dataset-diagnostics.json')));
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('readiness accepts a fully covered policy fixture but rejects constant features or inadequate browser coverage',()=>{
  const sessions=[],rows=[];
  for(let group=0;group<25;group++)for(const label of CLASSES){
    sessions.push({group:'g'+group,manifest:{window_label:label},events:[{event:'gateway_request',client_ip:'127.0.0.2'},{event:'gateway_request',client_ip:'127.0.0.3'}],
      labels:[human('a'),{...human('b'),engine:'node'}]});
    for(let i=0;i<24;i++)rows.push({window_label:label,split_group_id:'g'+group,...Object.fromEntries(FEATURES.map(key=>[key,key==='l_markov'?-(i%2+1):i%2]))});
  }
  const split=assignGroups(sessions);
  assert.equal(quality(rows,sessions,split).ready,true);
  assert.equal(quality(rows.map(r=>({...r,h_query:0})),sessions,split).ready,false);
  const onlyNode=sessions.map(s=>({...s,labels:s.labels.map(r=>({...r,engine:'node'}))}));
  assert.equal(quality(rows,onlyNode,split).ready,false);
});
test('training X excludes labels, IDs and ground truth; y and groups stay row-aligned',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dacn2-matrix-'));
  try {
    const rows=CLASSES.map((label,i)=>({window_label:label,session_id:'private'+i,split_group_id:'group'+i,
      window_start:'2026-11-08T00:00:00Z',engine:'node',ground_truth:'attack',...Object.fromEntries(FEATURES.map(k=>[k,i]))}));
    writeTrainingPartitions(dir,rows,new Map(rows.map(r=>[r.split_group_id,'train'])));
    const x=fs.readFileSync(path.join(dir,'train-X.csv'),'utf8');
    assert.equal(x.split('\n')[0],FEATURES.join(','));assert.doesNotMatch(x,/private|ground_truth|window_label|engine/);
    assert.deepEqual(fs.readFileSync(path.join(dir,'train-y.csv'),'utf8').trim().split('\n'),['target','0','1','2','3']);
    const groups=fs.readFileSync(path.join(dir,'train-groups.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(groups.length,rows.length);assert.equal(groups[2].session_id,'private2');
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
