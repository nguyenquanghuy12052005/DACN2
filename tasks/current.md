# Current milestone

Updated: 2026-10-30 (Asia/Bangkok).
Phase: M1 deployment preflight; local Gateway extraction/telemetry complete; hosted M0 CI evidence pending.
Task type: session handoff/documentation only; user requested stopping on 2026-10-30. M1-05b complete; M1-05c not started, awaiting next scope selection.
Stop checkpoint: preserve all modified/untracked work; no commit/push or runtime changes. Next proposed M1-05c is backend Dockerfile/configurable HOST plus bounded single-container health/readDB smoke, without cluster installation. Explain task purpose/scope and wait for user choice before resuming; show edit locations and explain verification when implementing. Historical PASS evidence below was not rerun for this documentation-only checkpoint.
Latest M1-05b (2026-10-30): actual container DNS/TCP/SCRAM app authentication/read-only SELECT PASS on both Windows DBs via host.docker.internal:5432. Server sees peer127.0.0.1; no HBA/firewall/hosts/env changes needed. Demo5/3,test5/0,sslfalse; bounded non-root cached-image probes removed, original DBcontainerstopped/volume intact. Pod path/memory/version readiness remain. Evidence and next proposed M1-05c backend container prep in ARCHITECTURE/PROGRESS; no app source/tests/newimages/cluster/commit/push.
Latest M1-05a (2026-10-30): RAMfree3.21–3.32GiB/15.77GiB, Docker/WSL running with no active containers, no k3d/cluster manifests/context. NativePG17.8 listen*5432/ssloff; loopback app loginPASS, inspectedHBAloopbackSCRAM. Existing distro DNS host alias points to addressnotoncurrentWindows; TCPprobe fails there and to verifiedWSLhostgateway. Rootcause/container/Pod authentication unverified. Detailed proposal/evidence/primary refs in ARCHITECTURE.md and ignored .local-backups/m105a-survey-20261030.json. No installs/containers/config changes. Next proposed M1-05b DB-path probe with disposable container, only after user scope choice; overall M1-05 incomplete.
User-run M1-04 confirmation (2026-10-30 16:08–16:09): four events IDs1..4/shared connection1; local health200/no upstream and proxied health200/attempted true, errornull, truthful bytes/latency; screenshot service dacn2-gateway200. Original user Gateway restarted. Response X-Request-ID header not shown (query param in screenshot is not the response header); no reason to infer missing header. No code/test/runtime changes this evidence turn. Next proposed M1-05a topology/resources/connectivity audit only, after user choice; no cluster installed.
Latest M1-04b (2026-10-30): telemetry.go/tests and main.go wiring implemented per contract. Own healthGET/HEAD200/other405, generated IDs/trustedpeer/forwarding sanitization,18field JSON completion/status/bytes/monotoniclatency, transport errors/cancel/abort/panic. gofmt/vet/full tests/race/build PASS; added real streaming/cancel targeted tests race PASS. Controlled compiled-copy backend down/recovery smoke8requests/8events PASS; no user server/DB changes or commit/push. User Gateway restart/manual check next, then user chooses new scope. Details in PROGRESS/API_CONTRACT.
Latest M1-04a (2026-10-30): Gateway telemetry/health contract specified in docs/API_CONTRACT.md, measurement/window boundaries in FEATURE_SPEC.md and decision in ARCHITECTURE.md. Exact local /gateway/health GET/HEAD200/other405, generated request IDs, socket peer boundary, completion JSON status/bytes/monotoniclatency, proxy errors/cancel/abort/panic and regression criteria defined. Contract-only, NOT_IMPLEMENTED; no app tests/runtime changes. Next proposed M1-04b implementation after user scope choice. M1-03 remains local-scope DONE.
Current closure (2026-10-30): M1-03 local TLS/TCP extraction DONE. User restarted15:44:35 and supplied all four JA4 variants plus H2/Akamai event; Node SHA256 independently matches sorted/original raw fields. Fixtures, errors/limits/race tests, offline JA4 capture checks and same-session Chrome H2 metadata/hash comparison are recorded. Older runtime/remaining-variant notes below are historical. Next proposed M1-04a request telemetry/health contract, after user choice. Whole M1/12-feature pipeline/cluster still incomplete; certificate trust failures remain explicit.
Latest M1-03i (2026-10-30): JA4_r/JA4_o/JA4_ro implemented/logged with shared helpers, published FoxIO four-variant fixtures and GREASE/order/empty/signature/nonmutation tests PASS. FoxIO SHA c6469a7b0dbf8fe963810162429fbfd9d1acc4d5 pinned in FEATURE_SPEC.md. Offline saved-capture JA4/JA4_r matched TShark; original variants matched independent Node calculation. gofmt/vet/all tests/race/build PASS. User Gateway not restarted; manual restart/four-log runtime check next before scope closure. Older missing-variants notes superseded; no traffic/DB/commit/push in this slice.
Latest M1-03h (2026-10-30): independent same-session Chrome headless capture PASS. Copy of Gateway changed only bind port18443;35packets/0drop,11decodedH2 packets,health200. TShark metadata and Node-computed Akamai text/MD5 exactly match unique same-session Gateway event; ignored result/source hashes/PCAP evidence in docs/PROGRESS.md. Own test processes stopped, temporary port released; original8443/3000 untouched. No app code or tests changed/rerun. Remaining M1-03: Gateway JA4 raw/original variants; next proposed M1-03i after user scope choice. Historical “capture/hash pending” notes below are superseded.
User-run M1-03g live evidence (2026-10-30 15:28:14): restarted Gateway emits Akamai text `1:65536;2:0;4:6291456;6:262144|15663105|0|m,a,s,p`, MD5 `52d84b11737d980aef856699f885ca86`, matching tested fixture; full H2 observation in user log, checkpoint in docs/PROGRESS.md. Same-session independent capture/hash reconciliation and JA4 raw/original variants remain; M1-03 not complete. Evidence-only turn, no new code/tests/runtime changes.
Latest M1-03g (2026-10-30): Akamai four-field serializer/MD5 added in gateway/akamai*.go and connected to live event; source references pinned in FEATURE_SPEC.md. Strict missing/unsupported metadata => null+reason. Chrome baseline expected text/hash and Firefox paper fixture, independent Node MD5 cross-check, failure/order tests, live integration assertions, gofmt/vet/full Go tests/race/build PASS. No user Gateway restart or same-session independent hash capture yet; raw/original JA4 variants also missing. User manual restart/log check next, further scope selection before new work; no commit/push. Latest checkpoint overrides older “no hash” status below.
User-run live evidence (2026-10-30): Gateway restarted; terminal15:19:14 shows headers_observed with Chrome-like SETTINGS/window/priority/pseudo-header metadata exactly matching prior independent Chrome baseline. Postman screenshot health200 confirms real proxy/backend recovery after earlier upstream3000 refusal. No new independent capture or Chrome h2/200 screenshot yet; see docs/PROGRESS.md. No code/tests/runtime changes in evidence-reading turn; Akamai/hash and JA4 variants remain incomplete.
Latest M1-03f (2026-10-30): live TLS owner integrated in main.go via h2_live.go. Bounded128 active observations, 2s idle-capable timer from first post-handshake H2 Read, mutex/exact-once cleanup and safe metadata JSON event; H1 bypass/capacity unavailable preserve proxy. Production-listener H1/H2 and saturated proxy200, silent TLS timeout preserving Read, concurrent Close, exact128/129/reuse tests PASS. gofmt/vet/full tests/race/build PASS; targeted live race rerun after admission test PASS. No restart of user Gateway/backend or real8443 smoke/capture yet; remaining live Chrome independent comparison, Akamai serialization/hash and JA4 variants. README/manual restart updated, no commit/push. Next proposed M1-03g in docs/PROGRESS.md, after user scope choice.
Latest M1-03e (2026-10-30): HPACK/CONTINUATION bounded decoding implemented in h2_frames.go, with h2_hpack_test.go and existing tests updated. golang.org/x/net v0.62.0 pinned, verified APIs/source and go mod verify. Captures pseudo-header name order through END_HEADERS, validates continuation sequence, drops transient block/decoder on termination. Caps: compressed16KiB/dynamic4096/string8192/list16KiB/128fields plus 64KiB/32frames/2s. RFC independent vectors, splits/EOF/errors/limits, real Go TLS proxy H1/H2, gofmt/vet/all tests/race PASS. No live main.go observer/admission128/idle timer or Chrome comparison/Akamai hash yet. Latest checkpoint and next proposed M1-03f in docs/PROGRESS.md; no commit/push.
Latest M1-03d (2026-10-30): bounded post-SETTINGS observer implemented/tested in gateway/h2_frames*.go; WU stream0, standalone PRIORITY and HEADERS priority kept distinct; metadata parsing stops at end of first HEADERS, records END_HEADERS. Shared 64 KiB/2s/32-frame budget; no payload buffering. Fragmentation/EOF/malformed/missing/limits tests, Go-client TLS proxy H1/H2, gofmt/vet/full Go tests/race PASS. main.go unchanged; no live observer/idle timer/128-slot owner, HPACK/pseudo-header/Akamai yet. Next proposed M1-03e HPACK/CONTINUATION, after user scope choice. Detailed teaching/checkpoint in docs/PROGRESS.md; no commit/push.
Latest M1-03c (2026-10-30): initial SETTINGS parser and fragmentation/EOF/malformed/limit/deadline tests implemented in gateway/h2_initial*.go. Test-only TLS wrapper parses real Go client SETTINGS; H1/H2 proxy health PASS. gofmt/vet/all Go tests PASS. 64-settings lab cap and 64 KiB input budget; timeout checks need future owner idle timer. main.go unchanged; no WINDOW_UPDATE/priority/HPACK/Akamai or live 32-frame/128-slot observer yet. User learning updates given throughout. M1-03 still IN_PROGRESS; next proposed slice in docs/PROGRESS.md.
Latest M1 slice (2026-10-30): M1-03a draft feature contract created; M1-03b test-only TLS wrapper feasibility PASS in gateway/observer_conn_test.go on installed Go 1.27.3. H1/H2 each proxy two health requests with expected body/status/protocol; H2 plaintext preface matches, H1 observer bypassed. gofmt/vet/all Go tests PASS with localhost access. No main.go integration, frame parser, live observer limits, Chrome comparison or Akamai hash yet. User wants explanations showing edited locations while agent works. Next proposed M1-03c: bounded frame parser with fragmentation/missing/error tests, after user scope choice. Full evidence in docs/PROGRESS.md.
Latest override (2026-10-30): local DB moved from Docker 15432 to existing Windows PostgreSQL 17 at 5432. Demo 5 courses/3 registrations and test 5 courses/0 registrations restored; both table hashes and sequence states matched Docker. App password unchanged, backend env port/example/docs updated. Owner dacn2_admin NOLOGIN/NOCREATEDB; app non-admin. ESLint/build, 8 unit/9 E2E PASS. Docker DB stopped with volume retained; compiled health/list/detail smoke PASS afterward on 3300 and smoke process stopped. Backups and evidence: .local-backups/postgres-to-windows-20261030-140813/. No extra synthetic records or API logic changes. HEAD now 1dab3c8; no remote/CI check or commit/push. Older runtime/PID/15432 handoff below is historical; use docs/PROGRESS.md first section for current state.
Handoff: M1-03/04 local verified, M1-05a audit and M1-05b actual container DB path PASS; next proposed M1-05c backend container preparation. Pod DB path not verified; host RAM tight/version pinning pending. Read latest PROGRESS; old unresolved-container notes historical. Follow teaching workflow/wait for user choice. Hosted M0 CI evidence missing; K3s not installed.
Plan: [DACN2_PROJECT_MASTER_PLAN.md](../DACN2_PROJECT_MASTER_PLAN.md).

