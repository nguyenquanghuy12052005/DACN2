# Lab API contracts — backend and Gateway

Updated: 2026-10-30. Backend contract and Gateway M1-04 health/event behavior
are implemented and verified locally. User Gateway restart is needed to load
the new source; execution evidence and scope limits are at the end.

## Boundary and identity

The backend is an isolated lab workload. `studentCode` is a caller-supplied synthetic participant identifier, not a verified student identity. No real student data, account authentication, or production authorization is implemented. Bind the local server to loopback. Before networked deployment, explicitly design trusted identity/authorization and network access controls; gateway bot detection is not authentication.

## Read operations

- `GET /health`: 200 with service status.
- `GET /courses`: 200, array of `{ id, code, name, capacity, registeredCount, availableSeats }`.
- `GET /courses/:id`: 200 with the same course summary; 400 for invalid ID, 404 for missing course.
- IDs in paths must be positive decimal safe integers (maximum 9007199254740991). IDs in JSON responses are strings to preserve PostgreSQL BIGINT representation.

## Register

`POST /courses/:id/registrations`, `Content-Type: application/json`.

```json
{ "studentCode": "DEMO001" }
```

The body must be an object with exactly `studentCode`, a string matching `[A-Za-z0-9_-]{1,30}`. Normalize to uppercase; do not trim whitespace silently. Invalid bodies/IDs return 400 before any database mutation.

201 response:

```json
{ "id": "1", "courseId": "1", "studentCode": "DEMO001" }
```

- 404: `COURSE_NOT_FOUND`.
- 409: `ALREADY_REGISTERED` (including when the course is now full).
- 409: `COURSE_FULL`.
- Domain errors include `{ statusCode, code, message }`. Validation errors use Nest's standard 400 shape. Unexpected database failures remain 500 and must roll back.
- A retry after a committed registration returns 409; there is no idempotency-key protocol in this slice.

## Consistency and acceptance

All writers lock the course row with `SELECT ... FOR UPDATE` before checking duplicates/capacity. Insert and counter increment run on the same checked-out PostgreSQL client in one transaction. Unique `(course_id, student_code)` and capacity CHECK constraints remain enabled. Rollback must undo both mutations, and pooled clients must always be released. Local transaction lock/statement timeouts bound waits.

Acceptance: valid registration persists once; malformed input, absent course, duplicate, and full capacity leave no mutation. Concurrent distinct participants cannot oversubscribe; concurrent duplicate requests produce one registration/counter increment. An injected counter-update failure rolls back the insert. Unit tests verify transaction cleanup; E2E tests verify persisted outcomes in the dedicated test database.

## Test database

E2E uses `dacn2_test`, separate from `dacn2`; Jest setup selects it before loading the application. Create this database with the existing admin role and apply migrations 001–003 once, then `backend/test/fixtures/grants.sql` (test-only grants). Never apply test grants to the demo database. The test fixture grants allow insertion/deletion of synthetic course rows for cleanup, without elevating the production application role.

E2E creates unique synthetic courses and removes only those rows and dependent registrations in `afterAll`. Do not run E2E against a database containing valuable data. Existing read tests use the seeded CS101 course.

## Gateway M1-04 — contract v1 (implemented locally)

Implemented by gateway/telemetry.go and main.go (M1-04b). Listener remains local HTTPS
127.0.0.1:8443. No inference, rate limiting, metrics exporter or database writes
are introduced by this contract. Request telemetry is separate from the existing
TLS/JA4 and H2 observation messages.

### Gateway-owned health

- Exact decoded path `/gateway/health`, without trailing slash, is reserved by
  Gateway. Query parameters do not change routing and are never logged.
- `GET /gateway/health`: HTTP200, Content-Type `application/json`, body:

```json
{"status":"ok","service":"dacn2-gateway"}
```

- `HEAD` returns the same status/representation headers, without response body.
- Other methods on this exact path: HTTP405, `Allow: GET, HEAD`, fixed body
  `Method not allowed\n` (text/plain). No upstream attempt for any method here.
- This is process liveness: no backend/DB/inference calls, no runtime secrets or
  infrastructure details. Backend downtime must not make this endpoint fail.
- `/health` continues to proxy unchanged to backend; its success is distinct from
  Gateway liveness. `/gateway/health/` is not a local health alias; it proxies.
- Every local health request is still logged, with `route_kind=gateway_local`.
  It must be excluded from future workload/admitted-RPS aggregation.

### Request ID and connection correlation

