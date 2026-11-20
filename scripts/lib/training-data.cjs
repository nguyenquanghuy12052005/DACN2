'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {FEATURES,VERSION,replay} = require('./feature-window.cjs');
const {diagnose} = require('./dataset-diagnostics.cjs');
const CLASSES = ['Normal','Flash_Crowd','Pure_L7_DDoS','Mixed_Traffic'];
const hash = data => createHash('sha256').update(data).digest('hex');
const readJSON = file => JSON.parse(fs.readFileSync(file,'utf8'));
function lines(file) {
  if (fs.statSync(file).size > 128*1024*1024) throw Error('Input exceeds 128 MiB');
  const rows = fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean);
  if (rows.length > 100000) throw Error('Input exceeds 100k events');
  return rows.map(row=>JSON.parse(row));
}
function labelFor(records, requested) {
  if (!records.length || !CLASSES.includes(requested) || records.some(r=>!r.request_id || r.status == null || !['legitimate','attack'].includes(r.ground_truth))) return null;
  const human = records.filter(r=>r.ground_truth==='legitimate');
  const bots = records.filter(r=>r.ground_truth==='attack');
  if (requested === 'Mixed_Traffic') return human.length && bots.length ? requested : null;
  if (requested === 'Pure_L7_DDoS') return !human.length && bots.length ? requested : null;
  if (requested === 'Flash_Crowd') return !bots.length && new Set(human.map(r=>r.client_id)).size>=2 ? requested : null;
  return !bots.length && human.length ? requested : null;
}
function assignGroups(sessions) {
  const groups = new Map();
  for (const s of sessions) {
    if (!groups.has(s.group)) groups.set(s.group,new Set());
    groups.get(s.group).add(s.manifest.window_label);
  }
  const strata = new Map(), split = new Map();
  for(const [group,labels] of groups) {
    const key=[...labels].sort().join('|');
    if(!strata.has(key)) strata.set(key,[]);
    strata.get(key).push(group);
  }
  for(const ids of strata.values()) {
    ids.sort((a,b)=>hash('split-v1:'+a).localeCompare(hash('split-v1:'+b)));
    const val=ids.length>=3?Math.max(1,Math.floor(ids.length*.2)):0;
    const test=val;
    ids.forEach((id,i)=>split.set(id,i<test?'test':i<test+val?'validation':'train'));
  }
  return split;
}
function fitMarkov(sessions, split) {
  const counts=new Map(), states=new Set(['__unknown__']), ids=[], groups=[];
  for(const session of sessions) {
    if(split.get(session.group)!=='train' || session.manifest.window_label!=='Normal') continue;
    ids.push(session.manifest.session_id); groups.push(session.group);
    const previous=new Map();
    for(const event of session.events.filter(e=>e.event==='gateway_request'&&e.method!=='OPTIONS'&&!['/health','/gateway/health'].includes(e.route))
      .sort((a,b)=>Date.parse(a.started_at)-Date.parse(b.started_at)||a.request_id.localeCompare(b.request_id))) {
      if (!require('node:net').isIP(event.client_ip??'')) continue;
      states.add(event.route);
      const before=previous.get(event.client_ip);
      if(before) { if(!counts.has(before)) counts.set(before,new Map()); const row=counts.get(before); row.set(event.route,(row.get(event.route)||0)+1); }
      previous.set(event.client_ip,event.route);
    }
  }
  if(!ids.length || !counts.size) throw Error('Need Normal training sessions with actual navigation transitions');
  const names=[...states].sort(), transitions={};
  for(const from of names) {
    const row=counts.get(from)||new Map(); const total=[...row.values()].reduce((a,b)=>a+b,0);
    transitions[from]=Object.fromEntries(names.map(to=>[to,((row.get(to)||0)+1)/(total+names.length)]));
  }
  return {version:'markov-laplace-v1',kind:'train_reference',train_session_ids:ids,
    train_group_ids:[...new Set(groups)],smoothing:1,transitions,unseen_probability:1/names.length};
}
function validWindow(row) {
  if(row.schema_version!==VERSION||row.window_status!=='complete'||!CLASSES.includes(row.window_label)) return false;
  if(!FEATURES.every(key=>typeof row[key]==='number'&&Number.isFinite(row[key]))) return false;
  if(['r_no_grease','m_cross','r_static'].some(key=>row[key]<0||row[key]>1)||row.l_markov>0||
    ['rho_ja4','s_mux','h_ip','h_uri','h_query','r_ip','iat','t_up'].some(key=>row[key]<0))return false;
  const c=row.coverage;
  if(!c)return false;
  if(['Flash_Crowd','Mixed_Traffic'].includes(row.window_label)&&c.unique_ips<2)return false;
  return c.requests>=2 && c.ip===c.requests && c.query===c.requests && c.static===c.requests &&
    c.grease===c.requests && c.m_cross===c.requests && c.h2_capture_errors===0 && c.h2_streams>0;
}
function quality(rows, sessions, split) {
  const issues=[];
  const groups=new Set(sessions.map(s=>s.group));
  if(groups.size<25) issues.push(`Need >=25 independent Gateway groups; found ${groups.size}`);
  if(rows.length<2400) issues.push(`Need >=2400 eligible 5-second windows; found ${rows.length}`);
  const distributions={};
  for(const label of CLASSES) {
    const selected=sessions.filter(s=>s.manifest.window_label===label);
    const engines=new Set(selected.flatMap(s=>s.labels.map(r=>r.engine).filter(Boolean)));
    const ips=new Set(selected.flatMap(s=>s.events.filter(e=>e.event==='gateway_request').map(e=>e.client_ip).filter(Boolean)));
    const legitimate=selected.flatMap(s=>s.labels.filter(r=>r.ground_truth==='legitimate'));
    const browserFraction=legitimate.length?legitimate.filter(r=>r.engine==='chrome').length/legitimate.length:null;
    distributions[label]={groups:new Set(selected.map(s=>s.group)).size,engines:[...engines],ips:ips.size,windows:rows.filter(r=>r.window_label===label).length,browser_legitimate_fraction:browserFraction};
    if(legitimate.length&&browserFraction<.5)issues.push(`${label}: real Chrome supplies <50% of legitimate requests`);
    if(engines.size<2) issues.push(`${label}: need >=2 real client engines across independent sessions`);
    if(ips.size<2) issues.push(`${label}: only ${ips.size} observed peer IPs`);
    for(const partition of ['train','validation','test']) {
      if(!rows.some(r=>r.window_label===label && split.get(r.split_group_id)===partition)) issues.push(`${partition}: no eligible ${label} windows`);
    }
  }
  const variation=Object.fromEntries(FEATURES.map(key=>[key,new Set(rows.map(r=>r[key])).size]));
  for(const key of FEATURES) if(variation[key]<2) issues.push(`${key}: constant or absent; collect meaningful variation`);
  return {ready:issues.length===0,issues,eligible_windows:rows.length,independent_groups:groups.size,distributions,variation,
    scope:'Controlled lab training eligibility only; not evidence of real-world generalization or target F1/FPR.',
    feature_order:FEATURES,units:{iat:'seconds',t_up:'seconds',r_ip:'requests/second/IP'}};
}
async function prepareTraining(input, output) {
  if(fs.existsSync(output)) throw Error('Output already exists; choose a new training directory');
  fs.mkdirSync(output,{recursive:true});
  const sessions=[], rejected=[], seen=new Set(), sessionIds=new Set();
  if(fs.existsSync(input)) for(const entry of fs.readdirSync(input,{withFileTypes:true}).filter(e=>e.isDirectory())) {
    const directory=path.join(input,entry.name,'dataset');
    try {
      const manifest=readJSON(path.join(directory,'manifest.json'));
      if(manifest.schema_version!==VERSION) throw Error('v1/unknown schema: recollect with v2; no silent conversion');
      if(manifest.state!=='closed'||manifest.data_quality!=='joined'||manifest.label_source!=='generator_ground_truth') throw Error('Need closed, joined, generator-labelled capture');
      if(!/^[a-zA-Z0-9_-]{1,100}$/.test(manifest.session_id)) throw Error('Invalid session ID');
      if(sessionIds.has(manifest.session_id))throw Error('Duplicate dataset session ID');
      const duration=Date.parse(manifest.ended_at)-Date.parse(manifest.started_at);
      if(!Number.isFinite(duration)||duration<=0||duration>3600000)throw Error('Invalid or oversized capture duration');
      const group=manifest.source_gateway_session_id;
      if(!/^[a-zA-Z0-9_-]{1,100}$/.test(group??'')||manifest.split_group_id!==group) throw Error('Missing/inconsistent Gateway split group');
      const raw=fs.readFileSync(path.join(directory,'events.jsonl'));
      const truth=fs.readFileSync(path.join(directory,'request-labels.jsonl'));
      if(hash(raw)!==manifest.events_sha256||hash(truth)!==manifest.ground_truth_sha256) throw Error('Source/ground-truth hash mismatch');
      const events=lines(path.join(directory,'events.jsonl')), labels=lines(path.join(directory,'request-labels.jsonl'));
      if(labelFor(labels,manifest.window_label)!==manifest.window_label) throw Error('Label disagrees with request ground truth');
      const requests=events.filter(e=>e.event==='gateway_request');
      const ids=new Set(requests.map(e=>e.request_id));
      if(ids.size!==requests.length || labels.length!==requests.length || labels.some(r=>!ids.has(r.request_id)) || new Set(labels.map(r=>r.request_id)).size!==labels.length) throw Error('Incomplete/duplicate attribution');
      if([...ids].some(id=>seen.has(id))) throw Error('Repeated source requests across dataset sessions');
      if(requests.some(e=>e.schema_version!==2)) throw Error('Need v2 raw Gateway measurements');
      const profilesFile=path.join(directory,'fingerprint-profiles.json');
      const profileBytes=fs.readFileSync(profilesFile),profiles=JSON.parse(profileBytes);
      if(manifest.profiles_sha256&&hash(profileBytes)!==manifest.profiles_sha256)throw Error('Fingerprint reference hash mismatch');
      if(profiles.kind!=='pre_scenario_controlled_calibration'||!Number.isFinite(Date.parse(profiles.calibrated_at))||
        Date.parse(profiles.calibrated_at)>Date.parse(manifest.started_at))throw Error('Need controlled fingerprint calibration before the scenario');
      for(const id of ids) seen.add(id);
      sessions.push({directory,manifest,group,events,labels});
      sessionIds.add(manifest.session_id);
    } catch(error) { rejected.push({session:entry.name,reason:error.message}); }
  }
  const split=assignGroups(sessions);
  let reference, rows=[];
  const rejectedWindows={},missingFeatures=Object.fromEntries(FEATURES.map(k=>[k,0]));
  let considered=0;
  try { reference=fitMarkov(sessions,split); } catch(error) { rejected.push({session:'markov',reason:error.message}); }
  if(reference) {
    fs.writeFileSync(path.join(output,'markov-reference.json'),JSON.stringify(reference,null,2));
    for(const session of sessions) {
      const staged=path.join(output,'sessions',session.manifest.session_id);
      fs.mkdirSync(staged,{recursive:true});
      fs.copyFileSync(path.join(session.directory,'events.jsonl'),path.join(staged,'events.jsonl'));
      const profiles=path.join(session.directory,'fingerprint-profiles.json');
      if(fs.existsSync(profiles)) fs.copyFileSync(profiles,path.join(staged,'fingerprint-profiles.json'));
      fs.writeFileSync(path.join(staged,'manifest.json'),JSON.stringify({...session.manifest,split_role:split.get(session.group)}));
      await replay(staged,session.manifest.ended_at,reference);
      const candidates=lines(path.join(staged,'windows.jsonl'));
      for(const row of candidates) {
        considered++;
        const truth=new Map(session.labels.map(r=>[r.request_id,r]));
        const labels=session.events.filter(r=>r.event==='gateway_request'&&Date.parse(r.started_at)>=Date.parse(row.window_start)&&Date.parse(r.started_at)<Date.parse(row.window_end)).map(r=>truth.get(r.request_id)).filter(Boolean);
        row.window_label=labelFor(labels,session.manifest.window_label);
        if(validWindow(row)) rows.push(row);
        else {
          const missing=FEATURES.filter(k=>!Number.isFinite(row[k]));
          const reason=row.window_status!=='complete'?row.window_status:!row.window_label?'unlabelled':missing.length?'missing_features':'coverage_or_range';
          rejectedWindows[reason]=(rejectedWindows[reason]||0)+1;
          for(const key of missing)missingFeatures[key]++;
        }
      }
    }
  }
  const report={...quality(rows,sessions,split),rejected_sources:rejected,
    feature_contract:VERSION,
    implementation_sha256:hash(fs.readFileSync(__filename)+'\n'+fs.readFileSync(path.join(__dirname,'feature-window.cjs'))),
    source_event_hashes:Object.fromEntries(sessions.map(s=>[s.manifest.session_id,s.manifest.events_sha256])),
    splits:Object.fromEntries(split),input_sessions:sessions.length,
    considered_windows:considered,rejected_windows:rejectedWindows,missing_feature_counts:missingFeatures};
  const diagnostics=diagnose(rows,sessions,split);
  fs.writeFileSync(path.join(output,'dataset-diagnostics.json'),JSON.stringify(diagnostics,null,2));
  report.ready_scope='Coverage, provenance and minimum corpus size; inspect dataset-diagnostics.json before training';
  report.warnings=[...(rejected.length?['Rejected source sessions are excluded; inspect rejected_sources and retain their audit files.']:[]),...diagnostics.warnings];
  fs.writeFileSync(path.join(output,'quality-report.json'),JSON.stringify(report,null,2));
  fs.writeFileSync(path.join(output,'schema.json'),JSON.stringify({schema_version:VERSION,
    feature_order:FEATURES,label_map:Object.fromEntries(CLASSES.map((name,id)=>[id,name])),units:report.units,
    split_group:'source_gateway_session_id',markov_fit:'Normal training groups only; refit separately inside each future CV fold'},null,2));
  if(report.ready) writeTrainingPartitions(output,rows,split);
  return report;
}
function writeTrainingPartitions(output,rows,split) {
  for(const partition of ['train','validation','test']) {
    const selected=rows.filter(r=>split.get(r.split_group_id)===partition);
    fs.writeFileSync(path.join(output,`${partition}-X.csv`),FEATURES.join(',')+'\n'+selected.map(r=>FEATURES.map(k=>r[k]).join(',')).join('\n')+'\n');
    fs.writeFileSync(path.join(output,`${partition}-y.csv`),'target\n'+selected.map(r=>CLASSES.indexOf(r.window_label)).join('\n')+'\n');
    fs.writeFileSync(path.join(output,`${partition}-groups.jsonl`),selected.map(r=>JSON.stringify({session_id:r.session_id,split_group_id:r.split_group_id,window_start:r.window_start})).join('\n')+'\n');
  }
}
module.exports={CLASSES,labelFor,assignGroups,fitMarkov,validWindow,quality,prepareTraining,writeTrainingPartitions};
