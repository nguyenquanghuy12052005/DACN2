# Quality baseline

Recorded 2026-09-18; aligned with the DACN2 master plan on 2026-10-29. No application or automated enforcement exists yet. Existing quality requirements remain in force.

## Standing rules
- Do not commit secrets, leave implementation stubs in completed features, or silently swallow errors.
- Do not disable checks, weaken assertions, skip/delete tests, or lower standards merely to obtain passing results.
- Any justified exception records the rule, affected scope, reason, owner, and review/expiry date.
- Completed behavior must satisfy its acceptance criteria and relevant automated tests.
- Configured lint/typecheck/build checks must pass; report any missing or unavailable check.
- Consider security wherever user input, authentication, authorization, secrets, storage, or uploads cross boundaries.
- Production completion requires actual deployment, health/critical-flow verification, inspectable failures, and a documented recovery path.
- Project completion includes real-user primary-workflow validation, recorded feedback, and evaluation of major findings.

## Enforcement to establish with the first runnable slice
- Select stack-appropriate test, lint, typecheck, build, and secret/dependency checks; record exact executable commands here and in project scripts.
- Add the simplest CI pipeline that runs the project's checks. Blocking status must reflect actual checks, not prose.
- Test core behavior, failure cases, and authorization boundaries where present. Decide additional numeric budgets after the product/stack and measurements exist.
- Prefer short local checks and put expensive checks in CI. Do not omit required verification to meet a time budget.
- Add UI accessibility/runtime checks if applicable; add performance budgets only for a concrete need.

Coverage baselines, thresholds, scanner choices, and check timing are undecided. This document is guidance today, not proof of automated enforcement.

## DACN2 boundaries and required evidence

- The master plan justifies Go Gateway, Python/FastAPI, K3s backend, and Prometheus/Grafana; it is not proof that components are installed or work.
- Traffic experiments stay within explicitly authorized isolated lab targets, with bounded load/concurrency/duration/resources, an emergency stop, and cleanup. No public-target testing.
- Verify JA4/H2 using fixtures and independent capture. Missing/incomplete capture is explicit; never fabricate signatures or treat missing observations as real zero values.
- Preserve session independence in dataset splits. Fit preprocessing/resampling only on training data; exclude labels, tool/scenario identifiers, and generator ground truth from model inputs.
- Mixed/DDoS window classification is not client attribution. Mitigation needs client evidence, configurable limits/TTL, and tested fail-safe behavior. Measure false blocking separately from model FPR.
- Scale from observed admitted traffic and measured Pod capacity, with replica bounds/cooldown and least-privilege Kubernetes access. Distinguish desired replicas from Ready Pods.
- Reference KPI targets are not achieved results or reasons to lower checks. Record measurement conditions, failures, and unmet targets honestly.
- A lab release requires reproducible end-to-end behavior, failure/cleanup verification, real logs/metrics, and recovery instructions. It does not satisfy standing production or real-user requirements by itself. Academic acceptance remains unconfirmed; do not silently replace those standards with demo-only completion.