This is the canonical execution tracker. Master-plan checklists describe planned work, not independent completion evidence. docs/PROGRESS.md is the latest session handoff, not another backlog.

## Documentation work completed

- [x] Read all six existing Markdown files and compare the plan with project guidance.
- [x] Identify stale product-definition status, inconsistent paths, and skill-routing gaps.
- [x] Align entry points, document ownership, M0 next actions, and specialist verification guidance.
- [x] Preserve unresolved scope/acceptance questions and separate lab, production, and real-user evidence.
- [x] Extract docs/PRODUCT.md and docs/REQUIREMENTS.md: product audience/value, chosen workflow, scope, requirement IDs, testable acceptance and evidence gaps. This is a working baseline, not final academic approval.

Documentation checks alone do not prove application behavior; M0-01 has separate inventory evidence in docs/ARCHITECTURE.md.

## Backend foundation evidence

- [x] User-requested simplification: five source files, one module, validation/types beside controller/service, two test suites (8 unit/9 E2E). Removed unused Hello World route; replaced its tests with health checks. Kept four useful lab endpoints and DB behavior. Previous local source/tests/docs preserved in ignored .local-backups/backend-before-simplify-20261029/; no reset or secret/DB change. Backend scope frozen to lab read/write workload; no additional business scenarios planned.

