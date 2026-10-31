# Dashboard data mapping — UI-00

## UI-03b current direct-browser override — 2026-10-31

Supersedes the earlier proxy slice below. New live sessions send fetch directly
from Chrome to https://127.0.0.1:18444; Vite5173 hosts frontend/SSE observation
only. API /api/live/courses is disabled404 in direct mode. Request path:
Chrome→HTTPS Gateway→native NestJS13001→dacn2_test. Native/K3s distinction remains.
No backend/AI change. Gateway has opt-in CORS/session/fixture boundary, per current
API_CONTRACT. Direct GET response includes existing base courses; frontend filters
owned fixture IDs from server-injected metadata. Gateway enforces allowed write IDs.

Runner injects fixed Gateway origin, ephemeral token and fixture IDs into local
HTML metadata, not into compiled frontend or log. No cookies/credentials on fetch.
CORS exposes real generated request ID, connection ID and negotiated HTTP request
protocol. These values are shown in registration result and request journal.

Certificate handling is explicit lab-only: existing gateway/cert.pem/key.pem
preserved. Runner verifies validity dates and127.0.0.1 SAN, computes SHA256 SPKI.
Normal startup opens installed Chrome using a fresh ignored session profile and
--ignore-certificate-errors-spki-list for ONLY that key. This is scoped certificate
error exception/pinning, not system/root trust or production certificate validation.
No --ignore-certificate-errors, browser web-security disable, Windows trust store
change or main Chrome profile change. Use the opened Chrome lab window; normal
Chrome may reject self-signed cert. --no-browser for automated/headless runs.

Adapter consumes structured gateway_tls/gateway_h2/request JSON. Bounded128-entry
connection map; only connections referenced by retained workload events exposed.
Snapshot transport=direct-browser, connections[{connectionId,ja4,h2{status,akamai,
reason}}]. H2 reason/null preserved. Requests include actual protocol. Correlation
is process session+connection_id, never adjacency/IP/hash equality. No inference
that a connection/IP/fingerprint equals a distinct user/bot. Legacy JA4 list is
not used for per-request attribution. Health supervisor connections excluded from
displayed workload connections. Mock and disconnected states still never Live.

Observed proof .local-backups/ui-live/1793443487111/direct-proof.json:
HTTP/2.0 POST201, connection3, JA4 t13i1516h2_8daaf6152771_cb7bf5808d99,
H2 headers_observed/Akamai52d84b11737d980aef856699f885ca86 on same ID. Chrome CDP
observed h2 URLs directly on18444; test asserted zero Vite API proxy requests.
Fixture cleanups/hash reconciliation PASS. GUI lab Chrome launch session
1793443711377 independently observed actualHTTP2/JA4/H2 and cleaned on stop.

