# Architecture and decisions

Updated: 2026-10-29. Status: planned architecture, not verified implementation.
Source: [master plan](../DACN2_PROJECT_MASTER_PLAN.md). Report.pdf was not independently reconciled in this documentation update.

## Planned boundaries

- Go Gateway terminates TLS, proxies admitted traffic, captures HTTP/TLS/H2 evidence, aggregates five-second windows, and applies per-client policy.
- Python/FastAPI validates window contracts, runs four-class ML inference, coordinates policy, and controls scaling.
- NestJS/PostgreSQL provide a dynamic demo workload; K3s scales backend replicas from admitted RPS and measured one-Pod capacity.
- Prometheus/Grafana expose actual traffic, classification, mitigation, latency, resource use, and replica state.

These boundaries are recorded in the user's master plan and justify the multi-component lab. Runtime versions, topology, packages, certificates, RBAC, persistence, and resource settings are not yet selected or verified.

## Documentation ownership — 2026-10-29

Decision: keep the master plan at its actual root path; use tasks/current.md as the single execution tracker, this file for decisions, and docs/PROGRESS.md for session handoff. Do not create duplicate docs/TASKS.md, docs/DECISIONS.md, or skill-default trackers.

Reason: existing AGENTS.md establishes canonical project memory; one tracker avoids conflicting completion states. The user's documentation-alignment request authorizes this organizational change, not new technical scope or reduced standards.

Alternatives: adopting the master plan's separate TASKS/DECISIONS logs or adding upstream skill-default trackers. Rejected because these duplicate existing canonical responsibilities.

Impact: checkpoint references in the plan are aligned; application architecture and report KPI targets are unchanged. Verification: local Markdown link and consistency checks recorded in docs/PROGRESS.md.

## Decisions still required

- Feasible Windows development / Linux lab topology after M0-01 audit.
- Concrete dynamic backend journey, API/feature contracts, and dependency versions.
- Mandatory 12-feature scope for academic acceptance; retain the target until clarified.
- Academic acceptance for lab versus production/external users; keep evidence categories distinct.

Future significant decisions record date, status, rationale, alternatives, verification, and impact on the master plan/report here. Do not present proposed choices as measured facts or approved report changes.