- [x] NestJS backend scaffolded under `backend/`; `GET /health` returns HTTP 200.
- [x] PostgreSQL 17 runs through Docker Compose on local port 15432 with a healthy status.
- [x] Application role `dacn2_app`, initial `courses`/`registrations` schema, and five seed courses were created through versioned SQL files.
- [x] NestJS starts with a bounded PostgreSQL connection pool and fails startup when required database configuration is unavailable.
- [x] Bugbot findings from 2026-10-29 were fixed: source layout, production entrypoint, root npm artifacts, environment example, generated-file ignores, startup rejection handling, and the production Multer advisory.
- [x] `GET /courses` reads seeded course summaries from PostgreSQL with explicit response types and unit/E2E coverage.
- [x] `GET /courses/:id` uses a parameterized query and returns explicit 400/404 errors for invalid or missing course IDs.
- [x] Migration `003_repair_course_names.sql` repairs Vietnamese seed names corrupted by the original PowerShell text pipeline; migrations containing Unicode are copied into the container as raw files before execution.

- [x] `POST /courses/:id/registrations` validates synthetic lab codes and uses a single-client transaction with course-row locking, duplicate/full checks and atomic counter updates.
- [x] Separate `dacn2_test` database; unit 8/8 and E2E 9/9 PASS including concurrent last-seat/duplicate requests and rollback. Fixtures cleaned up.

