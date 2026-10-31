const test = require('node:test');
const assert = require('node:assert/strict');
const { createLiveAdapter } = require('./live-adapter.cjs');
const make = () =>
  createLiveAdapter({
    sessionId: 'test-session',
    fixtureIds: ['61'],
    captureStartedAt: Date.parse('2026-10-31T11:59:00Z'),
    requestGateway: async () => ({ status: 200 }),
  });
const event = (i, fields = {}) => ({
  schema_version: 1,
  event: 'gateway_request',
  request_id: 'a'.repeat(32) + '-' + i,
  completed_at: '2026-10-31T12:00:04.500Z',
  latency_ms: i,
  route: '/courses',
  method: 'GET',
  status_code: 200,
  outcome: 'upstream_response',
  client_ip: '127.0.0.1',
  ...fields,
});
test('structured TLS and H2 join requests only by connection id; proxy HTTP routes are disabled in direct mode', async () => {
  const a = createLiveAdapter({
    sessionId: 'direct',
    fixtureIds: ['61'],
    directConfig: { token: 'a'.repeat(64) },
    requestGateway: async () => assert.fail('must not proxy'),
  });
  a.ingest(
    JSON.stringify({
      event: 'gateway_tls',
      schema_version: 1,
      connection_id: 7,
      ja4: 't13d_abc_def',
    }) + '\n',
  );
  a.ingest(
    JSON.stringify({
      event: 'gateway_h2',
      schema_version: 1,
      connection_id: 7,
      status: 'headers_observed',
      akamai: null,
      akamai_reason: 'missing_window_update',
    }) + '\n',
  );
  a.ingest(
    JSON.stringify(event(1, { connection_id: 7, protocol: 'HTTP/2.0' })) + '\n',
  );
  const s = a.snapshot();
  assert.equal(s.transport, 'direct-browser');
  assert.equal(s.events[0].protocol, 'HTTP/2.0');
  assert.equal(s.connections[0].connectionId, 7);
  assert.equal(s.connections[0].ja4, 't13d_abc_def');
  assert.equal(s.connections[0].h2.akamai, null);
  assert.equal(s.connections[0].h2.reason, 'missing_window_update');
  const res = response();
  await a.middleware(
    {
      url: '/api/live/courses',
      method: 'GET',
      headers: { host: '127.0.0.1:5173', 'x-dacn2-ui': '1' },
    },
    res,
    () => assert.fail(),
  );
  assert.equal(res.status, 404);
});
test('logs are bounded, deduplicated, anonymized; completion windows and p95 are truthful', () => {
  const a = make();
  a.ingest(JSON.stringify(event(1)) + '\n' + JSON.stringify(event(1)) + '\n');
  a.ingest(JSON.stringify(event(2, { route: '/health' })) + '\n');
  a.ingest(
    JSON.stringify(event(3, { status_code: 502, outcome: 'proxy_error' })) +
      '\n',
  );
  const s = a.snapshot(Date.parse('2026-10-31T12:00:05Z'));
  assert.equal(s.completedRps, 2);
  assert.equal(s.p95Ms, 3);
  assert.equal(s.events.length, 2);
  assert.equal(s.events[0].result, 'Lỗi chuyển tiếp');
  assert.equal(s.readyPods, null);
  assert.ok(!JSON.stringify(s).includes('127.0.0.1'));
  assert.equal(a.snapshot(Date.parse('2026-10-31T12:01:00Z')).p95Ms, null);
});
test('fragmented logs, malformed input and fingerprint provenance never invent identity', () => {
  const a = make(),
    line = JSON.stringify(event(1));
  a.ingest(line.slice(0, 40));
  a.ingest(line.slice(40) + '\n');
  a.ingest('{bad}\n');
  a.ingest('2026/10/31 JA4: t13i_abc_def\n');
  const s = a.snapshot();
  assert.equal(s.events.length, 1);
  assert.equal(s.discarded, 1);
  assert.deepEqual(s.fingerprints, ['t13i_abc_def']);
  for (let i = 2; i <= 400; i++) a.ingest(JSON.stringify(event(i)) + '\n');
  assert.equal(a.snapshot().events.length, 300);
  a.ingest('x'.repeat(70000));
  assert.ok(a.snapshot().discarded > 1);
});
function response() {
  return {
    status: null,
    body: '',
    headersSent: false,
    writeHead(code) {
      this.status = code;
      this.headersSent = true;
    },
    setHeader() {},
    end(s) {
      this.body = s;
    },
  };
}
test('foreign origins, arbitrary targets, unowned courses, and missing UI header are refused', async () => {
  const a = make();
  for (const [url, headers, expected] of [
    ['/api/live/courses', { host: 'evil.test' }, 403],
    [
      '/api/live/courses',
      { host: '127.0.0.1:5173', origin: 'http://evil.test' },
      403,
    ],
    ['/api/live/courses/99/registrations', { host: '127.0.0.1:5173' }, 404],
    [
      '/api/live/courses?target=http://evil.test',
      { host: '127.0.0.1:5173' },
      400,
    ],
    ['/api/live/courses', { host: '127.0.0.1:5173' }, 403],
  ]) {
    const res = response();
    await a.middleware(
      { url, headers, method: url.includes('registrations') ? 'POST' : 'GET' },
      res,
      () => assert.fail(),
    );
    assert.equal(res.status, expected);
  }
});
