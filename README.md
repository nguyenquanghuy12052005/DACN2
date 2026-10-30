# DACN2 — L7 cyber-defense lab

Status (2026-10-30): M1 Gateway work in progress; local database moved to Windows PostgreSQL. Environment survey (M0-01), local backend (M0-03), and clean local setup verification (M0-02b) are complete. M0-04 CI/log/smoke is implemented and locally verified; hosted Actions evidence is pending. Academic acceptance questions (M0-02a) remain; see [current work](tasks/current.md).

The planned system uses a Go HTTPS Gateway, Python/FastAPI ML control plane, and NestJS/PostgreSQL backend on K3s. It distinguishes Normal, Flash Crowd, Pure L7 DDoS, and Mixed Traffic; applies per-client mitigation; and scales backend Pods from measured admitted RPS. Prometheus/Grafana expose actual behavior.

## Start here

1. Read the [master plan](DACN2_PROJECT_MASTER_PLAN.md) for scope and M0–M6 milestones.
2. Read [current work](tasks/current.md) for actual status and open questions.
3. Follow [agent instructions](AGENTS.md), [quality constraints](CONSTRAINTS.md), and [skill routing](docs/SKILL_ROUTING.md).
4. Continue using [architecture decisions](docs/ARCHITECTURE.md) and the [session checkpoint](docs/PROGRESS.md).

Primary lab journey: start the controlled backend/Gateway, run legitimate traffic, introduce authorized mixed traffic, observe classification/mitigation/scaling, stop generators, and verify cooldown/cleanup. Intended operators are the project team/evaluators; external user needs and feedback are not validated.

## Actual evidence

- The [backend](backend/README.md) implements health, course list/detail, and concurrency-safe course registration using PostgreSQL transactions. API behavior is documented in the [API contract](docs/API_CONTRACT.md).
- Latest recorded backend checks: ESLint/build PASS, 8 unit tests and 9 E2E tests PASS. These are local results, not CI or deployment evidence.
- [Backend CI](.github/workflows/backend-ci.yml) runs install, isolated PostgreSQL setup, lint/build/unit/E2E and compiled health smoke. Open GitHub → Actions → Backend CI after pushing the workflow; no hosted CI result is claimed yet.
- Clean setup verified on 2026-10-29 using an isolated PostgreSQL volume and a clean backend source copy with `npm ci`: role/password, migrations, tests and compiled-backend health/list/detail all passed. This verifies setup on the existing Windows/Docker host, not prerequisite installation on another machine.
- Local PostgreSQL 17 now runs directly on Windows at 127.0.0.1:5432; the backend binds to 127.0.0.1:3000. Docker's former database on 15432 is stopped and retained for recovery. Migration evidence is in [checkpoint](docs/PROGRESS.md).
- Report.pdf is present; its contents were not independently reconciled during this Markdown review.
- HTTPS Go Gateway and JA4 are implemented locally; independent Postman JA4 and real-Chrome HTTP/2 diagnostic capture have evidence. Live H2 fingerprint extraction, dataset/model, inference, K3s, scaling and monitoring remain. Model training is planned on Google Colab. k3d/K3s is not installed; full-lab resource feasibility remains unverified.

## Run the local backend

Backend là API tạo tải đọc/ghi DB cho lab, gồm **5 file nguồn**; xem [bản đồ file và cách chạy](backend/README.md). Phát hiện/chặn DDoS nằm ở Gateway/AI. Không phát triển thêm nghiệp vụ quản lý sinh viên, tài khoản hay frontend.

Prerequisites: Node.js/npm (last verified: Node 20.20.2/npm 10.8.2), PostgreSQL 17 on Windows, and PowerShell. Docker Desktop is no longer required to run the local backend. No cluster is required for this slice.

See [Windows database setup](backend/README.md#windows-postgresql-current-local-setup) for the current machine and recovery instructions. Root [.env.example](.env.example) is only for the optional Docker alternative; [backend/.env.example](backend/.env.example) configures the application role on port 5432. Keep real .env files out of Git. A new machine must provision its roles/databases before application startup; the older Docker bootstrap remains documented separately.

For an already provisioned installation, from the repository root:

```powershell
Set-Location .\backend
npm ci
npm run start:dev
```

The PostgreSQL Windows service must be running. Do not start the old Docker database for normal local development.

In another terminal, `Invoke-RestMethod http://127.0.0.1:3000/health` should return HTTP 200. See the [backend guide](backend/README.md#checks) for course smoke checks, unit/E2E tests, build and stop commands. E2E uses the separate `dacn2_test` database. Registration accepts synthetic lab codes; authenticated user identity is not implemented.

## Delivery boundaries

Traffic generation is restricted to explicitly authorized isolated lab targets, with bounded load/duration/resources, emergency stop, and cleanup.

The master plan targets a reproducible capstone lab demo. Production deployment and real-user validation remain separate unfulfilled quality goals under CONSTRAINTS.md. Academic acceptance and the mandatory 12-feature scope remain open in tasks/current.md; lab evidence must not be reported as production or real-user validation.
