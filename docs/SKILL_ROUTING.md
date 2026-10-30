# DACN2 skill routing

Updated: 2026-10-29. Scope: [master plan](../DACN2_PROJECT_MASTER_PLAN.md); actual work: [current task](../tasks/current.md).

Source: [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills). This is a routing index, not an installed pack. A listed workflow is not automatically available or applied.

## Availability and provenance

- Historical setup (2026-09-18) records reading idea-refine, spec-driven-development, and constraint-driven-development; no immutable revision was recorded.
- The 2026-10-29 review inspected source-driven-development, security-and-hardening, api-and-interface-design, planning-and-task-breakdown, observability-and-instrumentation, and performance-optimization on upstream main. This was a selective review, not an audit of every skill or a pinned implementation baseline.
- M1-05c adoption (2026-10-30): immutable revision `eb07f19f52c2669f2364897aaa293e2aaddd7b1c`, `skills/incremental-implementation/SKILL.md` and supporting `references/definition-of-done.md`, retrieved from the upstream raw URLs at that SHA. Applies incremental implementation/verification; project instructions govern commits and acceptance (no automatic commit/push or additional permission gate). Never silently upgrade adopted guidance.
- M1-05d adoption (2026-10-30): same immutable revision, `skills/planning-and-task-breakdown/SKILL.md`; supporting `references/definition-of-done.md` already read. Planning only; map plan/tasks to `tasks/current.md` and technical decisions to `docs/ARCHITECTURE.md`. No duplicate tracker, new approval gate or agent delegation. Other workflows remain unadopted.
- M1-06 (2026-10-30): `skills/performance-optimization/SKILL.md` at the same immutable revision; applies measure-first/same-conditions/repeats/variance only. No optimization, new monitoring infrastructure, RUM or generic web budgets in this lab baseline. Measurement contract in FEATURE_SPEC; evidence in ARCHITECTURE/PROGRESS/current tracker.
- M1-FIX01 (2026-10-30): `skills/test-driven-development/SKILL.md` at the same immutable revision. User evidence diagnosed first; actual child-process regression failed on original generic exit message, then passed after cause/RAM/evidence propagation and credential redaction. No service startup or extra approval gate.
- Retrieve only relevant files from `https://raw.githubusercontent.com/addyosmani/agent-skills/<commit-sha>/skills/<name>/SKILL.md`; preserve relative supporting-reference paths.
- No skills were installed by this documentation update. If retrieval fails, disclose the gap and use existing project guidance where sufficient; do not claim the skill was applied.

## Loading protocol and document mapping

1. Read tasks/current.md, relevant master-plan sections, and CONSTRAINTS.md. Identify task type, acceptance criteria, and verification before coding.
2. Normally load 1–3 workflows per task, sequentially by phase. Routes below are alternatives/phases, not a requirement to load every listed workflow together.
3. Project/user instructions govern scope and permission. Skill examples do not add approval gates to already authorized work or require extra infrastructure.
4. Map upstream plan/task defaults to the root master plan and tasks/current.md. Do not create tasks/plan.md, tasks/todo.md, docs/TASKS.md, or another backlog by default.
5. Map decisions to docs/ARCHITECTURE.md, session handoff to docs/PROGRESS.md, and actual setup/recovery to docs/DEPLOYMENT.md once procedures exist. Do not create a duplicate docs/DECISIONS.md.
6. Verify unfamiliar APIs against installed source/version and official documentation. Routine version choices can be explicit project decisions within authorized scope; missing versions do not automatically require another approval.

## Routes by milestone

