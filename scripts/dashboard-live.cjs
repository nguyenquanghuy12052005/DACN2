// Direct Chrome -> HTTPS Gateway -> NestJS -> dacn2_test; Vite carries UI/telemetry only.
const fs = require('node:fs'),
  path = require('node:path'),
  net = require('node:net'),
  https = require('node:https');
const { X509Certificate, createHash, randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { setTimeout: delay } = require('node:timers/promises');
const { runCommand } = require('./lab-command.cjs');
const { createLiveAdapter } = require('../dashboard/server/live-adapter.cjs');
const root = path.resolve(__dirname, '..');
const env = require('../backend/node_modules/dotenv').parse(
  fs.readFileSync(path.join(root, 'backend/.env')),
);
require('node:assert/strict').equal(env.DB_USER, 'dacn2_app');
require('node:assert/strict').equal(env.DB_HOST, '127.0.0.1');
require('node:assert/strict').equal(env.DB_PORT, '5432');
const { Client } = require('../backend/node_modules/pg');
const stamp = Date.now().toString(),
  out = path.join(root, '.local-backups/ui-live', stamp);
const children = [];
let db,
  server,
  adapter,
  fixtureIds = [],
  stopping = false,
  lockOwned = false,
  finalizing,
  stopWatch;
let initializing = true,
  stopRequested = false;
const report = {
  task: 'UI-03b',
  sessionId: stamp,
  database: 'dacn2_test',
  mode: 'native-direct-browser',
  fixtureIds,
  cleanup: false,
};
const lock = path.join(root, '.local-backups/ui-live/session.lock');
if (process.argv[2] === 'stop') {
  const session = JSON.parse(fs.readFileSync(lock, 'utf8'));
  if (!/^\d+$/.test(session.sessionId))
    throw Error('Session lock không hợp lệ.');
  fs.writeFileSync(
    path.join(
      root,
      '.local-backups/ui-live',
      session.sessionId,
      'stop.request',
    ),
    'stop',
  );
  console.log('Đã yêu cầu phiên riêng dừng và dọn fixture.');
  process.exit(0);
}
function requestStop(code = 0) {
  stopRequested = true;
  if (!initializing) return shutdown(code);
}
function ensureRunning() {
  if (stopRequested || stopping) throw Error('Phiên đã được yêu cầu dừng.');
}
function log(message) {
  console.log(message);
}
async function portFree(port) {
  await new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', () =>
      reject(Error(`Cổng ${port} đang dùng; không tự dừng tiến trình khác.`)),
    );
    s.listen(port, '127.0.0.1', () => s.close(resolve));
  });
}
async function stopChild(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null)
    return;
  await new Promise((resolve) => {
    child.once('exit', resolve);
    child.kill();
  });
}
function child(command, args, options, file) {
  const fd = fs.openSync(path.join(out, file), 'a');
  const c = spawn(command, args, {
    windowsHide: true,
    ...options,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(c);
  c.on('error', () => {
    if (file === 'chrome.log') {
      log('Không mở được Chrome lab; kiểm tra đường dẫn Chrome.');
      return;
    }
    report.error = 'Không khởi động được tiến trình riêng.';
    requestStop(1);
  });
  c.stdout.on('data', (data) => {
    fs.writeSync(fd, data);
    if (file === 'gateway.log') adapter.ingest(data);
  });
  c.stderr.on('data', (data) => {
    fs.writeSync(fd, data);
    if (file === 'gateway.log') adapter.ingest(data);
  });
  c.once('close', () => {
    fs.closeSync(fd);
    if (!stopping && file !== 'chrome.log') {
      report.error = 'Một dịch vụ của phiên đã dừng.';
      requestStop(1);
    }
  });
  return c;
}
async function snapshot(database) {
  const c = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database,
    connectionTimeoutMillis: 3000,
  });
  await c.connect();
  try {
    return (
      await c.query(
        `SELECT (SELECT count(*)::int FROM courses) courses,(SELECT count(*)::int FROM registrations) registrations,(SELECT md5(string_agg(row_to_json(t)::text,'' ORDER BY id)) FROM courses t) course_hash,(SELECT md5(string_agg(row_to_json(t)::text,'' ORDER BY id)) FROM registrations t) registration_hash`,
      )
    ).rows[0];
  } finally {
    await c.end();
  }
}
async function shutdown(code = 0) {
  if (finalizing) return finalizing;
  stopping = true;
  finalizing = (async () => {
    clearInterval(stopWatch);
    adapter?.close();
    if (server) await server.close();
    for (const c of [...children].reverse()) await stopChild(c);
    try {
      if (db && fixtureIds.length) {
        await db.query('BEGIN');
        await db.query(
          'DELETE FROM registrations WHERE course_id = ANY($1::bigint[])',
          [fixtureIds],
        );
        await db.query(
          'DELETE FROM courses WHERE id = ANY($1::bigint[]) AND code LIKE $2',
          [fixtureIds, `UI${stamp}%`],
        );
        await db.query('COMMIT');
      }
      if (report.beforeDemo) {
        report.afterDemo = await snapshot('dacn2');
        report.afterTest = await snapshot('dacn2_test');
        report.cleanup =
          JSON.stringify(report.beforeDemo) ===
            JSON.stringify(report.afterDemo) &&
          JSON.stringify(report.beforeTest) ===
            JSON.stringify(report.afterTest);
      }
    } catch {
      report.cleanup = false;
      report.cleanupError =
        'Cần kiểm tra fixture bằng ID trong result.json; không xoá dữ liệu khác.';
      code = 1;
    } finally {
      if (db) await db.end();
      if (lockOwned) fs.unlinkSync(lock);
    }
    report.stoppedAt = new Date().toISOString();
    fs.writeFileSync(
      path.join(out, 'result.json'),
      JSON.stringify(report, null, 2),
    );
    log(`Đã dừng phiên. Cleanup: ${report.cleanup}. Evidence: ${out}`);
    process.exitCode = code;
  })();
  return finalizing;
}
process.on('SIGINT', () => requestStop());
process.on('SIGTERM', () => requestStop());
(async () => {
  fs.mkdirSync(out, { recursive: true });
  try {
    for (const p of [5173, 13001, 18444]) await portFree(p);
    const lockFd = fs.openSync(lock, 'wx');
    lockOwned = true;
    fs.writeSync(
      lockFd,
      JSON.stringify({ pid: process.pid, sessionId: stamp }),
    );
    fs.closeSync(lockFd);
    stopWatch = setInterval(() => {
      if (fs.existsSync(path.join(out, 'stop.request'))) requestStop();
    }, 500);
    report.beforeDemo = await snapshot('dacn2');
    report.beforeTest = await snapshot('dacn2_test');
    db = new Client({
      host: '127.0.0.1',
      port: 5432,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: 'dacn2_test',
      connectionTimeoutMillis: 3000,
    });
    await db.connect();
    const names = ['Nhập môn lập trình', 'Mạng máy tính', 'Hệ cơ sở dữ liệu'];
    for (let i = 0; i < names.length; i++) {
      const row = (
        await db.query(
          'INSERT INTO courses(code,name,capacity) VALUES ($1,$2,$3) RETURNING id::text',
          [`UI${stamp}${i}`, names[i], i === 2 ? 1 : 20],
        )
      ).rows[0];
      fixtureIds.push(row.id);
    }
    ensureRunning();
    fs.writeFileSync(
      path.join(out, 'result.json'),
      JSON.stringify(report, null, 2),
    );
    log('Build backend/Gateway cho phiên riêng...');
    await runCommand(
      process.execPath,
      [
        path.join(root, 'backend/node_modules/@nestjs/cli/bin/nest.js'),
        'build',
      ],
      {
        cwd: path.join(root, 'backend'),
        timeout: 90000,
        secrets: [env.DB_PASSWORD],
      },
    );
    ensureRunning();
    const binary = path.join(out, 'gateway.exe');
    await runCommand('go', ['build', '-o', binary, '.'], {
      cwd: path.join(root, 'gateway'),
      timeout: 90000,
    });
    ensureRunning();
    const ca = fs.readFileSync(path.join(root, 'gateway/cert.pem')),
      fingerprint = new X509Certificate(ca).fingerprint256;
    const certificate = new X509Certificate(ca);
    if (
      Date.now() > Date.parse(certificate.validTo) ||
      Date.now() < Date.parse(certificate.validFrom) ||
      !certificate.checkIP('127.0.0.1')
    )
      throw Error(
        'Certificate lab hết hạn hoặc không hợp lệ cho127.0.0.1; cần gia hạn trước khi chạy.',
      );
    const spki = createHash('sha256')
      .update(certificate.publicKey.export({ type: 'spki', format: 'der' }))
      .digest('base64');
    const browserToken = randomBytes(32).toString('hex');
    report.certificateFingerprint = fingerprint;
    report.browserSPKI = spki;
    const agent = new https.Agent({
      keepAlive: true,
      maxSockets: 8,
      ca,
      checkServerIdentity: (_, cert) =>
        cert.fingerprint256 === fingerprint
          ? undefined
          : Error('Lab certificate mismatch'),
    });
    const requestGateway = (method, route, body) =>
      new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : undefined;
        const req = https.request(
          {
            hostname: '127.0.0.1',
            port: 18444,
            path: route,
            method,
            agent,
            headers: data
              ? {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(data),
                }
              : {},
          },
          (res) => {
            let size = 0;
            const chunks = [];
            res.on('data', (chunk) => {
              size += chunk.length;
              if (size > 65536) req.destroy(Error('Response limit'));
              else chunks.push(chunk);
            });
            res.on('error', reject);
            res.on('end', () => {
              const text = Buffer.concat(chunks).toString();
              let payload;
              try {
                payload = JSON.parse(text);
              } catch {
                payload = {
                  message:
                    res.statusCode === 502
                      ? 'Backend không sẵn sàng.'
                      : 'Phản hồi không phải JSON.',
                };
              }
              resolve({
                status: res.statusCode,
                body: payload,
                requestId: res.headers['x-request-id'],
              });
            });
          },
        );
        req.on('error', reject);
        req.setTimeout(5000, () => req.destroy(Error('Gateway timeout')));
        req.end(data);
      });
    adapter = createLiveAdapter({
      sessionId: stamp,
      fixtureIds,
      requestGateway,
      directConfig: { token: browserToken },
    });
    const backendEnv = {
      ...process.env,
      ...env,
      DB_NAME: 'dacn2_test',
      HOST: '127.0.0.1',
      PORT: '13001',
    };
    child(
      process.execPath,
      ['dist/main.js'],
      { cwd: path.join(root, 'backend'), env: backendEnv },
      'backend.log',
    );
    const gatewayEnv = {
      ...process.env,
      DACN2_UPSTREAM_URL: 'http://127.0.0.1:13001',
      DACN2_LISTEN_ADDR: '127.0.0.1:18444',
      DACN2_BROWSER_ORIGIN: 'http://127.0.0.1:5173',
      DACN2_BROWSER_TOKEN: browserToken,
      DACN2_BROWSER_COURSE_IDS: fixtureIds.join(','),
    };
    delete gatewayEnv.DACN2_TLS_KEYLOG;
    delete gatewayEnv.SSLKEYLOGFILE;
    child(
      binary,
      [],
      { cwd: path.join(root, 'gateway'), env: gatewayEnv },
      'gateway.log',
    );
    let ready = false;
    for (let i = 0; i < 40 && !stopping; i++) {
      try {
        ready = (await requestGateway('GET', '/health')).status === 200;
        if (ready) break;
      } catch {
        /* bounded startup wait */
      }
      await delay(500);
    }
    if (!ready || stopping) throw Error('Backend/Gateway chưa sẵn sàng.');
    ensureRunning();
    await adapter.probe();
    adapter.start();
    const { createServer } = await import(
      pathToFileURL(
        path.join(root, 'dashboard/node_modules/vite/dist/node/index.js'),
      ).href
    );
    server = await createServer({
      root: path.join(root, 'dashboard'),
      configFile: path.join(root, 'dashboard/vite.config.ts'),
      plugins: [adapter.plugin],
    });
    await server.listen();
    ensureRunning();
    initializing = false;
    report.readyAt = new Date().toISOString();
    fs.writeFileSync(
      path.join(out, 'result.json'),
      JSON.stringify(report, null, 2),
    );
    log('DEMO TRỰC TIẾP: http://127.0.0.1:5173/demo');
    log('Dashboard: http://127.0.0.1:5173/dashboard');
    log(
      'Chrome → HTTPS Gateway18444 → NestJS13001 → dacn2_test. Dashboard chỉ nhận log. Ctrl+C dừng và dọn fixture.',
    );
    if (!process.argv.includes('--no-browser')) {
      const chrome = path.join(
        process.env.ProgramFiles || 'C:/Program Files',
        'Google/Chrome/Application/chrome.exe',
      );
      if (fs.existsSync(chrome)) {
        child(
          chrome,
          [
            `--user-data-dir=${path.join(out, 'chrome-profile')}`,
            `--ignore-certificate-errors-spki-list=${spki}`,
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-sync',
            '--disable-background-networking',
            '--new-window',
            'http://127.0.0.1:5173/demo',
            'http://127.0.0.1:5173/dashboard',
          ],
          { cwd: root },
          'chrome.log',
        );
        log(
          'Đã mở Chrome lab riêng, chỉ cho phép khoá certificate lab. Dùng cửa sổ này để demo HTTPS/HTTP2.',
        );
      } else
        log(
          'Không tìm thấy Google Chrome. Xem hướng dẫn Chrome lab trong DEPLOYMENT.md.',
        );
    }
    process.once('beforeExit', () => agent.destroy());
  } catch (error) {
    report.error = String(error.message).replaceAll(
      env.DB_PASSWORD,
      '[REDACTED]',
    );
    log(report.error);
    await shutdown(1);
  }
})();
