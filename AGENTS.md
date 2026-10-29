# Capstone engineering instructions

## Start here
- Read `tasks/current.md`, then `DACN2_PROJECT_MASTER_PLAN.md` (full plan on first orientation; relevant sections on continuation), `docs/PROGRESS.md`, and only relevant requirements/source files.
- Read `CONSTRAINTS.md` before writing code. Do not weaken it to make a change pass.
- Identify the lifecycle phase, task type, acceptance criteria, and verification before implementation.
- Use `docs/SKILL_ROUTING.md` to select skills; normally load 1-3 per task, sequentially by phase.
- Skills supplement the user's instructions; they do not create extra approval gates for already authorized work.
- Do not build application code until the user problem, target users, primary workflow, and MVP acceptance criteria are clear.
- The project direction and planned stack are already documented. Do not restart idea discovery or ask for known information; retain genuinely unresolved questions in `tasks/current.md`.

## Delivery
- Prefer one deployable application, a well-structured monolith, and managed services where suitable.
- Keep changes focused; prefer simple code, existing patterns, small commits, and few dependencies.
- Do not introduce Kubernetes, Kafka, microservices, custom authentication, caching layers, or complex telemetry without a documented requirement.
- The master plan documents Go Gateway, Python/FastAPI, NestJS/PostgreSQL on K3s, and Prometheus/Grafana requirements. Preserve those boundaries; the generic monolith preference does not override this architecture. Additional services still need a concrete requirement.
- Generate load only against explicitly authorized isolated lab targets, with bounded load/duration/resources, emergency stop, and cleanup.
- Separate model window classification from client mitigation evidence; never block all clients merely because the model predicts DDoS/Mixed. Preserve session-based dataset splits and honest missing-capture handling.
- Verify unfamiliar APIs against installed source/version and official documentation.
- Test observable behavior and risky boundaries; use regression tests for practical bug fixes.
- Review significant changes for correctness, maintainability, security, test coverage, and scope.
- Never commit secrets or expose credentials in output; use example environment files with placeholders.
- Validate input and enforce authorization at trusted boundaries; keep sensitive data out of logs.
- Run relevant tests and configured lint/typecheck/build checks; report unavailable checks explicitly.
- Do not claim tests, CI, deployment, or real-user validation passed without evidence.

## Project memory
- `docs/PRODUCT.md`: validated problem, audience, value, MVP scope, success criteria, assumptions.
- `docs/REQUIREMENTS.md`: functional/non-functional requirements and testable acceptance criteria.
- `docs/ARCHITECTURE.md`: important decisions and reasons; create when decisions exist.
- `DACN2_PROJECT_MASTER_PLAN.md`: scope, milestone outline, and reference KPI targets; actual execution evidence belongs in the current tracker.
- `docs/PROGRESS.md`: latest session checkpoint, evidence, blockers, and next action; not a second backlog.
- `docs/FEATURE_SPEC.md` and `docs/API_CONTRACT.md`: feature and cross-service contracts; create before dependent implementation/data collection.
- `docs/DEPLOYMENT.md`: actual deploy/recovery procedure; create when a deployment approach exists.
- `tasks/current.md`: current milestone, remaining tasks, dependencies, and verification evidence.
- Use these canonical files rather than creating duplicate specs, plans, or trackers by default.
- Map skill defaults such as `tasks/plan.md`/`tasks/todo.md` to the master plan and `tasks/current.md`; use `docs/ARCHITECTURE.md` instead of a separate `docs/DECISIONS.md`. Do not create `docs/TASKS.md` as a duplicate tracker.
- Update only artifacts affected by a task. Preserve unresolved questions instead of inventing facts.

## Done
- Feature: acceptance criteria satisfied; relevant checks pass; no known critical bug; security and affected docs reviewed.
- Release: CI passes; deployment and health verified; production critical flows work; inspectable errors/logs and recovery path exist.
- Project: MVP complete; accessible production app; real users complete the primary journey; feedback recorded and major issues evaluated.
- Lab release: reproducible controlled demo, actual capture/data/model/policy/scaling evidence, failure tests, cleanup and recovery instructions. This is separate from production release and real-user project completion above. Academic acceptance and any reduced feature scope remain explicit open questions until resolved.
- After launch, prioritize workflow failures and usability feedback; implement small verified iterations.
- User invitations or messages require explicit authorization; prepare the feedback process without sending unsolicited messages.
- Report concisely: change, purpose, verification, remaining risk or next task.
