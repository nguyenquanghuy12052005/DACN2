// Controlled local lab only. Credentials enter kubectl on stdin, never argv/files.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const dotenv = require(path.join(root, 'backend/node_modules/dotenv'));
const { Client } = require(path.join(root, 'backend/node_modules/pg'));
const action = process.argv[2] || 'verify';
assert.ok(['verify', 'start', 'check', 'stop'].includes(action), 'Use verify/start/check/stop');
const cluster = 'dacn2-m105e', namespace = 'dacn2-lab';
const k3d = path.join(root, '.local-backups/tools/k3d-v5.9.0.exe');
const kubectl = path.join(root, '.local-backups/tools/kubectl-v1.35.9.exe');
const kubeconfig = path.join(root, '.local-backups/m105e/1793364531571-resume-1793364615141/kubeconfig.yaml');
const manifest = path.join(root, 'kubernetes/backend.yaml');
const env = dotenv.parse(fs.readFileSync(path.join(root, 'backend/.env')));
assert.equal(env.DB_HOST, '127.0.0.1'); assert.equal(env.DB_PORT, '5432'); assert.equal(env.DB_USER, 'dacn2_app'); assert.ok(env.DB_PASSWORD);
const out = path.join(root, '.local-backups/m105g', Date.now().toString());
fs.mkdirSync(out, { recursive: true });
const result = { task: 'M1-05g', action, cluster, namespace, pass: false, requests: [], memory: [], phases: [] };
const began = Date.now();
let touched = false, monitor, active, emergency;
function scrub(text) { return text.replaceAll(env.DB_PASSWORD, '[REDACTED]').replaceAll(Buffer.from(env.DB_PASSWORD).toString('base64'), '[REDACTED]'); }
function sync(cmd, args, timeout = 10000) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024 });
  if (r.error || r.status !== 0) throw Error(path.basename(cmd) + ' failed: ' + scrub(r.stderr || r.error?.message || ''));
  return r.stdout.trim();
}
function server() {
  const item = JSON.parse(sync('docker', ['inspect', 'k3d-' + cluster + '-server-0']))[0];
  assert.equal(item.Config.Labels['dacn2.probe_id'], '1793364531571', 'Unexpected cluster owner');
  const bindings = Object.fromEntries(Object.entries(item.HostConfig.PortBindings).map(([k, v]) => [k.includes('/') ? k : k + '/tcp', v]));
  assert.equal(item.HostConfig.Memory, 3072 * 1024 * 1024);
  for (const value of Object.values(bindings).flat()) assert.equal(value.HostIp, '127.0.0.1');
  assert.equal(bindings['6443/tcp'][0].HostPort, '16443'); assert.equal(bindings['30080/tcp'][0].HostPort, '13000');
  return { running: item.State.Running, oom: item.State.OOMKilled, bindings };
}
function ram() { return Number(sync('powershell.exe', ['-NoProfile', '-Command', '(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory'])) / 1024 / 1024; }
function configHash() { const file = path.join(process.env.USERPROFILE, '.kube/config'); return fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null; }
function run(cmd, args, label, timeout = 30000, input) {
  assert.ok(!emergency, emergency);
  const remaining = 600000 - (Date.now() - began); assert.ok(remaining > 0, '10minute deadline');
  console.log(label); result.phases.push({ label, time: new Date().toISOString() });
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: root, windowsHide: true, env: { ...process.env, KUBECONFIG: kubeconfig } });
    active = child; let stdout = '', stderr = '';
    child.stdout.on('data', b => { stdout += b; }); child.stderr.on('data', b => { stderr += b; });
    const timer = setTimeout(() => { emergency = label + ' timeout'; child.kill(); }, Math.min(timeout, remaining));
    child.once('error', reject);
    child.once('close', code => {
      clearTimeout(timer); active = null;
      fs.writeFileSync(path.join(out, label.replace(/[^a-z0-9]/gi, '_') + '.log'), scrub(stdout + '\n' + stderr));
      if (code !== 0 || emergency) reject(Error(emergency || label + ' failed, exit=' + code)); else resolve(stdout.trim());
    });
    child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}
