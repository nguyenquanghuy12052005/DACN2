// HTTPS -> Gateway -> one backend Pod -> Windows PG. Writes only dacn2_test.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const https = require('node:https'), http2 = require('node:http2'), net = require('node:net');
const { X509Certificate } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { runCommand } = require('./lab-command.cjs');
const root = path.resolve(__dirname, '..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));
const env = require(path.join(root, 'backend/node_modules/dotenv')).parse(fs.readFileSync(path.join(root, 'backend/.env')));
const stamp = Date.now().toString(), code = 'M1H_' + stamp;
const out = path.join(root, '.local-backups/m105h', stamp); fs.mkdirSync(out, { recursive: true });
const kubeconfig = path.join(root, '.local-backups/m105e/1793364531571-resume-1793364615141/kubeconfig.yaml');
const kubectl = path.join(root, '.local-backups/tools/kubectl-v1.35.9.exe');
const ca = fs.readFileSync(path.join(root, 'gateway/cert.pem'));
const fingerprint = new X509Certificate(ca).fingerprint256;
const tlsOptions = { ca, checkServerIdentity: (_, cert) => cert.fingerprint256 === fingerprint ? undefined : Error('Lab certificate fingerprint mismatch') };
const result = { task: 'M1-05h', pass: false, requests: [] };
let gateway, gatewayLog, fixtureId, testClient, clusterTouched = false, databaseSwitched = false;
const start = Date.now();
function run(cmd, args, timeout = 30000, input) {
  assert.ok(Date.now() - start < 600000, '10minute integration bound');
  return runCommand(cmd, args, {
    cwd: root,
    timeout: Math.min(timeout, 600000 - (Date.now() - start)),
    input,
    label: cmd === process.execPath ? 'Backend lab start' : path.basename(cmd),
    labReport: cmd === process.execPath && args[0] === 'scripts/backend-lab.cjs',
    secrets: [env.DB_PASSWORD],
  });
}
const kc = (args, timeout) => run(kubectl, ['--kubeconfig', kubeconfig, '--request-timeout=15s', '-n', 'dacn2-lab', ...args], timeout);
async function snapshot(database) {
  const client = new Client({ host: '127.0.0.1', port: 5432, database, user: env.DB_USER, password: env.DB_PASSWORD, connectionTimeoutMillis: 3000, statement_timeout: 5000 });
  await client.connect();
  try { await client.query('BEGIN READ ONLY'); return (await client.query(`SELECT
    (SELECT count(*)::int FROM courses) AS courses,(SELECT count(*)::int FROM registrations) AS registrations,
    (SELECT md5(string_agg(row_to_json(t)::text,'' ORDER BY id)) FROM courses t) AS course_hash,
    (SELECT md5(string_agg(row_to_json(t)::text,'' ORDER BY id)) FROM registrations t) AS registration_hash`)).rows[0]; }
  finally { await client.query('ROLLBACK'); await client.end(); }
}
function request(route, expected, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = https.request({ hostname: '127.0.0.1', port: 18443, path: route, method: body ? 'POST' : 'GET', ...tlsOptions, headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {} }, res => {
      let text = ''; res.on('data', b => { text += b; }); res.on('end', () => {
        try {
          result.requests.push({ route: route.startsWith('/courses/') ? '/courses/:id' : route, method: body ? 'POST' : 'GET', status: res.statusCode, requestId: res.headers['x-request-id'] });
          if (Array.isArray(expected)) assert.ok(expected.includes(res.statusCode)); else assert.equal(res.statusCode, expected);
          assert.ok(res.headers['x-request-id']);
          if (String(res.headers['content-type']).includes('application/json')) resolve(JSON.parse(text));
          else { assert.equal(expected, 502); assert.match(text, /Backend unavailable/); resolve(text); }
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject); req.setTimeout(8000, () => req.destroy(Error('Request timeout'))); req.end(data);
  });
}
async function stopGateway() {
  if (!gateway || gateway.exitCode !== null || gateway.signalCode !== null) return;
  const exited = new Promise(resolve => gateway.once('exit', resolve)); gateway.kill(); await exited;
}
async function waitForFixture() {
  // Ready status precedes asynchronous EndpointSlice/kube-proxy propagation.
  // Keep transient responses in result.requests; never POST until test DB is proven.
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try { const course = await request('/courses/' + fixtureId, 200); if (course.code === code) return course; }
    catch { /* Recorded read-only rollout response; retry within the bound. */ }
    await delay(250);
  }
  throw Error('Actual Service/test-DB fixture route did not become ready');
}
(async () => {
  try {
    assert.ok(fs.existsSync(path.join(root, '.local-backups/gateway-m1.exe')), 'Build Gateway first (see DEPLOYMENT.md)');
    assert.equal(env.DB_USER, 'dacn2_app'); assert.equal(env.DB_HOST, '127.0.0.1'); assert.equal(env.DB_PORT, '5432');
    // Fail rather than interact with an existing user listener.
    await new Promise((resolve, reject) => { const guard = net.createServer(); guard.once('error', reject); guard.listen(18443, '127.0.0.1', () => guard.close(resolve)); });
    result.beforeDemo = await snapshot('dacn2'); result.beforeTest = await snapshot('dacn2_test');
    clusterTouched = true;
    console.log('Start/check owned backend lab');
    await run(process.execPath, ['scripts/backend-lab.cjs', 'start'], 240000);
    const childEnv = { ...process.env, DACN2_UPSTREAM_URL: 'http://127.0.0.1:13000', DACN2_LISTEN_ADDR: '127.0.0.1:18443' };
    delete childEnv.DACN2_TLS_KEYLOG; delete childEnv.SSLKEYLOGFILE;
    gatewayLog = fs.openSync(path.join(out, 'gateway.log'), 'w');
    gateway = spawn(path.join(root, '.local-backups/gateway-m1.exe'), [], { cwd: path.join(root, 'gateway'), env: childEnv, windowsHide: true, stdio: ['ignore', gatewayLog, gatewayLog] }); fs.closeSync(gatewayLog);
    for (let i = 0; ; i++) { try { await request('/gateway/health', 200); break; } catch (error) { if (i >= 20 || gateway.exitCode !== null) throw error; await delay(250); } }
    assert.equal((await request('/health', 200)).service, 'dacn2-backend');
    assert.equal((await request('/courses', 200)).length, result.beforeDemo.courses);
    console.log('HTTPS/HTTP2 through actual Pod');
    await new Promise((resolve, reject) => {
      const session = http2.connect('https://127.0.0.1:18443', tlsOptions); session.on('error', reject);
      const req = session.request({ ':path': '/health' }); let status, body = '';
      req.setTimeout(8000, () => { session.destroy(); reject(Error('H2 timeout')); });
      req.on('response', headers => { status = headers[':status']; }); req.on('data', b => { body += b; }); req.on('error', reject);
      req.on('end', () => { try { assert.equal(status, 200); assert.equal(JSON.parse(body).service, 'dacn2-backend'); result.http2 = { status, alpn: session.alpnProtocol }; assert.equal(session.alpnProtocol, 'h2'); session.close(); resolve(); } catch (e) { session.destroy(); reject(e); } }); req.end();
    });
    console.log('Synthetic test-DB fixture/write/duplicate/full');
    testClient = new Client({ host: '127.0.0.1', port: 5432, database: 'dacn2_test', user: env.DB_USER, password: env.DB_PASSWORD, connectionTimeoutMillis: 3000, statement_timeout: 5000 }); await testClient.connect();
    assert.equal((await testClient.query('SELECT current_database() AS name')).rows[0].name, 'dacn2_test');
    fixtureId = (await testClient.query('INSERT INTO courses(code,name,capacity) VALUES ($1,$2,1) RETURNING id::text', [code, 'M1 integration fixture'])).rows[0].id;
    result.fixture = { database: 'dacn2_test', id: fixtureId, code };
    databaseSwitched = true;
    await kc(['set', 'env', 'deployment/backend', 'DB_NAME=dacn2_test']);
    await kc(['rollout', 'status', 'deployment/backend', '--timeout=120s'], 125000);
    await waitForFixture();
    await request('/courses/' + fixtureId + '/registrations', 400, { studentCode: 'invalid space' });
    await request('/courses/' + fixtureId + '/registrations', 201, { studentCode: 'M1H_A' });
    assert.equal((await request('/courses/' + fixtureId + '/registrations', 409, { studentCode: 'M1H_A' })).code, 'ALREADY_REGISTERED');
    assert.equal((await request('/courses/' + fixtureId + '/registrations', 409, { studentCode: 'M1H_B' })).code, 'COURSE_FULL');
    assert.equal((await request('/courses/' + fixtureId, 200)).registeredCount, 1);
    assert.equal((await testClient.query('SELECT count(*)::int AS n FROM registrations WHERE course_id=$1', [fixtureId])).rows[0].n, 1);
    // Exercise transaction races through the real Pod, not just the host test app.
    async function resetOwnFixture() {
      await testClient.query('BEGIN');
      try {
        await testClient.query('DELETE FROM registrations WHERE course_id=$1', [fixtureId]);
        assert.equal((await testClient.query('UPDATE courses SET registered_count=0 WHERE id=$1 AND code=$2', [fixtureId, code])).rowCount, 1);
        await testClient.query('COMMIT');
      } catch (error) { await testClient.query('ROLLBACK'); throw error; }
    }
    for (const duplicate of [false, true]) {
      await resetOwnFixture();
      const before = result.requests.length;
      const replies = await Promise.all(['A', 'B'].map(suffix => request('/courses/' + fixtureId + '/registrations', [201, 409], { studentCode: duplicate ? 'M1H_DUPRACE' : 'M1H_RACE_' + suffix })));
      assert.deepEqual(result.requests.slice(before).map(r => r.status).sort(), [201, 409]);
      assert.ok(replies.some(body => body.code === (duplicate ? 'ALREADY_REGISTERED' : 'COURSE_FULL')));
      const counts = (await testClient.query('SELECT registered_count,(SELECT count(*)::int FROM registrations WHERE course_id=$1) AS actual FROM courses WHERE id=$1', [fixtureId])).rows[0];
      assert.deepEqual(counts, { registered_count: 1, actual: 1 });
    }
    result.podRaces = 'last-seat and duplicate concurrent requests: one201/one409, atomic counter=actual1';
    console.log('Backend down/recovery via owned Deployment');
    await kc(['scale', 'deployment/backend', '--replicas=0']);
    await kc(['wait', '--for=delete', 'pods', '-l', 'app=dacn2-backend', '--timeout=45s'], 50000);
    await request('/gateway/health', 200); await request('/health', 502);
    await kc(['scale', 'deployment/backend', '--replicas=1']);
    await kc(['rollout', 'status', 'deployment/backend', '--timeout=120s'], 125000);
    assert.equal((await waitForFixture()).registeredCount, 1); await request('/health', 200);
    result.recovery = 'Gateway local health200/backenddown502/recovered200; test registration persisted';
    result.pass = true;
  } catch (error) {
    result.error = error.message.replaceAll(env.DB_PASSWORD, '[REDACTED]');
    if (error.labFailure) result.backendFailure = error.labFailure;
    process.exitCode = 1;
  }
  finally {
    try {
      if (databaseSwitched) { await kc(['apply', '-f', path.join(root, 'kubernetes/backend.yaml')]); await kc(['rollout', 'status', 'deployment/backend', '--timeout=120s'], 125000); result.backendRestored = 'DB_NAME=dacn2, replicas1'; }
    } catch (error) { result.restoreError = error.message; result.pass = false; process.exitCode = 1; }
    try {
      if (fixtureId && testClient) {
        await testClient.query('BEGIN');
        await testClient.query('DELETE FROM registrations WHERE course_id=$1', [fixtureId]);
        assert.equal((await testClient.query('DELETE FROM courses WHERE id=$1 AND code=$2', [fixtureId, code])).rowCount, 1);
        await testClient.query('COMMIT'); result.fixtureCleanup = true;
      }
      result.afterDemo = await snapshot('dacn2'); result.afterTest = await snapshot('dacn2_test');
      assert.deepEqual(result.afterDemo, result.beforeDemo); assert.deepEqual(result.afterTest, result.beforeTest);
    } catch (error) { result.cleanupError = error.message.replaceAll(env.DB_PASSWORD, '[REDACTED]'); result.pass = false; process.exitCode = 1; }
    finally { if (testClient) await testClient.end(); }
    await stopGateway();
    try { if (gateway) {
      const events = fs.readFileSync(path.join(out, 'gateway.log'), 'utf8').split(/\r?\n/).filter(line => line.startsWith('{')).map(line => JSON.parse(line));
      result.gatewayEvents = events.length; assert.equal(events.length, result.requests.length + (result.http2 ? 1 : 0));
      result.eventStatuses = events.map(e => e.status_code);
    } } catch (error) { result.eventError = error.message; result.pass = false; process.exitCode = 1; }
    try { if (clusterTouched) {
      const stopped = spawnSync(process.execPath, ['scripts/backend-lab.cjs', 'stop'], { cwd: root, windowsHide: true, timeout: 60000, encoding: 'utf8' });
      assert.equal(stopped.status, 0); result.clusterStopped = true;
    } }
    catch (error) { result.stopError = error.message; result.pass = false; process.exitCode = 1; }
    result.elapsedSeconds = (Date.now() - start) / 1000;
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2)); console.log('Evidence: ' + out);
  }
})();