- Gateway generates an ID per accepted HTTP request: startup-random 16-byte hex
  prefix plus `-` plus a process-wide increasing positive integer (max64 chars).
  Startup randomness failure is an explicit startup error, not a silent fallback.
- Client-provided `X-Request-ID` is not trusted: replace it on the request sent
  upstream and on the response header with the generated ID. No auth meaning.
- Event `request_id`, outbound `X-Request-ID` and response `X-Request-ID` agree.
  Local health and error responses also get this response header when headers can
  still be written. Each request on the same connection gets its own ID.
- `connection_id` is the existing listener-assigned positive integer, shared with
  that connection's H2 observation. Obtain it from server connection context;
  missing context is null, not zero or a fabricated IP-derived ID.
- IDs are local process identifiers; no cross-process/global client identity claim.
  This slice does not retrofit JA4 log correlation or create a client/session store.

### Request completion JSON event

Exactly one `gateway_request` event per HTTP request that enters Gateway's handler,
on normal return, proxy error, client cancellation or response abort/panic. TLS
handshake failures and requests rejected before the handler have no such event;
existing server error diagnostics remain the source for those failures.

Each event line is one JSON object without a text timestamp prefix. Existing
startup/TLS/H2 diagnostics may remain text; consumers select `event` and `schema_version`.
Required fields (nullable fields are present as null when unknown):

- `schema_version`: integer1; `event`: constant `gateway_request`.
- `request_id`: generated ID; `connection_id`: integer or null.
- `started_at`, `completed_at`: UTC RFC3339Nano timestamps; `latency_ms`: finite
  nonnegative number measured by Go's monotonic elapsed clock, not wall-clock subtraction.
  Latency covers handler entry through completion/abort, including upstream wait
  and body copy; it excludes TCP/TLS setup and is not an upstream-only metric.
- `client_ip`: normalized TCP peer IP (IPv4-mapped IPv6 unmaps to IPv4), no port;
  null if invalid/unavailable. `client_ip_source`: `tcp_peer` or `unavailable`.
  Ignore X-Forwarded-For, Forwarded and X-Real-IP for identity; strip them on the
  outbound request and generate X-Forwarded-For from the actual peer only.
  Direct local topology only: introducing a trusted proxy requires a new contract.
- `method`: one of GET/HEAD/POST/PUT/PATCH/DELETE/OPTIONS/CONNECT/TRACE/OTHER;
  OTHER represents any other method token without retaining arbitrary client text.
- `route`: bounded route template: `/gateway/health`, `/health`, `/courses`,
  `/courses/:id`, `/courses/:id/registrations`, or `unknown`. For course templates,
  match path shape without recording ID values, including invalid-ID attempts.
  No raw path, query, Host, User-Agent, headers, request/response body or studentCode.
- `route_kind`: `gateway_local` for reserved health path; otherwise `upstream`.
- `upstream_attempted`: boolean, true only once transport RoundTrip is actually
  invoked for this request. False for local health or failure before transport.
  This does not prove network delivery, backend success or admitted/forwarded RPS.
- `upstream_status`: final response status returned by RoundTrip, or null when no
  response was obtained; backend4xx/5xx remain ordinary upstream responses.
- `status_code`: final HTTP status actually committed to the client, or null if
  no final headers were committed. Ignore informational1xx (except protocol-switch101) when recording final
  status; implicit body write commits200. A failed upstream attempt returning
  Gateway502 has upstream_status=null/status_code=502.
- `response_bytes`: number of body bytes successfully written through the response
  writer, excluding headers; count returned n, not requested buffer length.
  HEAD/local errors/partial writes must have truthful counts.
- `outcome`: `gateway_local`, `upstream_response`, `proxy_error`, `client_canceled`,
  `response_aborted` or `handler_panic`; `error_code`: null or enum below.

Illustrative event, not execution evidence; numbers are example values:

```json
{
  "schema_version": 1,
  "event": "gateway_request",
  "request_id": "0123456789abcdef0123456789abcdef-1",
  "connection_id": 3,
  "started_at": "2026-10-30T08:44:35Z",
  "completed_at": "2026-10-30T08:44:35.0125Z",
  "latency_ms": 12.5,
  "client_ip": "127.0.0.1",
  "client_ip_source": "tcp_peer",
  "method": "GET",
  "route": "/courses",
  "route_kind": "upstream",
  "upstream_attempted": true,
  "upstream_status": 200,
  "status_code": 200,
  "response_bytes": 256,
  "outcome": "upstream_response",
  "error_code": null
}
```

