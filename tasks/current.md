# Current milestone

Updated: 2026-10-30 (Asia/Bangkok).
Phase: M1 Gateway/TLS/JA4 implementation; hosted M0 CI evidence still pending in tracker.
Task type: session checkpoint; user explicitly requested stopping work here.
Handoff: diagnostic Chrome H2 capture PASS (35 packets/0 drop, 11 decoded H2 packets); Postman/Chrome JA4 independently matched, but live H2 observer/Akamai serialization and Gateway JA4 raw/original variants remain incomplete. Latest read-only runtime check: Gateway 8443 PID 13316 and backend 3000 PID 9432 running, no dumpcap; kept as observed. Gateway PID 10340 was stopped after earlier diagnostics; the new process's keylog env is unverified. Clear DACN2_TLS_KEYLOG before normal restart. Evidence/next steps in docs/PROGRESS.md, especially the first handoff section. No new traffic/tests/code/commit/push in checkpoint. Resume only on user request, explain purpose before small steps and wait for the user's choice. Hosted M0 CI evidence still missing from tracker.
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

M0-03's local backend slice and M0-02b setup verification are complete. M0 overall remains incomplete pending academic requirements sign-off and CI/log/smoke work.

## Established direction from the master plan

- Problem: distinguish legitimate traffic surges from L7 DDoS, protect legitimate clients in Mixed Traffic, and avoid scaling from rejected load.
- Planned stack: Go Gateway; Python/FastAPI four-class ML; NestJS/PostgreSQL on K3s; Prometheus/Grafana. NestJS/PostgreSQL and HTTPS/JA4 Go Gateway run locally; diagnostic H2 capture verified. Live H2 fingerprinting, inference, K3s deployment and monitoring are not implemented. Training will use Google Colab.
- Primary journey: legitimate traffic -> mixed lab traffic -> per-client mitigation and admitted-RPS scaling -> cooldown, with logs/dashboard evidence.
- Original schedule: 19/10–04/12/2026 with three named members. Actual availability, task ownership, and schedule feasibility are unverified; elapsed dates do not imply completed work.

## Next work and dependencies

Execution stopped at user's request on 2026-10-30. Next proposed slice, only after the user resumes and selects scope: M1-03 H2 contract/observer design and bounded capture/error handling, then implementation against the saved diagnostic baseline. Do not repeat backend/M1-01 or start dataset/K3s. Explain why each step is needed before giving commands; the user is learning Wireshark. Existing evidence remains below; this checkpoint ran no application tests.

- [x] Authorized pre-push ignore check after stop: .gitignore extended for TLS key logs/raw captures/Go build outputs/tsbuildinfo; 19 ignored paths and 8 required includable paths verified, candidate file paths and lightweight private-key/GitHub-token scan checked. No application tests needed for this ignore-only change; no stage/commit/push or feature work.

- [x] M1-03 diagnostic H2 capture slice: Chrome 156 headless, fresh isolated profile, loopback 8443 capture 35 packets/0 drops; TLS key log allowed TShark to decode client SETTINGS (1:65536;2:0;4:6291456;6:262144), WINDOW_UPDATE=15663105, first request pseudo-header order :method,:authority,:scheme,:path and HEADERS priority metadata (exclusive=1/dependency=0/weight=256). Health response 200. Saved pcap/JSON/observations ignored. This is an independent baseline, not a live Gateway H2 observer or Akamai fingerprint implementation. Gateway intentionally stopped after diagnostics; clear keylog env before restart. Go fmt/vet/6 JA4 subtests PASS.

- [x] M1-03 Postman independent capture slice: TShark 4.6.9/Npcap 1.88 running; NPF_Loopback capture filtered to host 127.0.0.1/TCP 8443, max 30 s/1024 KB/200 packets. Actual 49 packets, 0 dropped; ClientHello frame 4/stream 0; Postman GET health returned 200. TShark-computed JA4 t13i180900_5d04281c6031_78e6aca7449b exactly matches prior Gateway log; pcap/JSON/result local evidence retained, capture process stopped. This verifies one Postman client, not the whole M1-03 milestone.

- [ ] M1-03 (in progress): HTTPS/ClientHello/JA4 implementation and FoxIO fixtures exist; independent Postman JA4 capture verified, user showed matching Chrome headful JA4 and DevTools h2/200. Agent diagnostic Chrome H2 capture now decoded successfully. Remaining: Gateway raw/original JA4 outputs; define/implement bounded live H2 frame observer and Akamai serialization/hash, verify error/missing handling and compare against capture. Do not mark complete from diagnostic key logging alone.

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