M0-03's local backend slice and M0-02b setup verification are complete. M0-04 CI/log/smoke implementation and local rehearsal are complete; hosted GitHub Actions evidence and academic requirements sign-off remain pending.

## Established direction from the master plan

- Problem: distinguish legitimate traffic surges from L7 DDoS, protect legitimate clients in Mixed Traffic, and avoid scaling from rejected load.
- Planned stack: Go Gateway; Python/FastAPI four-class ML; NestJS/PostgreSQL on K3s; Prometheus/Grafana. NestJS with Windows PostgreSQL and HTTPS Go Gateway run locally; JA4 variants, live H2/Akamai fingerprinting and request telemetry are locally verified. Inference, K3s deployment and monitoring are not implemented. Training will use Google Colab.
- Primary journey: legitimate traffic -> mixed lab traffic -> per-client mitigation and admitted-RPS scaling -> cooldown, with logs/dashboard evidence.
- Original schedule: 19/10–04/12/2026 with three named members. Actual availability, task ownership, and schedule feasibility are unverified; elapsed dates do not imply completed work.

## Next work and dependencies

M1-03/04 locally complete; M1-05a audit and M1-05b container DB probe complete. Next proposed M1-05c backend Dockerfile/configurable HOST and bounded single-container health/readDB verification, after user choice; no cluster installation automatically. Recheck RAM and pin compatible versions before later K3s trial.

- [x] Authorized pre-push ignore check after stop: .gitignore extended for TLS key logs/raw captures/Go build outputs/tsbuildinfo; 19 ignored paths and 8 required includable paths verified, candidate file paths and lightweight private-key/GitHub-token scan checked. No application tests needed for this ignore-only change; no stage/commit/push or feature work.