- Requirements reconciliation / M0: spec-driven-development + constraint-driven-development. Use planning-and-task-breakdown to refine a concrete slice, not regenerate the whole plan. Reserve idea-refine for an actual unresolved product direction.
- M0–M1 backend/proxy: incremental-implementation + test-driven-development; add source-driven-development for version-sensitive APIs.
- M1–M2 telemetry/contracts: api-and-interface-design + observability-and-instrumentation; security-and-hardening for control endpoints and untrusted inputs.
- M1 capacity baseline: performance-optimization for measurement/profiling. Measure one-Pod capacity/Gateway overhead before optimizing; this is scheduled verification, not a rare post-launch task.
- M2 data collection: incremental-implementation + test-driven-development with the data/lab checklist below. Verify capture/features before bulk collection.
- M3 training: source-driven-development + test-driven-development with the ML checklist below. Generic web workflows do not establish ML evaluation correctness.
- M4 inference/scoring/policy: api-and-interface-design + security-and-hardening, then incremental-implementation + test-driven-development per slice.
- M5 scaling: incremental-implementation + test-driven-development; security-and-hardening for credentials/RBAC; source-driven-development for actual Kubernetes client/API versions.
- M5 dashboard: observability-and-instrumentation. Reuse metrics/contracts introduced in M1–M2 rather than starting instrumentation only at release.
- M0 onward CI: ci-cd-and-automation for simple install -> lint/typecheck -> test -> build checks supported by the stack.
- M6 handoff: code-review-and-quality, then security-and-hardening and shipping-and-launch as relevant to a lab release. Production completion requires additional CONSTRAINTS.md evidence.
- Bugs at any milestone: debugging-and-error-recovery -> test-driven-development; reproduce and add a practical regression test.

## Specialist checklists

These supplement generic workflows; they are project requirements, not newly installed skills. Detailed definitions belong in canonical contracts.

### Go Gateway and fingerprints — M1–M2

- Verify TLS/H2 capture against official specifications, known fixtures, and independent real-browser captures. Represent incomplete/missing capture explicitly; never fabricate hashes or observed zero values.
- Bound request size, timeouts, buffers, queues, connection/client state, TTL, and retention. Preserve cancellation/cleanup; check races/concurrent access where applicable.
- Define trusted proxy/IP handling; NAT and attacker-controlled forwarding headers must not silently become client identity.
- Define formula, units, missing values, window/timestamp behavior, and capture quality in docs/FEATURE_SPEC.md before bulk collection; define cross-service schema in docs/API_CONTRACT.md.

### Dataset and ML — M2–M4

- Separate window labels from generator-side client/request ground truth. Exclude labels, scenario/tool IDs, and ground truth from model inputs.
- Split by session_id with independent holdout; prevent overlapping-window leakage. Fit preprocessing/resampling only on training data.
- Reuse feature order/schema/preprocessing in inference; version manifests, artifacts, dependencies, and model metadata.
- Measure per-class metrics, legitimate-traffic FPR, client-level false blocking, and inference latency separately. Mixed classification does not identify individual bots.

### K3s scaling and resilience — M1, M4–M6

- Audit a feasible Linux/WSL/VM topology before installation; do not assume K3s runs directly on Windows or an existing cluster is disposable.
- Use least-privilege credentials/scale permissions, bounded retries/timeouts, and one replica controller per target.
- Scale from observed admitted/forwarded RPS and measured capacity, with min/max, hysteresis/cooldown, and desired/current/ready evidence.
- Test AI downtime, stale/invalid responses, K3s API failures, and policy rollback without globally blocking legitimate clients.

### Controlled lab and telemetry — M1–M6

- Restrict generators to explicit authorized lab targets. Cap load/concurrency/duration/resources; provide emergency stop and verify cleanup.
- Record sessions/seeds/scenarios/versions, actual network identities, timestamps/errors, and generator ground truth for reproducibility.
- Define/reconcile total/admitted/limited/blocked counts. Bound metric cardinality: raw IPs, JA4 values, request IDs, and raw URLs must not become unbounded Prometheus labels.
- Separate raw capture from operational metrics and redact secrets/sensitive payloads. Start logs/metrics with runnable features; provision Grafana from real signals.

## Conditional/deferred

- frontend-ui-engineering / browser-testing-with-devtools: actual browser workflows/runtime verification; Grafana does not imply building a new frontend.
- documentation-and-adrs: significant decisions in docs/ARCHITECTURE.md.
- context-engineering: concrete context/handoff problems; normal canonical reading does not require another skill.
- code-simplification: observed complexity obstructs a change.
- git-workflow-and-versioning: unusual Git/release work.
- deprecation-and-migration / doubt-driven-development / interview-me: actual migration, high-impact uncertainty, or prolonged ambiguity.
- Broad model comparisons, paper-oriented research, and additional infrastructure remain outside P0 unless explicitly required and documented.