### Proxy errors, aborts and privacy

- Default behavior remains bounded proxy-to-backend: upstream response-header
  timeout5s, existing server header/idle limits. This slice does not claim a total
  request/body timeout or add automatic retries.
- If RoundTrip fails before final response headers, current Gateway502 behavior
  remains when writing a response is still possible. Never manufacture upstream200.
- Classification precedence: canceled request context → client_canceled;
  timeout error/context deadline → upstream_timeout; dial error → upstream_dial_error;
  other transport failure → upstream_error. No raw error text in request JSON.
- For proxy_error outcome, error_code is upstream_timeout/upstream_dial_error/
  upstream_error. Context cancellation uses outcome=client_canceled and
  error_code=client_canceled; do not claim delivery of a502 if none was committed.
- Body-copy/read/write failure after response headers may trigger Go's abort
  handling: outcome=response_aborted, error_code=response_aborted; keep the
  already committed status/partial bytes. Do not overwrite a committed200 with502.
  Cancellation detected at completion takes precedence over response_aborted.
- Unexpected handler panic: outcome=handler_panic/error_code=handler_panic,
  preserve committed status/bytes, log once and re-panic so net/http retains normal
  abort/recovery behavior. The re-panic value is normalized to http.ErrAbortHandler
  so net/http does not print arbitrary panic values/stacks. Original values are
  neither included in JSON nor sent to the client.
- Backend400/404/409/500 with a successfully copied response use upstream_response,
  error_code=null. Status alone must not be mistaken for a transport exception.
- Use JSON encoding for fixed/enumerated fields; no client-controlled multi-line
  content. Peer IP is restricted lab metadata, not an authenticated person or a bot
  verdict; shared IP/NAT can represent multiple clients.

### Acceptance before marking M1-04 implemented

- Gateway health GET/HEAD200/other405 works with backend offline and never calls
  RoundTrip. Backend `/health` continues proxying, failing502 when backend is down.
- H1/H2 proxy bodies/status remain correct; streaming/flush and optional response
  operations used by reverse proxy retain behavior after response-writer wrapping.
- Exactly one event and matching generated IDs, including concurrent H2 requests,
  separate IDs on a reused connection and shared H2 connection_id correlation.
- Tests cover spoofed forwarding/request-ID headers, IPv4/IPv6/invalid peer,
  known/unknown/sensitive-query paths, HEAD/no-body, upstream4xx/5xx, refused
  connection, timeout, cancellation, partial response and abort/panic paths.
- Record actual committed status/bytes and bounded nonnegative latency; don't assert
  fragile exact timing. No request-local metadata retained after request completion.
- stdout JSON event emission is synchronous like existing console logging, with no
  new unbounded queue/client map. Output blocking can affect latency; no throughput
  or lossless-persistence claim. Future bounded export/drop accounting is a later task.
- Run gofmt/vet/full Go tests/race/build and controlled local smoke, then update
  evidence. Contract-only M1-04a did not prove runtime behavior; M1-04b evidence follows.

### M1-04b verification — 2026-10-30

- Implemented telemetry.go, telemetry_test.go and main.go wiring. JSON request
  events are written on stdout without the normal logger's timestamp prefix.
- gofmt/vet/full Go tests/race/build PASS. Additional streaming-delivery and
  real client-cancellation tests subsequently passed with race detector.
- Tests use fake transports and real isolated HTTP/TLS loopback servers. H1/H2
  reuse/concurrent requests retain unique IDs and connection_id/H2 correlation;
  forwarding/request-ID spoofing, routes/IPv6/invalid-peer/privacy, statuses,
  timeout/refusal/cancel/body abort/panic/partial write/HEAD/103 and flush covered.
- Compiled source copy (only listen/upstream port changed) smoke: localGET/HEAD200,
  POST405, proxy200, backend-down local200/proxy502, backend recovery200. Exactly8
  completion events, trusted IDs/peer and no sensitive query/header strings.
- Evidence ignored .local-backups/telemetry-smoke-1793351019191/result.json,
  gateway.stdout.log/gateway.stderr.log. Test Gateway18443/backend were stopped;
  user's8443/3000/DB untouched. TLS keylogging disabled for smoke child.
- No performance/load/production/cluster claim. Normal course/health HTTP request
  response scope tested; upgraded protocol tunnels and detached/hijacked-connection
  byte accounting are not validated. response_bytes counts body writes through the
  wrapped response writer, not raw writes after a connection is hijacked.
