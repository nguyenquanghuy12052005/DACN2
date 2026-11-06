'use strict';
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { createHash } = require('node:crypto');
const { isIP } = require('node:net');
const FEATURES = ['r_no_grease','rho_ja4','m_cross','s_mux','h_ip','h_uri','h_query','r_static','r_ip','iat','l_markov','t_up'];
const VERSION = 'traffic-window.v1';
const mean = values => values.length ? values.reduce((a,b) => a+b, 0)/values.length : null;
function entropy(values) {
  if (!values.length) return null;
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value)||0)+1);
  return [...counts.values()].reduce((sum,n) => sum-n/values.length*Math.log2(n/values.length),0);
}
function summarize(requests, tls, previous = new Map(), markov = null, h2Observations = new Map(), profiles = null) {
  const values = Object.fromEntries(FEATURES.map(key => [key,null]));
  const reasons = {};
  const ips = requests.filter(r => typeof r.client_ip === 'string' && isIP(r.client_ip));
  const connections = [...new Set(requests.map(r => r.connection_id).filter(id => id != null))];
  const captures = connections.map(id => tls.get(id)).filter(Boolean);
  const grease = captures.filter(e => typeof e.has_grease === 'boolean');
  values.r_no_grease = grease.length ? grease.filter(e => !e.has_grease).length/grease.length : null;
  const joined = ips.filter(r => tls.get(r.connection_id)?.ja4);
  values.rho_ja4 = joined.length ? new Set(joined.map(r => tls.get(r.connection_id).ja4)).size/new Set(joined.map(r => r.client_ip)).size : null;
  const comparisons = [];
  for (const request of requests) {
    if (!['chromium','firefox','safari'].includes(request.ua_family)) continue;
    const fingerprint = tls.get(request.connection_id);
    const observation = h2Observations.get(request.connection_id);
    const profile = observation?.status === 'headers_observed' && profiles?.entries?.find(entry =>
      entry.ja4 === fingerprint?.ja4 &&
      entry.akamai_md5 === observation?.akamai?.md5);
    if (profile) comparisons.push(profile.ua_families.includes(request.ua_family) ? 0 : 1);
  }
  values.m_cross = mean(comparisons);
  values.h_ip = entropy(ips.map(r => r.client_ip));
  values.h_uri = entropy(requests.map(r => r.route));
  const queries = requests.filter(r => typeof r.query_group === 'string');
  values.h_query = entropy(queries.map(r => r.query_group));
  const staticSamples = requests.filter(r => typeof r.is_static === 'boolean');
  values.r_static = staticSamples.length ? staticSamples.filter(r => r.is_static).length/staticSamples.length : null;
  values.r_ip = ips.length ? ips.length/new Set(ips.map(r => r.client_ip)).size : null;
  const h2 = requests.filter(r => r.protocol === 'HTTP/2.0' && r.connection_id != null);
  values.s_mux = h2.length ? h2.length/new Set(h2.map(r => r.connection_id)).size : null;
  const gaps = [], scores = [];
  for (const r of [...requests].sort((a,b) => Date.parse(a.started_at)-Date.parse(b.started_at) || a.request_id.localeCompare(b.request_id))) {
    if (r.connection_id == null) continue;
    const before = previous.get(r.connection_id);
    if (before) {
      gaps.push(Date.parse(r.started_at)-Date.parse(before.started_at));
      if (markov) {
        const probability = markov.transitions?.[before.route]?.[r.route] ?? markov.unseen_probability;
        if (!(probability > 0 && probability <= 1)) throw Error('Invalid Markov probability');
        scores.push(Math.log(probability));
      }
    }
    previous.set(r.connection_id,r);
  }
  values.iat = mean(gaps);
  values.l_markov = mean(scores);
  values.t_up = mean(requests.map(r => r.upstream_headers_ms).filter(v => Number.isFinite(v) && v >= 0));
  // Compatibility decisions require a separately validated, versioned rule set.
  for (const key of FEATURES) if (values[key] === null) reasons[key] =
    key === 'm_cross' ? (profiles ? 'no_known_fingerprint_ua_pair' : 'compatibility_rules_unavailable') :
    key === 'l_markov' && !markov ? 'markov_reference_unavailable' : 'no_eligible_observations';
  return {values,reasons,coverage:{requests:requests.length,ip:ips.length,tls:captures.length,grease:grease.length,connections:connections.length,query:queries.length,static:staticSamples.length,m_cross:comparisons.length,h2:h2.length,upstream:requests.filter(r => Number.isFinite(r.upstream_headers_ms)).length,intervals:gaps.length}};
}
function csvCell(value) {
  if (value == null) return '';
  const s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return '"' + s.replaceAll('"','""') + '"';
}
// Replay reads one bounded session, capped explicitly to avoid unbounded lab memory.
async function replay(directory, end, markov = null) {
  const manifestPath = path.join(directory,'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const markovPath = path.join(directory, 'markov-reference.json');
  if (!markov && fs.existsSync(markovPath)) markov = JSON.parse(fs.readFileSync(markovPath, 'utf8'));
  if (markov) {
    if (!markov.version || !['fixture','train_reference'].includes(markov.kind) ||
        !(markov.unseen_probability > 0 && markov.unseen_probability <= 1) ||
        !markov.transitions || typeof markov.transitions !== 'object') throw Error('Invalid versioned Markov reference');
    if (markov.kind === 'train_reference' && (!Array.isArray(markov.train_session_ids) ||
        !markov.train_session_ids.length ||
        (['validation','holdout'].includes(manifest.split_role) && markov.train_session_ids.includes(manifest.session_id)))) {
      throw Error('Invalid Markov split provenance');
    }
    for (const row of Object.values(markov.transitions)) {
      if (!row || typeof row !== 'object' || Object.values(row).some(p => !Number.isFinite(p) || p <= 0 || p > 1)) throw Error('Invalid Markov transition probability');
    }
  }
  const start = Date.parse(manifest.started_at);
  const finish = Date.parse(end);
  if (!Number.isFinite(start) || !Number.isFinite(finish) || finish < start || finish-start > 3600000) throw Error('Session must be between zero and one hour');
  const tls = new Map(), h2 = new Map(), windows = new Map(), seen = new Set();
  const profilePath = path.join(directory, 'fingerprint-profiles.json');
  const profiles = fs.existsSync(profilePath) ? JSON.parse(fs.readFileSync(profilePath, 'utf8')) : null;
  if (profiles && (!profiles.version || !Array.isArray(profiles.entries) ||
      profiles.entries.some(e => typeof e.ja4 !== 'string' || typeof e.akamai_md5 !== 'string' ||
        !Array.isArray(e.ua_families) || !e.ua_families.length))) throw Error('Invalid fingerprint profiles');
  let count = 0, duplicates = 0, truncated = 0, late = 0;
  if (fs.statSync(path.join(directory,'events.jsonl')).size > 128*1024*1024) throw Error('Session byte limit exceeded');
  const input = readline.createInterface({input:fs.createReadStream(path.join(directory,'events.jsonl')),crlfDelay:Infinity});
  for await (const line of input) {
    if (++count > 100000) throw Error('Session event limit exceeded');
    if (Buffer.byteLength(line) > 1048576) throw Error('Session line limit exceeded');
    let e;
    try { e = JSON.parse(line); } catch { truncated++; continue; }
    if (e.event === 'gateway_tls') { tls.set(e.connection_id,e); continue; }
    if (e.event === 'gateway_h2') { h2.set(e.connection_id,e); continue; }
    if (e.event !== 'gateway_request' || e.method === 'OPTIONS' || ['/health','/gateway/health'].includes(e.route)) continue;
    if (typeof e.request_id !== 'string' || typeof e.route !== 'string') { truncated++; continue; }
    if (seen.has(e.request_id)) { duplicates++; continue; }
    seen.add(e.request_id);
    const timestamp = Date.parse(e.started_at);
    if (!Number.isFinite(timestamp) || timestamp < start || timestamp >= finish) continue;
    const index = Math.floor((timestamp-start)/5000);
    if (Date.parse(e.completed_at) >= start+(index+1)*5000) late++;
    if (!windows.has(index)) windows.set(index,[]);
    windows.get(index).push(e);
  }
  const columns = ['schema_version','session_id','window_start','window_end',...FEATURES,'window_label','window_status','missing_reasons','coverage','source_log_ref'];
  const temporary = path.join(directory,'windows.csv.tmp');
  const fd = fs.openSync(temporary,'w');
  const previous = new Map();
  let rows = 0;
  try {
    fs.writeSync(fd,columns.join(',')+'\n');
    for (let t = start; t < finish; t += 5000) {
      const requests = windows.get(rows)||[];
      const result = summarize(requests,tls,previous,markov,h2,profiles);
      const row = [VERSION,manifest.session_id,new Date(t).toISOString(),new Date(Math.min(t+5000,finish)).toISOString(),...FEATURES.map(k => result.values[k]),manifest.window_label||'',t+5000>finish?'partial':requests.length?'complete':'empty',result.reasons,result.coverage,'events.jsonl'];
      fs.writeSync(fd,row.map(csvCell).join(',')+'\n');
      rows++;
    }
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  fs.renameSync(temporary,path.join(directory,'windows.csv'));
  Object.assign(manifest,{ended_at:end,rows,duplicates,late_completions:late,malformed_lines:truncated,markov_version:markov?.version||null,markov_kind:markov?.kind||null,profiles_version:profiles?.version||null,csv_sha256:createHash('sha256').update(fs.readFileSync(path.join(directory,'windows.csv'))).digest('hex')});
  atomicJSON(manifestPath,manifest);
  return manifest;
}
function atomicJSON(file,value) {
  const temporary = file+'.tmp';
  const fd = fs.openSync(temporary,'w');
  try {
    fs.writeSync(fd,JSON.stringify(value,null,2));
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  fs.renameSync(temporary,file);
}
function createCollector(directory,sessionId,options = {}) {
  if (options.label && !['Normal','Flash_Crowd','Pure_L7_DDoS','Mixed_Traffic'].includes(options.label)) throw Error('Invalid window label');
  fs.mkdirSync(directory,{recursive:true});
  if (fs.existsSync(path.join(directory,'manifest.json'))) throw Error('Refuse to overwrite an existing dataset session');
  atomicJSON(path.join(directory,'manifest.json'),{schema_version:VERSION,session_id:sessionId,started_at:new Date().toISOString(),window_label:options.label||null,label_source:options.label?'operator_declared':null,state:'recording'});
  fs.writeFileSync(path.join(directory,'events.jsonl'),'',{flag:'wx'});
  const profilesFile = path.join(__dirname, '../data/fingerprint-profiles.json');
  if (fs.existsSync(profilesFile)) fs.copyFileSync(profilesFile,path.join(directory,'fingerprint-profiles.json'));
  if (options.markovFile) fs.copyFileSync(options.markovFile,path.join(directory,'markov-reference.json'));
  let buffer = '', count = 0, pending = Promise.resolve(), closed = false;
  function flush() {
    const end = new Date().toISOString();
    pending = pending.then(() => replay(directory,end));
    return pending;
  }
  return {
    ingest(chunk) {
      if (closed) throw Error('Collector is closed');
      buffer += chunk.toString();
      if (buffer.length > 1048576) throw Error('Collector line limit exceeded');
      let split;
      while ((split=buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0,split); buffer=buffer.slice(split+1);
        let event;
        try { event=JSON.parse(line); } catch { continue; }
        if (!['gateway_request','gateway_tls','gateway_h2'].includes(event.event)) continue;
        if (++count > 100000) throw Error('Collector event limit exceeded');
        fs.appendFileSync(path.join(directory,'events.jsonl'),JSON.stringify(event)+'\n');
      }
    },
    flush,
    async close() {
      closed = true;
      const result = await flush();
      if (buffer.trim()) result.unterminated_bytes = Buffer.byteLength(buffer);
      result.state = 'closed';
      atomicJSON(path.join(directory,'manifest.json'),result);
      return result;
    }
  };
}
module.exports = {FEATURES,entropy,summarize,replay,createCollector};