- [x] M1-03 diagnostic H2 capture slice: Chrome 156 headless, fresh isolated profile, loopback 8443 capture 35 packets/0 drops; TLS key log allowed TShark to decode client SETTINGS (1:65536;2:0;4:6291456;6:262144), WINDOW_UPDATE=15663105, first request pseudo-header order :method,:authority,:scheme,:path and HEADERS priority metadata (exclusive=1/dependency=0/weight=256). Health response 200. Saved pcap/JSON/observations ignored. This is an independent baseline, not a live Gateway H2 observer or Akamai fingerprint implementation. Gateway intentionally stopped after diagnostics; clear keylog env before restart. Go fmt/vet/6 JA4 subtests PASS.

- [x] M1-03 Postman independent capture slice: TShark 4.6.9/Npcap 1.88 running; NPF_Loopback capture filtered to host 127.0.0.1/TCP 8443, max 30 s/1024 KB/200 packets. Actual 49 packets, 0 dropped; ClientHello frame 4/stream 0; Postman GET health returned 200. TShark-computed JA4 t13i180900_5d04281c6031_78e6aca7449b exactly matches prior Gateway log; pcap/JSON/result local evidence retained, capture process stopped. This verifies one Postman client, not the whole M1-03 milestone.

- [x] M1-03 (local extraction scope): HTTPS/ClientHello/JA4 plus raw/original variants and FoxIO fixtures, independent Postman JA4, bounded live H2 metadata/HPACK/Akamai, failure/limit tests and same-session Chrome capture comparison verified. User runtime four-JA4 log confirmed15:44:35, raw/hash independently checked. Scope TLS-over-TCP and tested clients; not every browser/version, QUIC/DTLS, complete certificate trust or the entire M1/12-feature pipeline.
- [x] M1-04 (local HTTP lab scope): health and request/client/latency/proxy-error completion events implemented; full tests/race/build and compiled isolated backend-down/recovery smoke PASS. User restart/manual health events confirmed 2026-10-30 16:08–16:09; no production/performance/dataset/window/upgrade-tunnel claim. Evidence/limits in docs/API_CONTRACT.md and PROGRESS.md.
- [ ] M1-05: M1-05a audit DONE; M1-05b actual container→Windows DB read-only probe PASS without HBA/firewall changes. Pod path remains unverified/resource headroom tight. No cluster installed or backend Pod deployed; container prep/versions/resource gate and deployment/DB/recovery checks still required.

- [x] Storage prerequisite: Docker disk image moved via Docker Desktop to D:\DockerData\DockerDesktopWSL; pg_dump backups ignored by Git, PostgreSQL healthy and 9/9 E2E PASS after move. RAM available about 2 GB; cluster feasibility remains unverified.
- [x] M0-01 (survey): repository/dependencies, OS/CPU/RAM/disk, runtime versions, Docker/WSL and cluster-tool availability inspected read-only; evidence and conditional single-node k3d proposal in docs/ARCHITECTURE.md. Only 2.1 GB RAM available. No cluster installed or full-lab capacity proven; runtime validation remains M1-05/06.
- [ ] M0-02a (partial): PRODUCT.md and REQUIREMENTS.md extraction and backend acceptance mapping are complete; academic scope/acceptance questions remain unresolved before final MVP sign-off.
- [x] M0-02b: root README corrected, root .env.example added, backend README extended with first-time role/password/demo migrations and application-login verification. Clean source copy installed with npm ci; separate Compose project/empty volume on 25432 passed migrations, read-only ESLint/build, 8 unit/9 E2E and compiled-server smoke on 3300. Both fresh databases retained five courses/zero registrations; test server/project/volume cleaned, original PostgreSQL healthy on 15432. Evidence: docs/PROGRESS.md and ignored .local-backups/dacn2-m002b-945797ca/result.txt/checks.log. Existing Windows/Docker host used; no fresh OS installation claim.
- [x] M0-03: health, course list/detail and concurrency-safe registration verified. Contract in docs/API_CONTRACT.md; synthetic identity is local-lab only.
- [ ] M0-04 (implementation/local verification complete; hosted CI pending): one workflow .github/workflows/backend-ci.yml with Node 20.20.2/PostgreSQL 17, read-only permissions, timeout, test-only role/schema/grants, npm ci → lint without --fix → build → 8 unit/9 E2E → compiled health smoke with cleanup. Existing console LOG/ERROR conventions documented in backend/README.md, no logging framework. Exact bootstrap/smoke plus checks PASS on isolated local PostgreSQL; fixture count 5 courses/0 registrations and cleanup confirmed. YAML parsed; official action v7 refs verified/pinned. Hosted Actions NOT_RUN until workflow is committed/pushed. Build compiles TypeScript; no separate typecheck script.
- [ ] M1 onward: follow plan dependencies in small verified slices. Test TLS/H2 capture feasibility early, before bulk dataset collection.