Official references inspected: [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS),
[Go TLS](https://pkg.go.dev/crypto/tls),
[Chromium scoped verifier](https://chromium.googlesource.com/chromium/src/+/HEAD/services/network/ignore_errors_cert_verifier.h).

## UI-03 current implementation override — 2026-10-31

User requested connecting Gateway/backend for an interactive demo. Implemented
optional lightweight native session, not a K3s session: browser5173 → local Vite
adapter → unchanged Go HTTPS Gateway18444 → unchanged native NestJS13001 →
Windows PostgreSQL5432/dacn2_test. Existing Pod lab/config and dacn2 remain intact.
All earlier UI-00 proposed/missing descriptions below are historical where this
section supersedes them; no AI/enforcement/autoscaler/arrival contract implemented.

`node scripts/dashboard-live.cjs` starts an owned session, inserts3 unique fixture
courses only in dacn2_test (capacities20/20/1), builds unchanged source, starts own
services and Vite plugin. Meta dacn2-live enables Live default only in this runner.
`npm run dev` remains static/mock mode. The CLI stop command or Ctrl+C closes
SSE/server/owned children and deletes only the session's course/registration rows;
records before/after demo/test hashes. Sequences may advance. No DB env edits.
Singleton session.lock prevents overlap; busy ports refused without adoption.

Adapter endpoints exist only with this runner, on exact Host127.0.0.1:5173:

- GET /api/live/courses → real GET /courses through Gateway, filtered to owned
  course IDs; fields match CourseSummary. Requires X-DACN2-UI:1.
- POST /api/live/courses/:id/registrations → real registration route, only owned
  IDs; exact studentCode body, max1024bytes/4s body read. Preserves real HTTP
  response status and Gateway X-Request-ID. No automatic POST retries.
- GET /api/live/snapshot → current sanitized full snapshot.
- GET /api/live/events → SSE full snapshots every1s, max4 viewers, slow viewers
  disconnected. No unbounded delta queue/cursor. Snapshot reconnect resyncs all
  retained events, keyed by sessionId/request_id; transport disconnect makes UI
  unavailable, never mock. Client retries1→30s and watchdog15s without updates.

No arbitrary targets, file paths or commands accepted. Foreign Origin/cross-site
requests rejected; writes need custom UI header, preventing cross-origin form
submission. API actions capped30per10s and8concurrent. Fixed local trusted-account
lab boundary only, not multi-user authentication. Credential/admin files never
enter Vite client. TLS uses configured cert CA plus fingerprint verification,
not rejectUnauthorized:false. No Gateway CORS/static changes needed in proxy mode.

Snapshots: source=live/schemaVersion1/sessionId/observedAt/captureStartedAt;
healthAt/gatewayHealth/backendHealth sampled every5s; readyPods=null (native mode);
events last300 with template route/status/monotonic latency/request ID/connection
ID/session-hashed peer; no studentCode, raw IP, headers or body. JA4 list max30,
session observations only, explicitly proxy signatures not browser identities.
No H2/Akamai or per-client JA4 association is inferred from text adjacency.
Unknown/oversize log lines are skipped/counted, input line buffer64KiB.

Derived metrics: completedRps counts finished course-route events in last closed
1s bucket; p95Ms nearest-rank in last closed5s/sampleCount, null if empty; response
errors included, health excluded. Series max30 closed1s buckets, never backfills
zeros before capture start. Pending buckets and arrival/admission/blocked signals
remain unavailable; no claim of M2 windows. Retention/drop counter shown in journal
means figures cover retained observed data, not guaranteed lifetime totals.

Interactive result shows real201/409/400/etc, Gateway ID and separate browser
elapsed time. Disconnected UI disables submission; uncertain write outcome does
not trigger retry. Fixture rows persist until session stop. UI Simulation remains
disabled. Native mode shown in banner/topology/layers; no fake Ready Pod or defense.

Date: 2026-10-31. Status: source audit complete; UI-01 static frontend implemented;
proposed UI adapter NOT IMPLEMENTED. Dashboard fixtures are synthetic design samples,
not the recorded M1 evidence. Live mode intentionally displays no fixture values.
Sources: original glass dashboard spec, API_CONTRACT.md, FEATURE_SPEC.md,
gateway/main.go, telemetry.go, h2_live.go, config.go, backend/src, Kubernetes
manifest and lab scripts. Current evidence: .local-backups/m105h/1793436025955/
result.json and gateway.log (PASS, 82.57s, 20 events). This is recorded evidence,
not a newly polled Live source. No services started or load generated by UI-00.

## Existing HTTP operations

Browser-facing Gateway: HTTPS loopback 8443 for manual use; automated demo uses
18443. Gateway upstream for Pod lab is HTTP127.0.0.1:13000, published to Service
30080 → backend3000. Native backend3000 is a different workflow. PostgreSQL runs
on Windows5432; it is never accessed by browser code.

- GET /gateway/health: {status,service},200; Gateway process only, not upstream/DB.
- GET /health: backend process liveness,200; does not establish ongoing DB health.
- GET /courses: CourseSummary[] with string id, code, name, capacity,
  registeredCount, availableSeats. Successful read demonstrates DB access then.
- GET /courses/:id: same summary; invalid ID400, missing404.
- POST /courses/:id/registrations: exactly {studentCode}; ASCII letters/digits/_/-,
  length1–30, uppercase normalization.201 {id,courseId,studentCode}; invalid400,
  missing404, duplicate409/ALREADY_REGISTERED, full409/COURSE_FULL.
- X-Request-ID response header: generated by Gateway; no authentication meaning.
  Cross-origin browser access to this header requires exposed-header configuration.

Client Demo uses course registration, not account signup/login. No email/password,
identity verification, cancellation/reset endpoint or registration-list API exists.
Show real response status/domain code and refresh course seats after completion.
Do not auto-retry POST: a previous committed request may return409 on retry.
Browser elapsed time is a separate measurement from gateway latency_ms.

## Real observations and proposed UI representation

No REST metrics snapshot, SSE, WebSocket, /metrics, inference, client scoring,
policy decision or simulation-control API exists in current services. The shapes
in the design spec are proposals, not routes the browser can call today.

### Request log

One JSON gateway_request schema_version1 event on handler completion. Source is
stdout; TLS/H2 diagnostics use text logging. Integration captures both into
gateway.log. Plain go run . does not persist a file automatically.

UI events list maps request_id→trace ID, connection_id→connection reference,
started_at/completed_at→UTC times, method/route→operation template,
status_code→client response, upstream_status→backend response,
outcome/error_code→result, latency_ms→Gateway handler milliseconds,
response_bytes→successfully written body bytes excluding headers.

Null status/connection/IP stays unknown.400/409 are application responses;
proxy_error502 is upstream failure, not a security block. The event stream is
not a complete TCP/TLS capture: failures before the HTTP handler are absent.

Derived UI measurements proposed for UI-03, explicitly separate from M2 ML:

- Completed workload RPS = unique completed events with route_kind=upstream in
  UTC completed_at buckets [t,t+1s), divided by1s. Show latest closed bucket,
  late-data correction and capture coverage. Do not label it Incoming RPS.
- Gateway p95 = sorted latency_ms values for valid completed workload events in
  last closed5s window; nearest-rank index ceil(.95*n)-1, ms. Empty→unavailable;
  include sample count; document errors included and no-response events separately.
- Response/error counts grouped by status and outcome. Keep application4xx,
  upstream5xx, proxy errors and cancellation separate. HTTP error ≠ blocked.
- upstream_attempted only proves RoundTrip invocation, not arrival at backend,
  successful delivery, or admitted-RPS accounting. Incoming RPS, admitted RPS,
  blocked RPS and active/in-flight requests remain unavailable pending contracts.
- Local Gateway health events excluded from workload metrics. Adapter-generated
  health probes must be identified separately, not silently inflate workload.

Adapter needs session/process namespace plus request_id for dedup; connection_id
alone restarts at process boundaries. Preserve observed time, ingestion time,
window bounds, late/missing coverage and source identity. Snapshot/deltas must
use the same cutoff/cursor; resync after gaps, don't invent missing events.

### Fingerprints and clients

- main.go logs ClientHello and four JA4 variants as text. They currently have no
  connection_id. Display session-level observations with unknown request/client
  association; never join using adjacency, matching timestamp or IP guesses.
- H2 observation has connection_id; join to request only within same captured
  Gateway process session. status/reason, SETTINGS, pseudo-header order and
  Akamai availability can be shown. Missing values remain null plus reason.
- The recorded test has headers_observed with akamai=null and
  akamai_reason=missing_window_update. This is not an observed zero/hash.
- client_ip comes from TCP peer; local clients share127.0.0.1. Neither IP nor JA4
  identifies a verified person or bot. Human/Bot split and client score unavailable.
- UI privacy: session-scoped anonymized client groups; raw IP hidden by default.
  Display fingerprint summaries only; no raw ClientHello dumps, TLS keys, cookies,
  headers, request bodies, studentCode or admin configuration in dashboard feeds.

### Health, AI and infrastructure

- Gateway and backend liveness may be polled through approved transport, proposed
  interval5s, with probe timeout and last-success timestamp. Poll failure means
  unreachable/unknown from this observer, not proof that the machine is down.
- AI class/probabilities/model version/client suspicion: unavailable until M3/M4.
  Global5s classification never substitutes for individual enforcement.
- Allow/block/challenge/rate-limit decisions: unavailable until M4 policy events.
  Animate only verified outcomes; attempted upstream≠allowed or delivered.
- Manifest desired replicas1 is configuration, not observed Ready count. Lab
  scripts query Pod state privately, but no browser infrastructure endpoint exists.
  Proposed read-only local adapter may poll namespace dacn2-lab every5s, after
  separate review. No admin kubeconfig in frontend; no scale commands in viewer.
- Autoscale history, Prometheus/Grafana and resource stream: not implemented.
  C_work319req/s is a historical measurement for a specific GET profile, not Live.

## Modes, timing and animation contract (proposed)

- LIVE: only verified current transport; source, session, last observation and
  coverage visible. No active stream today; show Not connected. Distinguish
  healthy transport with zero events from missing stream. No synthetic fallback.
- REPLAY: recorded sanitized evidence, original timestamp + playback position,
  pause/speed/seek. Advancing replay never refreshes Live status.
- MOCK DESIGN: isolated deterministic fixtures labeled SIMULATED DATA on every
  page/chart; default for UI-01 previews, clearly chosen by user.
- Proposed1Hz chart cadence, ≤10min/600 points per1s series, events≤300 rows,
  bounded dedup/ingestion buffers and overflow/drop counters. Health polling5s,
  stale after15s without successful observation; log silence alone is not failure
  once a transport heartbeat exists. No heartbeat yet means unknown connectivity.
- Disconnect freezes Live counters/pulses, shows age, retries bounded backoff
  (1,2,4,8,16,30s with jitter) and resync. Invalid/unknown schemas count as skipped;
  no guessed zeros or permanent memory growth.
- Flow is labeled Visualized sample of traffic. Initially neutral client source;
  no human/bot attribution from script tool or AI class. Completion telemetry
  produces retrospective activity, not claimed real-time request receipt.
- Max40 active pulses desktop/15 mobile, single SVG/Canvas overlay, transform/
  opacity motion, pause offscreen, reduced-motion alternative. Scale chips change
  only after observed status, blocked pulses terminate only on enforcement event.

## Integration gaps to resolve before Live

1. Browser transport: no enableCors in backend/main.ts and no Gateway CORS/static
   serving. Vite frontend is another origin. POST JSON requires preflight;
   TLS lab trust also needs browser verification. Don't disable web security.
2. Preferred browser demo path is direct HTTPS Gateway with a narrowly configured
   trusted UI origin/certificate, separately authorized in UI-03; preserves browser
   TLS fingerprint. Serving UI under Gateway origin is another reviewed option.
3. A local Vite/BFF proxy can reach Gateway without CORS but terminates browser
   connection: Gateway sees proxy TLS/IP. Label this Proxy demo mode and never
   attribute its JA4 to browser or use it as browser dataset evidence.
4. Read-only companion adapter is proposed, not installed: local fixed log source,
   allowlisted fields, snapshot/SSE, bounded buffers, local access/origin controls,
   no arbitrary file paths/commands/targets from browser. Validate source coverage
   and rotation/truncation. No control API bundled into read-only viewer.
5. Real signup writes: manual requests on dacn2 persist by design. First integration
   should target an explicitly isolated test-backed lab session with owned fixture
   setup/cleanup; browser never selects DB or receives DB credentials. Existing
   integration temporarily switches DB and must not run alongside an interactive
   session. No reset/delete button without a new reviewed contract.
6. Simulation UI starts disabled. UI-04/M2 require supervised server controller,
   fixed owned loopback target, authentication/origin protection, singleton,
   RPS/concurrency/duration/resource caps, stop-on-disconnect policy, kill switch,
   child cleanup and audit. Existing benchmark is not an authenticated web API.
   Initial ceiling must not exceed existing400RPS/32inflight/180s and must be
   re-evaluated for mixed/write workload and dashboard resource use. No load now.

## UI-00 verification and next gate

Source references and recorded evidence reviewed; no frontend/package/AI service
exists, no new runtime checks executed. Original spec references a screenshot
not supplied as a design asset in this task; use its written visual direction.
UI-01 can build design system/static states without resolving Live blockers.
UI-03 requires explicit contract/transport review before service changes.
