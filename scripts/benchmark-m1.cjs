// Bounded, fixed-target, read-only lab baseline. Ctrl+C requests cleanup.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const http = require('node:http'), https = require('node:https'), net = require('node:net');
const { X509Certificate } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { setTimeout: delay } = require('node:timers/promises');
const root = path.resolve(__dirname, '..');
const env = require(path.join(root, 'backend/node_modules/dotenv')).parse(fs.readFileSync(path.join(root, 'backend/.env')));
const { Client } = require(path.join(root, 'backend/node_modules/pg'));
const out = path.join(root, '.local-backups/m106', Date.now().toString()); fs.mkdirSync(out, { recursive: true });
const ca = fs.readFileSync(path.join(root, 'gateway/cert.pem')), fingerprint = new X509Certificate(ca).fingerprint256;
const tlsOptions = { ca, checkServerIdentity: (_, cert) => cert.fingerprint256 === fingerprint ? undefined : Error('Lab certificate mismatch') };
const kubeconfig = path.join(root, '.local-backups/m105e/1793364531571-resume-1793364615141/kubeconfig.yaml');
const kubectl = path.join(root, '.local-backups/tools/kubectl-v1.35.9.exe');
const targets = [
  { name: 'direct', port: 13000, protocol: http, agent: new http.Agent({ keepAlive: true, maxSockets: 32 }) },
  { name: 'gateway', port: 18443, protocol: https, agent: new https.Agent({ keepAlive: true, maxSockets: 32, ...tlsOptions }) }
];
const result = { task: 'M1-06', pass: false, limits: { maxRps: 400, maxInflight: 32, generatingSeconds: 180, rssMiB: 256 }, conditions: { p95Ms: 80, maxErrorRatio: .01, minSuccessfulSlotRatio: .95, headroom: .2 }, targets: [], memory: [] };
const began = performance.now(), activeRequests = new Set();
let interrupted, gateway, guard, emitStart, lastEmission, ownCluster = false;
process.on('SIGINT', () => { interrupted = 'Ctrl+C'; for (const req of activeRequests) req.destroy(Error('Stopped')); });
process.on('SIGTERM', () => { interrupted = 'SIGTERM'; for (const req of activeRequests) req.destroy(Error('Stopped')); });
function run(cmd, args, timeout = 30000) {
  assert.ok(performance.now() - began < 600000, '10minute bound');
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: root, windowsHide: true }); let stdout = '', stderr = '';
    child.stdout.on('data', b => { stdout += b; }); child.stderr.on('data', b => { stderr += b; });
    const timer = setTimeout(() => child.kill(), Math.min(timeout, 600000 - (performance.now() - began)));
    child.once('error', reject); child.once('close', code => { clearTimeout(timer); if (code !== 0) reject(Error(path.basename(cmd) + ' failed, exit=' + code)); else resolve(stdout.trim()); });
  });
}
const kc = args => run(kubectl, ['--kubeconfig', kubeconfig, '--request-timeout=15s', '-n', 'dacn2-lab', ...args]);
async function snapshot() {
  const client = new Client({ host: '127.0.0.1', port: 5432, database: 'dacn2', user: env.DB_USER, password: env.DB_PASSWORD, connectionTimeoutMillis: 3000, statement_timeout: 5000 }); await client.connect();
  try { await client.query('BEGIN READ ONLY'); return (await client.query(`SELECT
    (SELECT count(*)::int FROM courses) AS courses,(SELECT count(*)::int FROM registrations) AS registrations,
    (SELECT md5(string_agg(row_to_json(t)::text,'' ORDER BY id)) FROM courses t) AS course_hash,
    (SELECT md5(string_agg(row_to_json(t)::text,'' ORDER BY id)) FROM registrations t) AS registration_hash`)).rows[0]; }
  finally { await client.query('ROLLBACK'); await client.end(); }
}
async function podSample() {
  const pod = JSON.parse(await kc(['get', 'pods', '-l', 'app=dacn2-backend', '-o', 'json'])).items;
  assert.equal(pod.length, 1); const status = pod[0].status.containerStatuses[0];
  assert.equal(status.ready, true); assert.equal(status.restartCount, 0); assert.notEqual(status.lastState?.terminated?.reason, 'OOMKilled');
  let resources = null;
  try { resources = JSON.parse(await kc(['exec', 'deployment/backend', '--', 'node', '-e', 'const fs=require("fs");console.log(JSON.stringify({cpu:fs.readFileSync("/sys/fs/cgroup/cpu.stat","utf8"),memoryBytes:Number(fs.readFileSync("/sys/fs/cgroup/memory.current","utf8"))}))'])); } catch { /* Explicit null if cgroup sample is unavailable. */ }
  return { time: new Date().toISOString(), pod: pod[0].metadata.name, uid: pod[0].metadata.uid, limits: pod[0].spec.containers[0].resources.limits, imageID: status.imageID, restarts: status.restartCount, resources };
}
function one(target) {
  const started = performance.now();
  if (emitStart) lastEmission = started;
  return new Promise(resolve => {
    let finished = false, bytes = 0;
    const done = (ok, status, error) => { if (finished) return; finished = true; clearTimeout(timer); activeRequests.delete(req); resolve({ ok, status, error, ms: performance.now() - started, bytes }); };
    const req = target.protocol.request({ hostname: '127.0.0.1', port: target.port, path: '/courses', method: 'GET', agent: target.agent }, res => {
      let body = ''; res.on('data', b => { bytes += b.length; if (bytes > 65536) req.destroy(Error('Body cap')); else body += b; });
      res.on('error', e => done(false, res.statusCode, e.code || 'response_error'));
      res.on('end', () => { let ok = false; try { const value = JSON.parse(body); ok = res.statusCode === 200 && Array.isArray(value) && value.length === result.before.courses; } catch {} done(ok, res.statusCode, ok ? undefined : 'status_or_body'); });
    });
    activeRequests.add(req); const timer = setTimeout(() => req.destroy(Error('Timeout')), 1000);
    req.on('error', e => done(false, 0, e.code || e.message)); req.end();
  });
}
const quantile = (sorted, q) => sorted.length ? sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)] : null;
async function measure(target, rate, seconds, kind) {
  assert.ok(rate <= 400 && seconds <= 15 && !interrupted, interrupted || 'Rate bound');
  const count = rate * seconds, start = performance.now(), cpuStart = process.cpuUsage();
  const pending = new Set(), times = [], lags = [], errors = {};
  let slot = 0, dispatched = 0, success = 0, shed = 0, late = 0, failed = 0, peakInflight = 0, peakRSS = 0;
  while (slot < count) {
    if (interrupted) throw Error(interrupted);
    assert.ok(performance.now() - emitStart < 180000, '180second generation deadline');
    const rss = process.memoryUsage().rss; peakRSS = Math.max(peakRSS, rss); assert.ok(rss <= 256 * 1024 * 1024, 'Generator RSS limit');
    const now = performance.now(), due = Math.min(count, Math.floor((now - start) * rate / 1000) + 1);
    while (slot < due) {
      const lag = now - (start + slot * 1000 / rate); lags.push(lag); slot++;
      if (lag > 50) { late++; continue; }
      if (pending.size >= 32) { shed++; continue; }
      dispatched++;
      const promise = one(target).then(r => { times.push(r.ms); if (r.ok) success++; else { failed++; errors[r.error] = (errors[r.error] || 0) + 1; } }).finally(() => pending.delete(promise));
      pending.add(promise); peakInflight = Math.max(peakInflight, pending.size);
    }
    if (failed > 10 && failed / Math.max(1, dispatched - pending.size) > .05) throw Error('HTTP/transport error burst above5%');
    await delay(1);
  }
  await Promise.all(pending);
  assert.equal(count, dispatched + shed + late);
  assert.equal(dispatched, success + failed);
  // Include the full scheduled interval and any tail drain in achieved throughput.
  if (performance.now() - start < seconds * 1000) await delay(seconds * 1000 - (performance.now() - start));
  const elapsed = (performance.now() - start) / 1000, cpu = process.cpuUsage(cpuStart);
  times.sort((a, b) => a - b); lags.sort((a, b) => a - b);
  const row = { target: target.name, kind, offeredRps: rate, seconds, scheduled: count, dispatched, success, errors: failed, errorKinds: errors, concurrencyShed: shed, generatorLateShed: late, elapsedSeconds: elapsed, achievedRps: success / elapsed, p50Ms: quantile(times, .5), p95Ms: quantile(times, .95), p99Ms: quantile(times, .99), schedulerP95Ms: quantile(lags, .95), peakInflight, generatorPeakRSSMiB: peakRSS / 1024 / 1024, generatorCpuMs: (cpu.user + cpu.system) / 1000, latencyMs: times };
  row.meetsCondition = row.p95Ms !== null && row.p95Ms <= 80 && failed / Math.max(1, dispatched) <= .01 && success / count >= .95 && late === 0;
  console.log(`${target.name} ${kind} offered=${rate} achieved=${row.achievedRps.toFixed(1)} p95=${row.p95Ms?.toFixed(1)}ms errors=${failed} shed=${shed}/${late} ${row.meetsCondition ? 'PASS' : 'BOUND'}`);
  return row;
}
async function killChild(child) { if (!child || child.exitCode !== null || child.signalCode !== null) return; const exit = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exit; }
(async () => {
  try {
    assert.ok(fs.existsSync(path.join(root, '.local-backups/gateway-m1.exe')), 'Build Gateway first (see DEPLOYMENT.md)');
    assert.equal(env.DB_USER, 'dacn2_app'); result.before = await snapshot();
    await new Promise((resolve, reject) => { const guard = net.createServer(); guard.once('error', reject); guard.listen(18443, '127.0.0.1', () => guard.close(resolve)); });
    ownCluster = true; console.log('Start/check one backend Pod');
    await run(process.execPath, ['scripts/backend-lab.cjs', 'start'], 240000);
    const gatewayEnv = { ...process.env, DACN2_UPSTREAM_URL: 'http://127.0.0.1:13000', DACN2_LISTEN_ADDR: '127.0.0.1:18443' }; delete gatewayEnv.DACN2_TLS_KEYLOG; delete gatewayEnv.SSLKEYLOGFILE;
    const fd = fs.openSync(path.join(out, 'gateway.log'), 'w'); gateway = spawn(path.join(root, '.local-backups/gateway-m1.exe'), [], { cwd: path.join(root, 'gateway'), env: gatewayEnv, windowsHide: true, stdio: ['ignore', fd, fd] }); fs.closeSync(fd);
    for (let i = 0; ; i++) { if ((await one(targets[1])).ok) break; assert.ok(i < 20 && gateway.exitCode === null, 'Gateway not ready'); await delay(250); }
    const guardCode = 'while ($true) { @{time=[DateTime]::UtcNow.ToString("o");freeGiB=((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1MB)} | ConvertTo-Json -Compress; Start-Sleep -Seconds 5 }';
    guard = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', guardCode], { windowsHide: true });
    let buffer = ''; guard.stdout.on('data', b => { buffer += b; let n; while ((n = buffer.indexOf('\n')) >= 0) { const line = buffer.slice(0, n).trim(); buffer = buffer.slice(n + 1); if (!line) continue; const sample = JSON.parse(line); result.memory.push(sample); if (sample.freeGiB < 1) { interrupted = 'Host RAM below1GiB'; for (const req of activeRequests) req.destroy(Error('Emergency stop')); } } });
    result.podBefore = await podSample(); emitStart = performance.now();
    for (const target of targets) {
      const series = { target: target.name, discovery: [], validation: [] }; result.targets.push(series);
      series.warmup = await measure(target, 10, 2, 'warmup');
      let best;
      for (const rate of [10, 25, 50, 100, 200, 400]) {
        const row = await measure(target, rate, 5, 'discovery'); series.discovery.push(row); series.lastPodSample = await podSample();
        if (!row.meetsCondition) break; best = rate;
      }
      assert.ok(best, 'No passing baseline tier'); series.highestPassingOfferedRps = best;
      series.saturationObserved = series.discovery.some(r => !r.meetsCondition);
      for (let repeat = 0; repeat < 2; repeat++) {
        const row = await measure(target, best, 15, 'validation'); series.validation.push(row); series.lastPodSample = await podSample();
        assert.ok(row.meetsCondition, 'Validation did not reproduce discovery; C unavailable');
      }
    }
    const points = result.targets.flatMap(t => t.validation);
    result.C = Math.floor(.8 * Math.min(...points.map(r => r.achievedRps)));
    result.capacityKind = 'conservative read-only lab working point; not maximum or universal capacity';
    result.after = await snapshot(); assert.deepEqual(result.after, result.before); result.pass = true;
  } catch (error) { result.error = error.message.replaceAll(env.DB_PASSWORD, '[REDACTED]'); process.exitCode = 1; }
  finally {
    for (const req of activeRequests) req.destroy(Error('Cleanup'));
    for (const target of targets) target.agent.destroy();
    await killChild(gateway); await killChild(guard);
    if (ownCluster) {
      const stopped = spawnSync(process.execPath, ['scripts/backend-lab.cjs', 'stop'], { cwd: root, windowsHide: true, encoding: 'utf8', timeout: 60000 });
      result.clusterStopped = stopped.status === 0; if (!result.clusterStopped) { result.pass = false; process.exitCode = 1; }
    }
    result.elapsedSeconds = (performance.now() - began) / 1000;
    result.generatingWindowSeconds = lastEmission ? (lastEmission - emitStart) / 1000 : 0;
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
    const rows = result.targets.flatMap(t => [...(t.discovery || []), ...(t.validation || [])]);
    fs.writeFileSync(path.join(out, 'summary.csv'), ['target,kind,offeredRps,achievedRps,p50Ms,p95Ms,p99Ms,errors,concurrencyShed,generatorLateShed,meetsCondition', ...rows.map(r => [r.target,r.kind,r.offeredRps,r.achievedRps,r.p50Ms,r.p95Ms,r.p99Ms,r.errors,r.concurrencyShed,r.generatorLateShed,r.meetsCondition].join(','))].join('\n'));
    console.log(JSON.stringify({ pass: result.pass, C: result.C, error: result.error, elapsedSeconds: result.elapsedSeconds, clusterStopped: result.clusterStopped })); console.log('Evidence: ' + out);
  }
})();