const ka = args => ['--kubeconfig', kubeconfig, '--request-timeout=15s', ...args];
const kc = (args, label, timeout, input) => run(kubectl, ka(args), label, timeout, input);
async function snapshot() {
  const client = new Client({ host: env.DB_HOST, port: 5432, database: 'dacn2', user: env.DB_USER, password: env.DB_PASSWORD, connectionTimeoutMillis: 3000, statement_timeout: 5000 });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    return (await client.query(`SELECT
      (SELECT count(*)::int FROM courses) AS courses,
      (SELECT count(*)::int FROM registrations) AS registrations,
      (SELECT md5(string_agg(row_to_json(t)::text,'' ORDER BY id)) FROM courses t) AS course_hash,
      (SELECT md5(string_agg(row_to_json(t)::text,'' ORDER BY id)) FROM registrations t) AS registration_hash`)).rows[0];
  } finally { await client.query('ROLLBACK'); await client.end(); }
}
async function get(route, expected = 200) {
  assert.ok(!emergency, emergency);
  const response = await fetch('http://127.0.0.1:13000' + route, { signal: AbortSignal.timeout(5000) });
  const body = await response.json(); result.requests.push({ route, status: response.status }); assert.equal(response.status, expected);
  return body;
}
async function check() {
  const deployment = JSON.parse(await kc(['-n', namespace, 'get', 'deployment', 'backend', '-o', 'json'], 'Deployment state'));
  assert.equal(deployment.spec.replicas, 1); assert.equal(deployment.status.readyReplicas, 1);
  const pods = JSON.parse(await kc(['-n', namespace, 'get', 'pods', '-l', 'app=dacn2-backend', '-o', 'json'], 'Backend Pod state')).items;
  assert.equal(pods.length, 1); assert.equal(pods[0].status.containerStatuses[0].ready, true);
  assert.equal(pods[0].status.containerStatuses[0].restartCount, 0);
  result.pod = { name: pods[0].metadata.name, uid: pods[0].metadata.uid, imageID: pods[0].status.containerStatuses[0].imageID, ip: pods[0].status.podIP, limits: pods[0].spec.containers[0].resources.limits, ready: true, restarts: 0 };
  const service = JSON.parse(await kc(['-n', namespace, 'get', 'service', 'backend', '-o', 'json'], 'Service state'));
  assert.equal(service.spec.ports[0].nodePort, 30080); result.service = { type: service.spec.type, nodePort: 30080, clusterIP: service.spec.clusterIP };
  assert.equal((await get('/health')).service, 'dacn2-backend');
  const courses = await get('/courses'); assert.equal(courses.length, result.before.courses);
  const detail = await get('/courses/' + courses[0].id); assert.equal(detail.id, courses[0].id); assert.equal(detail.code, courses[0].code); assert.match(detail.name, /[^\x00-\x7F]/);
  await get('/courses/invalid', 400); await get('/courses/9007199254740991', 404);
  result.runtime = JSON.parse(await kc(['-n', namespace, 'exec', 'deployment/backend', '--', 'node', '-e', 'const fs=require("fs"); console.log(JSON.stringify({uid:process.getuid(),node:process.version,envFile:fs.existsSync("/app/.env"),token:fs.existsSync("/var/run/secrets/kubernetes.io/serviceaccount/token")}))'], 'Runtime identity'));
  assert.equal(result.runtime.uid, 1000); assert.equal(result.runtime.envFile, false); assert.equal(result.runtime.token, false);
  result.after = await snapshot(); assert.deepEqual(result.after, result.before);
  result.server = server(); assert.equal(result.server.oom, false);
}
(async () => {
  try {
    sync('icacls.exe', [out, '/inheritance:r', '/grant:r', sync('whoami', []) + ':(OI)(CI)F']);
    result.configBefore = configHash(); result.initialServer = server();
    if (action === 'stop') { sync(k3d, ['cluster', 'stop', cluster], 45000); result.pass = true; return; }
    result.freeBeforeGiB = ram();
    // Trial startup reserve, not a measured minimum; retain the <1 GiB runtime stop.
    if (!result.initialServer.running) assert.ok(result.freeBeforeGiB >= 3, 'Fresh RAM below3GiB; cluster not started');
    result.before = await snapshot();
    monitor = setInterval(() => { try { const free = ram(); result.memory.push({ time: new Date().toISOString(), freeGiB: free }); if (free < 1) { emergency = 'RAM below1GiB'; active?.kill(); } } catch { emergency = 'RAM monitor failed'; active?.kill(); } }, 10000);
    touched = true;
    if (!result.initialServer.running) await run(k3d, ['cluster', 'start', cluster, '--wait', '--timeout', '120s'], 'Start owned cluster', 125000);
    if (action !== 'check') {
      const archive = path.join(out, 'backend-amd64.tar');
      result.sourceImage = sync('docker', ['image', 'inspect', '--format', '{{.Id}}', 'dacn2-backend:m105c']);
      assert.equal(result.sourceImage, 'sha256:d197ba464b8b129bb5a8d198b843ca0e999520b82a9b08226c595b7cd93ec009');
      await run('docker', ['image', 'save', '--platform=linux/amd64', '--output', archive, 'dacn2-backend:m105c'], 'Export cached backend amd64', 60000);
      await run(k3d, ['image', 'import', archive, '--cluster', cluster, '--mode', 'direct'], 'Import cached backend', 90000);
      const existing = await kc(['get', 'namespace', namespace, '--ignore-not-found', '-o', 'json'], 'Namespace ownership');
      if (existing) assert.equal(JSON.parse(existing).metadata.labels['app.kubernetes.io/part-of'], 'dacn2');
      else await kc(['create', '-f', '-', '-o', 'name'], 'Create lab namespace', 15000, JSON.stringify({ apiVersion: 'v1', kind: 'Namespace', metadata: { name: namespace, labels: { 'app.kubernetes.io/part-of': 'dacn2' } } }));
      await kc(['apply', '--dry-run=server', '-f', manifest, '-o', 'name'], 'Server schema validation');
      const secretOwner = await kc(['-n', namespace, 'get', 'secret', 'backend-db', '--ignore-not-found', '-o', 'jsonpath={.metadata.labels.app\\.kubernetes\\.io/part-of}'], 'Secret ownership metadata only');
      if (secretOwner) assert.equal(secretOwner, 'dacn2');
      else await kc(['create', '-f', '-', '-o', 'name'], 'Create private DB Secret', 15000, JSON.stringify({ apiVersion: 'v1', kind: 'Secret', metadata: { name: 'backend-db', namespace, labels: { 'app.kubernetes.io/part-of': 'dacn2' } }, type: 'Opaque', stringData: { DB_PASSWORD: env.DB_PASSWORD } }));
      await kc(['apply', '-f', manifest, '-o', 'name'], 'Apply backend resources');
      await kc(['-n', namespace, 'rollout', 'status', 'deployment/backend', '--timeout=120s'], 'Backend Ready', 125000);
    }
    await check(); result.pass = true;
  } catch (error) {
    result.error = scrub(error.message); process.exitCode = 1;
    if (touched) {
      for (const [label, args] of [
        ['backend-previous', ['-n', namespace, 'logs', 'deployment/backend', '--previous', '--tail=40']],
        ['backend-current', ['-n', namespace, 'logs', 'deployment/backend', '--tail=40']],
        ['backend-events', ['-n', namespace, 'get', 'events', '--sort-by=.lastTimestamp']]
      ]) {
        try { fs.writeFileSync(path.join(out, label + '.log'), scrub(sync(kubectl, ka(args)))); } catch { /* Logs may not exist before deployment. */ }
      }
    }
  }
  finally {
    clearInterval(monitor);
    try {
      if (touched && (action !== 'start' || !result.pass)) { server(); sync(k3d, ['cluster', 'stop', cluster], 45000); }
      result.finalServer = server();
      if (action !== 'start' || !result.pass) assert.equal(result.finalServer.running, false);
      result.configAfter = configHash(); assert.equal(result.configAfter, result.configBefore);
      result.freeAfterGiB = ram();
    } catch (error) { result.cleanupError = scrub(error.message); result.pass = false; process.exitCode = 1; }
    result.elapsedSeconds = (Date.now() - began) / 1000;
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2)); console.log('Evidence: ' + out);
  }
})();
