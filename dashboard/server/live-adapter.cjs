const { createHash } = require('node:crypto');

// Local development adapter only. No targets, filenames or commands from HTTP.
function createLiveAdapter({
  sessionId,
  fixtureIds,
  requestGateway,
  captureStartedAt = Date.now(),
  directConfig = null,
}) {
  const events = [],
    fingerprints = [],
    clients = new Set();
  let pending = '',
    discarded = 0,
    active = 0,
    accepting = true;
  let gatewayHealth = null,
    backendHealth = null,
    healthAt = null;
  let rateStart = Date.now(),
    rateCount = 0;
  const ids = new Set(fixtureIds.map(String));
  const connections = new Map();
  function connection(id) {
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    if (!connections.has(id)) {
      connections.set(id, { connectionId: id, ja4: null, h2: null });
      if (connections.size > 128)
        connections.delete(connections.keys().next().value);
    }
    return connections.get(id);
  }
  function ingest(chunk) {
    pending += chunk.toString();
    if (pending.length > 65536) {
      pending = '';
      discarded++;
      return;
    }
    let newline;
    while ((newline = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, newline).trim();
      pending = pending.slice(newline + 1);
      if (line.startsWith('{')) {
        try {
          const e = JSON.parse(line);
          if (
            e.event === 'gateway_tls' &&
            e.schema_version === 1 &&
            /^[a-z0-9_]{1,100}$/.test(e.ja4 || '')
          ) {
            const c = connection(e.connection_id);
            if (c) c.ja4 = e.ja4;
            continue;
          }
          if (e.event === 'gateway_h2' && e.schema_version === 1) {
            const c = connection(e.connection_id);
            if (c)
              c.h2 = {
                status: [
                  'headers_observed',
                  'incomplete',
                  'invalid',
                  'observation_unavailable',
                ].includes(e.status)
                  ? e.status
                  : 'unknown',
                akamai: /^[a-f0-9]{32}$/.test(e.akamai?.md5 ?? '')
                  ? e.akamai.md5
                  : null,
                reason: /^[a-z_]{1,60}$/.test(e.akamai_reason || e.reason || '')
                  ? e.akamai_reason || e.reason
                  : null,
              };
            continue;
          }
          if (e.event !== 'gateway_request' || e.schema_version !== 1) continue;
          if (
            typeof e.request_id !== 'string' ||
            !/^[a-f0-9]{32}-\d+$/.test(e.request_id) ||
            !Number.isFinite(Date.parse(e.completed_at)) ||
            !Number.isFinite(e.latency_ms) ||
            e.latency_ms < 0
          ) {
            discarded++;
            continue;
          }
          if (
            ![
              '/courses',
              '/courses/:id',
              '/courses/:id/registrations',
            ].includes(e.route)
          )
            continue; // exclude health probes
          if (events.some((x) => x.id === e.request_id)) continue;
          events.push({
            id: e.request_id,
            time: e.completed_at,
            method: ['GET', 'POST'].includes(e.method) ? e.method : 'OTHER',
            route: e.route,
            status: Number.isInteger(e.status_code) ? e.status_code : null,
            latencyMs: e.latency_ms,
            result:
              e.outcome === 'proxy_error'
                ? 'Lỗi chuyển tiếp'
                : 'Backend phản hồi',
            connectionId: Number.isInteger(e.connection_id)
              ? e.connection_id
              : null,
            protocol: ['HTTP/2.0', 'HTTP/1.1', 'HTTP/1.0'].includes(e.protocol)
              ? e.protocol
              : 'unknown',
            clientKey: createHash('sha256')
              .update(sessionId + String(e.client_ip))
              .digest('hex')
              .slice(0, 10),
          });
          if (events.length > 300) {
            events.shift();
            discarded++;
          }
        } catch {
          discarded++;
        }
      } else {
        const m = line.match(/\bJA4: ([a-z0-9_]{1,100})$/);
        if (m && !fingerprints.includes(m[1])) {
          fingerprints.push(m[1]);
          if (fingerprints.length > 30) fingerprints.shift();
        }
      }
    }
  }
  function snapshot(now = Date.now()) {
    const end = Math.floor(now / 1000) * 1000;
    const recent = events.filter(
      (e) => Date.parse(e.time) >= end - 5000 && Date.parse(e.time) < end,
    );
    const latencies = recent.map((e) => e.latencyMs).sort((a, b) => a - b);
    return {
      schemaVersion: 1,
      source: 'live',
      sessionId,
      observedAt: new Date(now).toISOString(),
      captureStartedAt: new Date(captureStartedAt).toISOString(),
      transport: directConfig ? 'direct-browser' : 'proxy',
      backendMode: 'native-test-db',
      database: 'dacn2_test',
      gatewayHealth,
      backendHealth,
      healthAt,
      readyPods: null,
      completedRps:
        end - 1000 < captureStartedAt
          ? null
          : events.filter(
              (e) =>
                Date.parse(e.time) >= end - 1000 && Date.parse(e.time) < end,
            ).length,
      p95Ms: latencies.length
        ? latencies[Math.ceil(0.95 * latencies.length) - 1]
        : null,
      sampleCount: recent.length,
      events: [...events].reverse(),
      fingerprints: [...fingerprints],
      connections: [...new Set(events.map((e) => e.connectionId))]
        .map((id) => connections.get(id))
        .filter(Boolean),
      discarded,
      series: Array.from(
        {
          length: Math.max(
            0,
            Math.min(30, Math.floor((end - captureStartedAt) / 1000)),
          ),
        },
        (_, i) => {
          const count = Math.max(
            0,
            Math.min(30, Math.floor((end - captureStartedAt) / 1000)),
          );
          const t = end - (count - i) * 1000;
          return {
            time: new Date(t).toISOString(),
            value: events.filter(
              (e) => Date.parse(e.time) >= t && Date.parse(e.time) < t + 1000,
            ).length,
          };
        },
      ),
    };
  }
  async function probe() {
    const check = async (route) => {
      try {
        return (await requestGateway('GET', route)).status === 200;
      } catch {
        return false;
      }
    };
    [gatewayHealth, backendHealth] = await Promise.all([
      check('/gateway/health'),
      check('/health'),
    ]);
    healthAt = new Date().toISOString();
  }
  function deny(res, status, message) {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify({ message }));
  }
  async function middleware(req, res, next) {
    if (!req.url?.startsWith('/api/live/')) return next();
    if (!accepting) return deny(res, 503, 'Phiên demo đang dừng.');
    if (
      req.headers.host !== '127.0.0.1:5173' ||
      (req.headers.origin && req.headers.origin !== 'http://127.0.0.1:5173') ||
      req.headers['sec-fetch-site'] === 'cross-site'
    )
      return deny(res, 403, 'Chỉ cho phép giao diện local.');
    const url = new URL(req.url, 'http://127.0.0.1:5173');
    if (url.search) return deny(res, 400, 'Không hỗ trợ tham số.');
    if (req.method === 'GET' && url.pathname === '/api/live/snapshot') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      return res.end(JSON.stringify(snapshot()));
    }
    if (req.method === 'GET' && url.pathname === '/api/live/events') {
      if (clients.size >= 4)
        return deny(res, 429, 'Tối đa 4 kết nối quan sát.');
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
        'X-Content-Type-Options': 'nosniff',
      });
      clients.add(res);
      res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (directConfig)
      return deny(
        res,
        404,
        'API đăng ký đã chuyển sang HTTPS Gateway trực tiếp.',
      );
    const path = url.pathname.slice('/api/live'.length);
    const match = path.match(/^\/courses\/([1-9][0-9]*)\/registrations$/);
    if (
      !(req.method === 'GET' && path === '/courses') &&
      !(req.method === 'POST' && match && ids.has(match[1]))
    )
      return deny(res, 404, 'Chỉ cho phép API và môn thử của phiên.');
    if (req.headers['x-dacn2-ui'] !== '1')
      return deny(res, 403, 'Thiếu mã nguồn yêu cầu giao diện.');
    if (Date.now() - rateStart >= 10000) {
      rateStart = Date.now();
      rateCount = 0;
    }
    if (++rateCount > 30 || active >= 8)
      return deny(res, 429, 'Đã đạt giới hạn thao tác demo.');
    active++;
    try {
      let body;
      if (req.method === 'POST') {
        let size = 0;
        const chunks = [];
        req.setTimeout(4000, () => req.destroy());
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 1024) return deny(res, 413, 'Nội dung quá lớn.');
          chunks.push(chunk);
        }
        try {
          body = JSON.parse(Buffer.concat(chunks).toString());
        } catch {
          return deny(res, 400, 'JSON không hợp lệ.');
        }
        if (
          !body ||
          typeof body !== 'object' ||
          Object.keys(body).length !== 1 ||
          typeof body.studentCode !== 'string' ||
          !/^[A-Za-z0-9_-]{1,30}$/.test(body.studentCode || '')
        )
          return deny(res, 400, 'Mã người tham gia không hợp lệ.');
      }
      const result = await requestGateway(req.method, path, body);
      let payload = result.body;
      if (req.method === 'GET') {
        if (!Array.isArray(payload)) throw Error('Invalid course response');
        payload = payload
          .filter((c) => ids.has(String(c.id)))
          .map((c) => ({
            id: String(c.id),
            code: c.code,
            name: c.name,
            capacity: c.capacity,
            registeredCount: c.registeredCount,
            availableSeats: c.availableSeats,
          }));
      }
      res.writeHead(result.status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Request-ID': result.requestId || '',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(JSON.stringify(payload));
    } catch {
      if (!res.headersSent)
        deny(
          res,
          502,
          'Không nhận được phản hồi từ Gateway. Không tự gửi lại đăng ký.',
        );
    } finally {
      active--;
    }
  }
  let interval,
    probing = false;
  return {
    ingest,
    snapshot,
    middleware,
    probe,
    plugin: {
      name: 'dacn2-local-live',
      transformIndexHtml() {
        return [
          {
            tag: 'meta',
            attrs: { name: 'dacn2-live', content: '1' },
            injectTo: 'head',
          },
          ...(directConfig
            ? [
                {
                  tag: 'meta',
                  attrs: {
                    name: 'dacn2-gateway',
                    content: 'https://127.0.0.1:18444',
                  },
                  injectTo: 'head',
                },
                {
                  tag: 'meta',
                  attrs: { name: 'dacn2-session', content: directConfig.token },
                  injectTo: 'head',
                },
                {
                  tag: 'meta',
                  attrs: {
                    name: 'dacn2-fixtures',
                    content: fixtureIds.join(','),
                  },
                  injectTo: 'head',
                },
              ]
            : []),
        ];
      },
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          middleware(req, res, next).catch(() => {
            if (!res.headersSent) deny(res, 500, 'Lỗi bộ nối.');
            else res.end();
          });
        });
      },
    },
    start() {
      let tick = 0;
      interval = setInterval(() => {
        if (tick++ % 5 === 0 && !probing) {
          probing = true;
          probe().finally(() => {
            probing = false;
          });
        }
        for (const client of clients)
          if (!client.write(`data: ${JSON.stringify(snapshot())}\n\n`)) {
            client.end();
            clients.delete(client);
          }
      }, 1000);
    },
    close() {
      accepting = false;
      clearInterval(interval);
      for (const client of clients) client.end();
      clients.clear();
    },
  };
}
module.exports = { createLiveAdapter };
