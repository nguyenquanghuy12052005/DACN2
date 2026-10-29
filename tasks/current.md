# Current milestone

Updated: 2026-10-29 (Asia/Bangkok).
Phase: M0 environment/bootstrap.
Task type: backend foundation in progress.
Handoff: implementation stopped at the user's request on 2026-10-29; see docs/PROGRESS.md for resume commands and exact next slice.
Plan: [DACN2_PROJECT_MASTER_PLAN.md](../DACN2_PROJECT_MASTER_PLAN.md).

This is the canonical execution tracker. Master-plan checklists describe planned work, not independent completion evidence. docs/PROGRESS.md is the latest session handoff, not another backlog.

## Documentation work completed

- [x] Read all six existing Markdown files and compare the plan with project guidance.
- [x] Identify stale product-definition status, inconsistent paths, and skill-routing gaps.
- [x] Align entry points, document ownership, M0 next actions, and specialist verification guidance.
- [x] Preserve unresolved scope/acceptance questions and separate lab, production, and real-user evidence.

These checks do not complete M0-01 or prove that application behavior works.

## Backend foundation evidence

- [x] NestJS backend scaffolded under `backend/`; `GET /health` returns HTTP 200.
- [x] PostgreSQL 17 runs through Docker Compose on local port 15432 with a healthy status.
- [x] Application role `dacn2_app`, initial `courses`/`registrations` schema, and five seed courses were created through versioned SQL files.
- [x] NestJS starts with a bounded PostgreSQL connection pool and fails startup when required database configuration is unavailable.
- [x] Bugbot findings from 2026-10-29 were fixed: source layout, production entrypoint, root npm artifacts, environment example, generated-file ignores, startup rejection handling, and the production Multer advisory.
- [x] `GET /courses` reads seeded course summaries from PostgreSQL with explicit response types and unit/E2E coverage.
- [x] `GET /courses/:id` uses a parameterized query and returns explicit 400/404 errors for invalid or missing course IDs.
- [x] Migration `003_repair_course_names.sql` repairs Vietnamese seed names corrupted by the original PowerShell text pipeline; migrations containing Unicode are copied into the container as raw files before execution.

Registration behavior is not implemented yet, so M0-03 remains incomplete.

## Established direction from the master plan

- Problem: distinguish legitimate traffic surges from L7 DDoS, protect legitimate clients in Mixed Traffic, and avoid scaling from rejected load.
- Planned stack: Go Gateway; Python/FastAPI four-class ML; NestJS/PostgreSQL on K3s; Prometheus/Grafana. NestJS/PostgreSQL run locally; Go/Python runtimes are available. Gateway, inference, K3s deployment and monitoring are not implemented. Training will use Google Colab.
- Primary journey: legitimate traffic -> mixed lab traffic -> per-client mitigation and admitted-RPS scaling -> cooldown, with logs/dashboard evidence.
- Original schedule: 19/10–04/12/2026 with three named members. Actual availability, task ownership, and schedule feasibility are unverified; elapsed dates do not imply completed work.

## Next work and dependencies

- [ ] M0-01: audit repository, actual OS/CPU/RAM/disk, Go/Python/Node versions, Docker/Linux/WSL/VM availability, and K3s feasibility. Inspect existing services without exposing credentials or changing unrelated configuration.
- [ ] M0-02a: extract PRODUCT.md and REQUIREMENTS.md from the plan, separating proposed/validated facts; identify the backend demo workflow and testable success/failure/security cases. Resolve scope questions before declaring final MVP requirements.
- [ ] M0-02b: record confirmed environment/architecture choices and the smallest runnable slice; establish configuration examples and setup instructions as implementation starts.
- [ ] M0-03 (partial): health and course list/detail are verified; remaining work is registration with concurrency-safe capacity handling and failure tests. Define its API contract first.
- [ ] M0-04: establish executable start/stop/smoke commands, relevant lint/typecheck/build checks, and simple CI for the runnable slice.
- [ ] M1 onward: follow plan dependencies in small verified slices. Test TLS/H2 capture feasibility early, before bulk dataset collection.

## Open questions

- Are all 12 features, including JA4 and Akamai H2 capture, mandatory for academic acceptance? The plan lists them in MVP/M1–M2 but places complete capture in P1. Retain the 12-feature target until resolved; do not silently accept a reduced model.
- Does academic acceptance require only the reproducible lab, or also production deployment and external real-user validation? Existing production/user-validation standards remain in force for those completion claims.
- Confirm budget, actual member availability/owners, remaining schedule feasibility, lab resources, and university requirements not recorded in the plan.
- First dynamic journey selected: course registration (list/detail -> register -> success/duplicate/full result). Registration contract and lab identity/authorization boundary remain to be defined; do not expand to a full commercial frontend.
- Resolve and record an immutable upstream skill revision before implementation adoption; the routing index is not an installed pack.

## M0 acceptance and verification

- Environment audit has inspectable evidence and a feasible lab topology; unknown/unavailable tools are explicit.
- First slice has concrete inputs/outcomes, failure/security cases, dependencies, and executable verification.
- Backend starts through documented commands; health/dynamic behavior and stop/cleanup are verified.
- Relevant configured checks pass with actual output; missing checks are disclosed. Documentation alone does not satisfy M0.

## Evidence and limitations

- Reviewed Markdown and workspace inventory on 2026-10-29. Report.pdf exists but was not independently checked against the plan.
- Git metadata exists. Status inspection used a per-command safe.directory override because checkout ownership differs; no global setting changed. Existing files were untracked; no commit was created.
- Backend source, Compose/PostgreSQL setup, SQL migrations, tests, and local environment examples now exist. CI, Kubernetes manifests, traffic datasets, and model artifacts do not yet exist.
- Verified on 2026-10-29: lint, build, unit tests (4/4), E2E tests (4/4), production startup, `/health`, `/courses`, course-detail success/error behavior, UTF-8 database contents, and production dependency audit (0 vulnerabilities). Training, load generation, Kubernetes deployment, production validation, and real-user validation: NOT_TESTED.
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

Status: course listing/detail implemented and tested; registration remains planned.


## Demo scenarios

First complete scenario: course registration.
- List courses and view details.
- Register while seats remain.
- Reject duplicate registrations.
- Prevent registrations exceeding capacity under concurrent requests.

Later scenarios:
- Movie ticket booking.
- Product ordering.

Shared protection:
- Go Gateway, telemetry, ML inference, client policy,
  admitted-RPS scaling, and monitoring.

Verification:
- Run legitimate-only and mixed lab traffic.
- Measure successful legitimate operations, false blocking,
  bot mitigation, latency, and data correctness per scenario.

Status: planned; not implemented or tested.
