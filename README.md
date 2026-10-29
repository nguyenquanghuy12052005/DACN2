# DACN2 — L7 cyber-defense lab

Status (2026-10-29): direction documented; implementation not started in this workspace. Phase: requirements reconciliation / M0 preparation.

The planned system uses a Go HTTPS Gateway, Python/FastAPI ML control plane, and NestJS/PostgreSQL backend on K3s. It distinguishes Normal, Flash Crowd, Pure L7 DDoS, and Mixed Traffic; applies per-client mitigation; and scales backend Pods from measured admitted RPS. Prometheus/Grafana expose actual behavior.

## Start here

1. Read the [master plan](DACN2_PROJECT_MASTER_PLAN.md) for scope and M0–M6 milestones.
2. Read [current work](tasks/current.md) for actual status and open questions.
3. Follow [agent instructions](AGENTS.md), [quality constraints](CONSTRAINTS.md), and [skill routing](docs/SKILL_ROUTING.md).
4. Continue using [architecture decisions](docs/ARCHITECTURE.md) and the [session checkpoint](docs/PROGRESS.md).

Primary lab journey: start the controlled backend/Gateway, run legitimate traffic, introduce authorized mixed traffic, observe classification/mitigation/scaling, stop generators, and verify cooldown/cleanup. Intended operators are the project team/evaluators; external user needs and feedback are not validated.

## Actual evidence

- Documentation, Report.pdf, and Git metadata exist. No application source, dependency manifests, tests, CI, datasets, model artifacts, or deployment manifests were found in the reviewed workspace.
- Report.pdf is present; its contents were not independently reconciled during this Markdown review.
- Runtime versions, hardware capacity, Docker/Linux/WSL/VM availability, and K3s feasibility remain to be audited in M0-01.
- There are no verified start/test/build/deployment commands yet. No runtime or performance result is claimed.

## Delivery boundaries

Traffic generation is restricted to explicitly authorized isolated lab targets, with bounded load/duration/resources, emergency stop, and cleanup.

The master plan targets a reproducible capstone lab demo. Production deployment and real-user validation remain separate unfulfilled quality goals under CONSTRAINTS.md. Academic acceptance and the mandatory 12-feature scope remain open in tasks/current.md; lab evidence must not be reported as production or real-user validation.