## Open questions

- Are all 12 features, including JA4 and Akamai H2 capture, mandatory for academic acceptance? The plan lists them in MVP/M1–M2 but places complete capture in P1. Retain the 12-feature target until resolved; do not silently accept a reduced model.
- Does academic acceptance require only the reproducible lab, or also production deployment and external real-user validation? Existing production/user-validation standards remain in force for those completion claims.
- Confirm budget, actual member availability/owners, remaining schedule feasibility, lab resources, and university requirements not recorded in the plan.
- First dynamic journey implemented: course registration (list/detail -> register -> success/duplicate/full result). studentCode is caller-supplied synthetic identity; production authentication/authorization remains future work before networked deployment.
- Resolve and record an immutable upstream skill revision before implementation adoption; the routing index is not an installed pack.

## M0 acceptance and verification

- Environment audit has inspectable evidence and a feasible lab topology; unknown/unavailable tools are explicit.
- First slice has concrete inputs/outcomes, failure/security cases, dependencies, and executable verification.
- Backend starts through documented commands; health/dynamic behavior and stop/cleanup are verified.
- Relevant configured checks pass with actual output; missing checks are disclosed. Documentation alone does not satisfy M0.

## Evidence and limitations

- Reviewed Markdown and workspace inventory on 2026-10-29. Report.pdf exists but was not independently checked against the plan.
- Git HEAD and remote main confirmed at 052704e8cee8c868d43949560ecd095df67ae7f8 (backend simplification). User pushed backend changes; several docs/env example remain modified/untracked. Agent has not committed/pushed.
- Backend, Compose/PostgreSQL setup, tests, examples, CI workflow, Go HTTPS/JA4 source and ignored diagnostic captures now exist. Hosted Actions result is not recorded; Kubernetes manifests, traffic datasets and model artifacts remain absent.
- Latest verification on 2026-10-29 after simplification: read-only ESLint/build PASS, unit 8/8 PASS (one suite), E2E 9/9 PASS (one suite) on dacn2_test, compiled startup/health/list/detail/UTF-8 PASS; removed scaffold GET / returns 404. Earlier M0-02b clean-install evidence remains valid for setup: npm ci + empty isolated DB/migrations/tests passed before consolidation. No dependency change/audit in simplification. Training, load generation, Kubernetes deployment, production validation, and real-user validation: NOT_TESTED.
- Documentation verification and handoff: see docs/PROGRESS.md.

## Proposed first backend workflow

Domain: course registration demo.

Primary journey:
1. List courses.
2. View course details.
3. Submit a registration.
4. Receive a success or failure result.

First-slice acceptance:
- GET /health returns HTTP 200 when the service is running.
- Course list/detail endpoints read seeded data from PostgreSQL.
- A valid registration is persisted.
- Invalid input, missing courses, and duplicate registrations
  return explicit errors without creating invalid records.

Scope exclusions:
- Payments, email delivery, and a full account system.
- A polished frontend in the first slice.

Status: course listing/detail/registration implemented and tested locally; full protection lab remains planned.


## Demo scenarios

First complete scenario: course registration.
- List courses and view details.
- Register while seats remain.
- Reject duplicate registrations.
- Prevent registrations exceeding capacity under concurrent requests.

Additional movie-ticket/product-order scenarios are out of current scope by the user's simplification request. Course APIs are sufficient as the lab workload.

Shared protection:
- Go Gateway, telemetry, ML inference, client policy,
  admitted-RPS scaling, and monitoring.

Verification:
- Run legitimate-only and mixed lab traffic.
- Measure successful legitimate operations, false blocking,
  bot mitigation, latency, and data correctness per scenario.

Status: course backend journey implemented/tested locally and simplified. Shared protection remains planned and untested; additional business scenarios are outside current scope.
