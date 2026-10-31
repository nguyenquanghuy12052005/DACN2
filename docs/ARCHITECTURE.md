# Architecture and decisions

Updated: 2026-10-30. Status: M1 local lab scope complete: HTTPS Gateway/JA4/H2/
telemetry → backendPod → WindowsPG, testDBwrites/races/recovery and one-Pod baseline
verified. Working C319req/s for stated read-only profile, not maximum capacity.
Cluster retained stopped; M2 dataset/collector not started, full AI/scale/monitoring pending.
Source: [master plan](../DACN2_PROJECT_MASTER_PLAN.md). Report.pdf was not independently reconciled in this documentation update.

## Planned boundaries

### UI-03b — direct Chrome HTTPS and connection fingerprint correlation (2026-10-31)

User explicitly selected UI-03b after discussing proxy's inability to observe
browser fingerprint. Preserve backend/AI and separate native test session; change
frontend API calls directly to Gateway18444. Vite is UI/telemetry only. Optional
Gateway browser_lab middleware restricts exact local origin/session/owned IDs,
bounded actions/body/concurrency, exposes generated request/connection/protocol
headers. Defaults disabled; independent native/K3s workflows remain usable.

TLS per-accepted-connection config clones capture the same listener ID as H2 and
request ConnContext; structured events join by session+ID, no timing inference.
Protocol additive event field checked by tests. Legacy diagnostics retained and
fingerprint algorithms unchanged. Browser's preflight may be first H2 HEADERS;
that observation describes the connection setup, not a specific user's identity.

Scoped fresh Chrome lab profile accepts only existing cert SPKI, without global
trust modifications. Script checks validity/SAN; ordinary Chrome self-signed
failure remains possible. This explicit lab certificate exception is not public
PKI trust. Tests use same pin with Chrome and never ignore all HTTPS errors.
No dependency install, auth system, AI, mitigation, generator or autoscaler added.
Native GUI/headless actualHTTP2/correlatedJA4/Akamai proof, Go test/vet/race and
frontend/adapter/browser checks documented in PROGRESS; all QA runtimes stopped.
### UI-03 — optional native live demo, implemented 2026-10-31

User explicitly requested backend/Gateway connection after UI-01a; authorized this
live integration ahead of UI-02 animation. Keep Gateway/backend/AI source untouched.
Chose a lightweight independent native session to avoid modifying existing Pod
DB config or competing for cluster RAM: local Vite middleware/SSE plugin in
dashboard/server plus scripts/dashboard-live.cjs owns Gateway18444/NestJS13001
and3 uniquely labeled test DB fixtures. Builds reuse current sources; no new
dependencies, no env/hosts/CORS/trust-root changes, no public target or generator.

Tradeoff is explicit proxy TLS/IP identity: UI displays proxy JA4, not browser
fingerprint. This is useful live API/telemetry demo, not legitimate browser dataset
evidence or whole K3s/AI defense pipeline. A future direct browser path still needs
separate CORS/cert and telemetry correlation work. UI-00 K3s integration gap remains.

Fixed-route local adapter limits30actions/10s,8inflight,1KiB body/64KiB response,
5s Gateway timeout,4SSE viewers,300events/30JA4. Health probes not counted as
workload. Full1Hz snapshots support reconnect without infinite event queue. Source
time/capture coverage retained; completed RPS differs from admitted/arrival RPS.
Process session only; no rate-limit/block decisions inferred from HTTP errors.
Secrets remain local, response telemetry excludes participant codes and bodies.

Runner owns exclusive lock/ports, private logs/results, fixed synthetic fixture
lifecycle; stop file signal affects only current owned session, no PID killing of
arbitrary apps. Before/after hashes reconciled after graceful stop. Abrupt OS kill
is not crash-safe recovery; inspect lock/result and owned processes before manual
fixture cleanup, do not automatically adopt or delete foreign data. Existing K3s
integration remains scripts/m1-integration.cjs. No hosted CI claim.

### UI-01 — static glass dashboard implemented, 2026-10-31

UI-01a user override: Vietnamese is now the primary UI language, replacing the
original design's English preference. Segoe UI/Arial system fonts cover Vietnamese
without font downloads. Body/controls larger; overview uses one observation panel
with keyboard-accessible Sơ đồ/Lưu lượng/Nhật ký/Dấu vân tay tabs. Auxiliary notes
collapse via native details. Desktop courses use horizontal rows; narrow screens
retain natural scrolling. compact.css contains these deliberate overrides. No
API/data-source change or UI-02 animation implementation.

One separate dashboard/ app now implements three routes from UI-00. React19.2,
Vite6.4.5, TypeScript5.9.3, Tailwind4.1.18, router7.18.5 and Lucide0.552 pinned
with lockfile; no backend dependencies modified. Official Vite6/Tailwind Vite
instructions checked; package engines/peers/licenses verified against npm metadata.
ESLint10.14/TS-ESLint8.72.1, Vitest4.1.12 and Playwright1.64.1 selected after audit.
minimatch11.0.1 override patches dev-tool transitive glob amplification advisory;
installed users rely on Minimatch API, lint/build/tests passed with override.
npm audit reports0 vulnerabilities at installation time, not a permanent guarantee.

CSS tokens provide pearl/ivory glass, custom gradients, dark theme, blur fallback,
desktop/sidebar/mobile menu, keyboard focus and OS/user reduced motion. Native
controls avoid new headless/component dependencies. No external assets/fonts.
Static SVG topology/chart in UI-01; React Flow/Motion/ECharts deferred. Fixture
module is explicitly synthetic; source selector hides samples in Live. Simulation
Start/Stop locked. Client form only previews route, never calls API or claims201.

Browser smoke uses installed Chrome,9 screenshots/3 viewports, axe light all
routes/dark overview, no project API calls, no JS errors/overflow. Four behavioral
RTL tests verify unavailable Live and no-action controls. Typecheck/build/lint
passed. No cluster operations or Gateway/Backend/AI edits. UI-02 requires selection.

### UI-00 — dashboard architecture proposal, 2026-10-31

User authorized UI-00 audit/planning only. Original design source is the existing
DACN2_GLASS_SECURITY_DASHBOARD_SPEC.md; DASHBOARD_DESIGN_SPEC.md is an entry link.
No frontend exists. Adopt one proposed `dashboard/` React/Vite/TypeScript app with
`/demo`, `/dashboard`, `/dashboard/simulation`, rather than two frontend services.
The new user request extends the earlier no-frontend workload scope; backend
business scope remains course registration, with no account/login implementation.
Custom dashboard supplements the planned Prometheus/Grafana requirement; it does
not silently replace M5 monitoring or advance M2/AI/policy/scaling completion.

Future source layout: src/app (routes/providers), pages (three initial routes),
components/glass, topology, charts, events, simulation; features/telemetry,
replay, theme; styles/tokens.css; mocks and tests. UI-01 first installs only
React/Vite/TS, Tailwind, routing and Lucide as needed. UI-02 adds Motion and
React Flow; ECharts when charts need it. Accessible headless components/shadcn
selectively, not a whole template. Pin compatible versions/lockfile and verify
Node20.20.2 compatibility, licenses and official APIs before install; no package
versions are selected/installed in UI-00. Avoid latest tooling assumptions.

Design: light pearl/ivory frosted shell, warm amber accents, floating icon rail
and toolbar, readable rounded cards, opaque blur fallback; dark theme, keyboard
navigation, contrast and reduced motion. Topology hero shows data plane solid
Client→Gateway→backend→DB, telemetry/control dashed to unavailable AI/K3s controls.
No color-only status. Header exposes LAB, source mode, source age, disconnect,
theme and pause motion. Six initial KPI slots use unavailable states for incoming,
admitted, blocked, ready pods; Gateway p95 and health need real adapter first.
Available completion throughput can be shown separately with correct label.

Client page: list/detail/seats, synthetic studentCode input and real result
status/request ID, no credentials form. Simulation page: disabled scenario shells,
bound indicators and future Start/Stop; no live generator until UI-04 gate.
Central map uses one bounded particle overlay, not React nodes per request;
counts remain readable when animation pauses. Event-derived pulses are sampled,
not packet capture. Details and truth rules: DASHBOARD_DATA_MAPPING.md.

Browser CORS/TLS, missing stream and JA4 correlation are real integration gaps.
Proposed local read-only telemetry adapter would consume allowlisted existing
logs and supply snapshot/SSE, optionally private infrastructure snapshots. It is
not an implemented API and needs UI-03 scope review. Direct browser→Gateway is
preferred for honest browser fingerprint; proxying changes observed client TLS.
No admin kubeconfig/secrets/DB access in frontend. AI/policy/scaling show
Unavailable; recorded logs are Replay and fixtures Mock Design, never Live.

Resource-conscious plan: no new containers/cluster/monitoring stack in UI-00/01;
lazy-load topology/chart libraries, capped streams, stop offscreen motion. Test
15min bounded memory/handlers in UI-05. No guarantee laptop fits full future stack.
Skill routing: planning workflow at pinned SHA was requested but retrieval failed
(web cache miss); no newly loaded skill claimed. Existing project guidance used.
UI-00 gate: architecture/mapping/risks/acceptance documented; implementation
approval remains pending. Execution backlog is only tasks/current.md; checkpoint
is PROGRESS.md, not a second dashboard tracker.

### M1 closure — integration, capacity and limitations (verified, 30/10/2026)

User requested completing M1, then selected M1-05g/h and bounded M1-06 separately.
Configured loopback upstream/listener in Go Gateway with safe native defaults,
3sconnect/5sheader timeout, strict origin checks and privacy tests. Go fmt/vet/
fulltests/race/buildPASS. Existing JA4/H2 fixtures/independent captures remain
valid; actual Pod route now also tested over HTTPS/H2 with trusted lab certpin.
No global certificate-root installation or browser-trust completion claim.

M1-05h final evidence `.local-backups/m105h/1793367774888/result.json`:
20events reconcile19HTTP1+1H2 requests; valid/invalid/duplicate/full registration
and real Pod concurrent last-seat/duplicate races each one201/one409, counter=
actual1. Temporary backend testDB switch guarded by ownfixture route beforePOST.
Backend0→1: ownhealth200/proxy502/recovered200, persisted testregistration. Restore
demoDB/replicas1; fixture rows removed, demo5/3 and test5/0 hashes unchanged.
Test sequences advance. DNS cold-start EAI_AGAIN diagnosed from earlier logs,
fixed by bounded no-secret/nonroot DNS initContainer; retained0restart checks.
Recreate transitions have short observed502s during Service propagation; these
are recorded/awaited before writes, not hidden or called zero-downtime.

M1-06 pre-measurement contract in FEATURE_SPEC. Single backend500m/192Mi, server
cap3GiB; WindowsPG17.8/5courses, generatorNode20.20.2, backendNode24.22.2,
K3s1.35.9+k3s1, HTTP1keepalive GETcourses, laptopi5-11400H/15.77GiB. Quota differs
from Report's reference200m/256Mi and is explicitly the tested local profile;
do not reuse C for different quotas/DBsize/trafficmix. No tuning or invented45RPS.

Discovery10/25/50/100/200/400RPS5s tiers plus2s warmup, two15s validations per
target. Direct validation399.643/399.835goodRPS, p953.374/3.288ms;
Gateway399.993/399.970goodRPS, p953.939/4.370ms. Each validation6000successful,
no errors/concurrency-shed/generator-late-shed.
Actualpeak≤32inflight, generatorRSSpeak83.61MiB; sampled hostfree≥5.7996GiB.
Backend cgroup memory snapshots≈53.6/56MiB include sampling process and are not
peak memory; rawCPU/throttling counters kept. SamePod/UID/quota/restarts0 throughout.

C_work=floor(0.8×min four achieved validationRPS)=319req/s. 20%headroom is a
project choice, not a measured improvement. Saturation not reached at authorized
400RPS; result is a conservative validated working point, not maximum/universal
capacity. Gateway/direct p95 differences are descriptive, confounded by runorder
and shared-host activity; no isolated causal overhead/long-run stability claim.
Reference demo220RPS therefore does not automatically demand scaling with this C;
M2/M5 must calibrate scenario rates/quotas honestly rather than force Report numbers.

Evidence `.local-backups/m106/1793367470786/result.json`,summary.csv,rawlatencies,
gateway.log and environment.json (post-run collection of host/version/source/
binary hashes). Whole run157.395s, generating window128.034s<180; caps400/32/256MiB.
Gateway15946events exactly reconcile15946dispatched requests including preflight,
all200; direct/Gateway data rowhashes unchanged. Owned Gateway/guard stopped and
cluster stopped, resources/privateSecret retained for demo. No load left running.

Final backend no-fixESLint/build/8unit/9E2EPASS. Rootscripts syntax, manifest
APIserverdryrun, actual negative/recovery/concurrency boundaries and security/scope
review performed. No dependency changes, secret commits, stage/reset/push or
public traffic. HostedCI remains unverified; M1 completion is not M0 closure,
production release, four-class model, real-user validation or full1–5Pod capacity.
Next proposed M2-01: define/test12features before5s aggregation or bulk data.

### M1-05g — backend Deployment/NodePort (verified, 30/10/2026)

User selected agent deployment. Tracked `kubernetes/backend.yaml` and
`scripts/backend-lab.cjs` provide one192Mi/500m bounded backend replica and Service
NodePort30080, published only Windowsloopback13000. Server cap3GiB verified; all
host bindingsloopback. Namespace dacn2-lab, no Pod serviceaccounttoken/RBAC grants,
UID1000/read-onlyrootfs/dropcaps. Recreate strategy avoids surge but has downtime.
Trust boundary/probe limitations and Secret creation defined in API_CONTRACT
before applying. `/health` remains process-only; explicit course reads verify DB.

Private passwordSecret created via stdin, output nameonly; tracked manifest only
secretKeyRef. Admin cluster datastore access can retrieve it; no encrypted-store
or production-auth claim. Cached backend image unchanged and imported singleamd64;
firstimageinspect missing but reinventory resolved existing immutableimageID.

Serverdryrun+apply PASS, oneReadyPod, GET health/list/detail200, invalidID400/
missingID404. RuntimeNode24.22.2/nonroot/notoken/no.env; repeatverification0restart/
noOOM, demo hashes/counts unchanged, cluster stopped. First create had2exit1
restarts before Ready; cause not captured, not silently counted as0 or claimed
fixed. Repeated cold-start0restart verified. Evidence
`.local-backups/m105g/1793366302157/result.json`; earlier attempt retained separately.
No Gatewayretarget/demoDBwrite/load. User subsequently selected M1-05h integration/
testDBwritefixture/recovery, still not complete at this checkpoint.

### M1-05f — actual Pod to Windows PostgreSQL (verified, 30/10/2026)

User selected bounded disposable Pod probe, without DB writes or HBA/firewall/
Gateway changes. Reused owned `dacn2-m105e`, fresh available RAM6.0527GiB before
successful run; started only after≥5GiB gate. Imported cached postgres17-alpine
from Docker into K3s/containerd; no image pull/package install. Direct tag import
first failed with a missing content digest in the multi-platform index. Exporting
only cached linux/amd64 with `docker image save --platform=linux/amd64`, then
`k3d image import <archive> --mode direct` succeeded. Failed attempt stopped own
cluster; final attempt28.299s. No image/source version changed to make this pass.

Docker source image ID266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b;
single-platform archive SHA256cd05347baf06a0ecff31d67b9ff71a534a3bae5e7f6658a64cca2aee39a2b32c;
observed Pod imageIDab20e934b27ba3ff927c1b4c9ff8cf6c32f315f743efe68dd3441182a87fb085.
Different index/archive/runtime IDs are recorded, not falsely equated.

Pod `dacn2-db-probe-1793365214835-bc3ea7`, UIDae5c5acf-3eed-4912-b602-d66d32c15056,
IP10.42.0.20 onserver0; imagePullPolicyNever, no mountedserviceaccounttoken,
UID/GID65534/nonroot, read-onlyrootfs/dropALL/noPrivilegeEscalation/seccompRuntimeDefault.
Requests10m/16Mi, limits250m/64Mi, Neverrestart, activeDeadline300s. Overall10minute
helper bound, perconnection3s/statement5s/SQLprocess15s; no load generated.

From actual Pod: `getent hosts host.docker.internal` returned IPv6
fdc4:f303:9324::254 (not a complete A/AAAA inventory or proof which address libpq
selected); `pg_isready` accepted TCP5432. A credential-free PostgreSQL startup
packet received AuthenticationSASL(type10) advertising SCRAM-SHA-256. Subsequent
psql password login+readonlySELECT on dacn2/dacn2_test succeeded asdacn2_app.
Actual server PostgreSQL17.8/windows, server/client addresses127.0.0.1, sslfalse;
read_onlyon. Thus the present Pod route is verified without opening HBA/firewall.
Observed loopback source does not establish raw Pod IP as DB client identity,
universal networking across restarts/hosts, or TLS for a future remote DB path.

Demo5courses/3registrations, test5courses/0registrations; row hashes matched host
read-only baseline before and after. No fixture/writes/schema/sequence changes
issued. Password read from ignored backend.env only in helper memory, sent over
kubectlexec stdin, exported only in short-lived psql process; absent from Pod
spec/Secret/env/command args/files/output. API exec admin transport remains local
and uses the existing private kubeconfig, not a new public control endpoint.

Own Pod UID/runlabel verified before deletion; absence verified while API live,
then owncluster stopped. Default kubeconfig unchanged/absent; originalDBcontainer
and WindowsDB/backend/Gateway untouched. Final hostfree5.5933GiB; source/archive/
imported image retained ignored/local. Evidence
`.local-backups/m105f/1793365214835-bc3ea7/result.json`, secret-free pod.json/logs,
helper `.local-backups/m105f/probe.cjs`; failed-import evidence separate run.
No app tests/benchmark/production validation claimed for infrastructure probe.

M1-05f DONE; M1-05 not complete. Next proposed M1-05g: deploy backend1replica
with bounded resources and app credentials private, test loopbackNodePort health/
course reads, then stop owncluster. Describe scope/wait for user selection first;
no automatic Gatewayretarget/demoDBwrites/load. Procedure in
[DEPLOYMENT](DEPLOYMENT.md#m1-05f-pod-database-probe).
Primary references: [Pod security fields](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/),
[psql](https://www.postgresql.org/docs/17/app-psql.html),
[Docker host alias](https://docs.docker.com/desktop/features/networking/networking-how-tos/).

### M1-05e — empty cluster trial/recovery (verified, 30/10/2026)

User selected agent work and closed apps, including VS Code, after RAM readings
4.64–4.94GiB. No apps closed by agent. First helper run refused create
at4.9358GiB. After user action RAM6.71GiB, and before retained successful create
6.3876GiB. No resource gate was lowered.

Downloaded `.local-backups/tools/k3d-v5.9.0.exe` and `kubectl-v1.35.9.exe`;
actual SHA256s match publisher values in M1-05d. Binary versions verified;
k3d binary default K3s1.35.5 explicitly overridden to1.35.9+k3s1. Pulled exact
K3s image, RepoDigest matches recorded OCI index. k3d also pulled its standard
5.9.0 tools helper. No global install/PATH/kubeconfig change.

Created `dacn2-m105e`: one server/zeroagent/noLB, noTraefik/ServiceLB,3072MiB
server cap. Standard k3d-tools helper is a second container, not a K3s agent.
API127.0.0.1:16443→6443 and futurebackend127.0.0.1:13000→30080 confirmed
in Docker bindings; no backend Service/Pod exists. API `/readyz`ok, nodeReady
with Memory/Disk/PIDPressureFalse; CoreDNS/local-path/metrics-server all Running/
ready after warmup and stop/start. No observed server OOM, Docker restart or Pod
container restart. Metrics-server initially sampled before readiness; bounded90s
rollout wait passed without config changes. This is not a benchmark or completion
of the Prometheus/Grafana monitoring stack.

Retained-cluster checks finished within143.532s of its create attempt, under
the10minute bound. Sampled hostfree minimum5.6793GiB across create/recovery runs,
final5.6848GiB; samples do not establish transient minima between measurements.
Final own server/tools stopped, volumes/network/images retained. Original stopped
PostgreSQL container/volume retained; no WindowsDB queries/writes, app/env/HBA/
firewall/WSLsettings or user service changes in this slice. Server3GiBcap does
not cap the tools helper or total Docker/WSL memory.

Admin kubeconfigs stay only in ACL-restricted ignored per-run directories; no
credential printed/merged. Default `~/.kube/config` absent before/after;
Dockerkubectl remains1.32.2. Main evidence
`.local-backups/m105e/1793364531571/result.json`; supplementary all-system-ready
recovery evidence `.local-backups/m105e/1793364531571-resume-1793364615141/result.json`.
Secret-free helper `.local-backups/m105e/trial.cjs`; logs/evidence local-only.

Failures corrected: port filter without`:direct` defaults to proxy and fails
with noLB; pinned `pkg/client/ports.go`/`pkg/util/filter.go` verified direct suffix.
Helper initially assumed one total container and API key6443/tcp; corrected
ownership for k3d-tools and normalized Docker key6443, removed the own failed
cluster and reran. Actual hostIP/hostPort assertions retained. No PASS inferred
solely from the k3d create message.

Scope M1-05e DONE; M1-05 incomplete. Next proposed M1-05f: bounded disposable Pod
DNS/TCP/SCRAM/read-only WindowsDB probe, after user scope choice; no backend
deployment, HBA/firewall changes or Gateway retarget automatically.
See [reuse/test/cleanup](DEPLOYMENT.md#reuse-the-stopped-m1-05e-cluster).

### M1-05d — resource/version preflight and trial design (complete, 30/10/2026)

User selected agent work and clarified that low free RAM is caused by open apps;
the user will close them when needed. Do not treat one snapshot as permanent
hardware insufficiency or close applications automatically. No need to close apps
for this audit. Actual cluster trial still requires a fresh RAM check.

Measured:15.77GiB total/2.83GiB free; C20.75GiB and D65.48GiB free.
Docker28.1.1 Linux/x86_64,12vCPU,guest MemTotal8201146368bytes (not additional host
RAM). No running containers; old dacn2-postgres-1 remains stopped. Existing backend,
Node and PostgreSQL images retained. Only Docker-bundled kubectl1.32.2 found;
no k3d/k3s/kind/minikube on PATH, no context names. No .wslconfig. Ports16443/13000/
3000/8443 have no listener; WindowsPG5432 still listens IPv4/IPv6. No DB login or
queries repeated in this audit. Evidence `.local-backups/m105d-survey.json` and
registry manifest/source snapshots with prefix `m105d-` (ignored/secret-free).

Selected candidate (release metadata and source/registry checked, NOT runtime
compatibility certification):

- k3d **v5.9.0**, release2026-06-02, Windowsamd64 asset SHA256
  `49d0b9c796f5b8ba6f58a1dd5469e8b7b34bf9b6ce9078633eedb2789680a034`.
  Annotated tag resolves to source commit
  `15dd1e2dbd62c53ed990fce9b7332335e8cb053c`. Inspected create flags and version.go.
- K3s **v1.35.9+k3s1**, release2026-09-30, image
  `rancher/k3s:v1.35.9-k3s1`; expected OCI index digest
  `sha256:ec9868c6a38d4e8c1869832fb5fd1eb8473c39794a0b44d2b952e7ba911951bc`,
  linux/amd64 manifest
  `sha256:b87c71679c0be70cab5eb34f05ebe5e2906bf80fbd1d99b389c1e9643954520c`.
  Choose a supported, more established minor rather than adopting1.37 for this
  first lab trial. Override the k3d source fallback1.32.5 explicitly; do not infer
  the actual release binary default from source or allow a floating latest tag.
- kubectl **v1.35.9** Windowsamd64, published checksum
  `160bebf50d49ac4b5892370803da09cc26bbeabed6a4cf22bf382bd72d14d4d7`.
  Same minor as API. Existing1.32.2 is outside the allowed ±1minor skew for1.35;
  preserve it and use explicit project-local executable paths, no global PATH edits.

Binary checksums are expected publisher values, not hashes of downloaded binaries:
none were downloaded/executed here. K3s registry metadata exists; no image pull.
Check downloaded bytes/digests before use in the next selected slice. Generic
k3d compatibility docs have old release entries, not proof for this pair. CLI
syntax/source and Kubernetes skew checks pass; Docker28/k3d5.9/K3s1.35 runtime
compatibility remains NOT_TESTED until trial. Do not silently downgrade on failure.

Trial design: one named cluster `dacn2-m105e`, one server/zero agents, no nginx LB,
Traefik or ServiceLB; retain CoreDNS/flannel/local-path/metrics-server initially.
Keep WindowsPG and Gateway; embedded SQLite is only the cluster datastore. No
backend Pod, app Secret, DB write, Gateway retarget, load or benchmark in the first
empty-cluster trial. k3d server is a privileged lab container, unlike backend
runtime; do not apply backend drop-cap/non-root settings to K3s internals.

Fresh ≥5GiB Windows available RAM is a conservative project heuristic before
trial, not vendor minimum nor evidence this machine cannot run K3s. Proposed
server memory cap3072MiB; no CPU cap claimed (observe CPU, no workload). Guest
MemTotal must not be added to host available RAM. Stop on host available RAM<1GiB,
server OOM/repeated restarts, severe responsiveness loss or setup timeout180s.
Cap and threshold are trial settings to evaluate, not measured capacity. Plan an
outer10minute deadline for pull/create/check/cleanup; registry slowness is an
explicit failure/defer outcome, not a reason for unbounded waiting.

Map API127.0.0.1:16443 and reserve127.0.0.1:13000→serverNodePort30080 for the later
backend slice. No LAN publication. Use --kubeconfig-update-default=false and
--kubeconfig-switch-context=false; save kubeconfig only inside ignored
`.local-backups/m105e/`, restrict it locally, never print/commit it. Inspect live
Docker port bindings and client --help after installation before declaring safe
exposure. No existing kubeconfig, distro, firewall/HBA or Docker/WSL settings changed.
See [trial steps and acceptance](DEPLOYMENT.md#m1-05e-trial-design-and-execution).

Sources checked2026-10-30: [k3d5.9 release](https://github.com/k3d-io/k3d/releases/tag/v5.9.0),
[checksums](https://github.com/k3d-io/k3d/releases/download/v5.9.0/checksums.txt),
[pinned create source](https://github.com/k3d-io/k3d/blob/15dd1e2dbd62c53ed990fce9b7332335e8cb053c/cmd/cluster/clusterCreate.go),
[K3s release](https://github.com/k3s-io/k3s/releases/tag/v1.35.9%2Bk3s1),
[kubectl checksum](https://dl.k8s.io/release/v1.35.9/bin/windows/amd64/kubectl.exe.sha256),
[Kubernetes skew](https://kubernetes.io/releases/version-skew-policy/),
[K3s baseline excluding workloads](https://docs.k3s.io/installation/requirements),
[server options](https://docs.k3s.io/cli/server).

### M1-05c — backend container preparation (verified, 30/10/2026)

User selected agent implementation. Native `main.ts` now accepts HOST while keeping
127.0.0.1 as the default; the image sets HOST0.0.0.0/PORT3000, and host publication
is explicitly loopback-only. Preserve the current direct-client lab boundary;
this does not authorize exposing the unauthenticated write workload publicly.

Multi-stage Dockerfile uses official Node24-bookworm-slim pinned to
`sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c`
(actual24.22.2). Node24 LTS chosen over the host/old-CI Node20; CI upgrade is outside
this slice. `npm ci` uses the unchanged lockfile, build heap384MiB, then prune dev
dependencies. Runtime copies package/dist/production modules, USERnode/UID1000;
allowlist `.dockerignore` excludes env/backups/artifacts from context. No new npm
dependency or schema/env-secret change. Docker pattern follows
[official Docker Node guide](https://docs.docker.com/guides/nodejs/) and
[official image practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md);
runtime line checked against [Node releases](https://nodejs.org/en/about/previous-releases).

No-fix lint/build/8unit/9E2E PASS on host; image build and bounded runtime smoke PASS.
192MiB/no-swap/0.5CPU/64PIDs/read-only/dropcaps/no-new-privileges; default CMD.
Native compiled bind127.0.0.1 verified; container health/list/detail200 via
host.docker.internal5432; no `.env`/src/CLI in runtime. Demo5courses/3registrations
and row hashes unchanged. Own processes/containers removed; image/cache retained.
Evidence `.local-backups/m105c/1793363254953/result.json`; procedure in
[DEPLOYMENT](DEPLOYMENT.md). First helper run left the own smoke container because
Node Windows signal termination sets signalCode while exitCode stays null; fixed
helper and explicitly removed owned container before successful rerun. No app bug
or user process affected. Initial available RAM1.63GiB; no cluster attempted.

Container ENV credentials use existing app env via `--env-file` only at runtime,
never build args/context/image or output; Docker administrators can inspect runtime
metadata until container removal. Container read smoke does not establish full
Node24 E2E, Pod networking, capacity, production or academic acceptance.
Next proposed M1-05d: resource/version preflight and minimal K3s trial plan;
describe purpose/scope and wait for user selection before work. Cluster creation
is a later separately selected slice after resource readiness.

### M1-05b — disposable-container DB path (verified, 30/10/2026)

The user authorized a bounded disposable container probe after the read-only audit.
Container DNS/TCP/authentication succeeds on the current Docker Desktop setup;
this supersedes M1-05a's unresolved container-path question, not its actual WSL probe
results. No HBA/firewall/hosts/env/database-data changes were needed.

- Used already cached postgres17-alpine image ID/digest
  sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b,
  with client commands as entrypoint, no PostgreSQL server initialization or pull.
  Probe used default bridge, non-root65534, read-only rootfs, all capabilities
  dropped/no-new-privileges,64MiB RAM/no extra swap,0.25CPU/32PID,15s timeout and --rm.
- Container DNS resolves host.docker.internal to192.168.65.254 (IPv4) and
  fdc4:f303:9324::254 (IPv6); embedded resolver192.168.65.7. These are Docker Desktop
  internal addresses, not the stale distro resolver result from M1-05a. Do not pin
  these numeric addresses in app config: use the host alias and revalidate on topology changes.
- TCP5432 PASS. Pre-auth psql reached password request, then existing dacn2_app
  password was supplied via stdin to the temporary shell (not command arguments,
  Docker create-time environment or a secret file). It was exported only inside
  the short-lived process for psql. Credentials were not printed or stored in evidence.
- Read-only SELECT PASS on Windows PostgreSQL17.8 for both dacn2 and dacn2_test.
  SQL confirms transaction_read_only=on,server_addr=127.0.0.1,client_addr=127.0.0.1,
  role=dacn2_app,ssl=false. This observed peer explains why existing loopback SCRAM
  rules permit this Docker Desktop path without broadening authentication.
- Observed data: dacn2=5courses/3registrations; dacn2_test=5courses/0registrations.
  Connection timeout3s/statement timeout5s, SELECT only; no seed/migration/write test.
- Own probe containers removed; old dacn2-postgres-1 remains stopped, original
  Windows PostgreSQL/Gateway/backend remain running as before. No source/app tests
  changed or rerun, no cluster/image/network provisioned. Cleanup inventory checked.

Evidence ignored: `.local-backups/m105b-1793352300802-c4bcef/result.json` and
`.local-backups/probe-pg-container.cjs`. The helper reads the existing ignored app
env; it rejects unexpected host/port/role without printing values, and cleanup
checks its own unique label before force-removing a timed-out probe.

Scope limits: normal Docker container on bridge is not a nested K3s Pod. CoreDNS,
node networking, actual Pod source identity/authentication and future topology must
still be verified. ssl=false is a measured local-lab condition, not a production
DB-transport guarantee. Host memory headroom and version pinning from M1-05a remain.

Next proposed M1-05c: prepare backend image and configurable bind address, keeping
Windows default127.0.0.1 while using0.0.0.0 only inside container; run one bounded
container with DB_HOST=host.docker.internal/5432 and verify health/course reads.
No cluster creation in that slice. Choose compatible/pinned Node image based on
official support/runtime compatibility; do not infer an image version from the old
Docker-bundled kubectl. Before later K3s trial recheck RAM and pin k3d/K3s/client.

Primary references: [Docker Desktop host-service alias](https://docs.docker.com/desktop/features/networking/networking-how-tos/#connect-a-container-to-a-service-on-the-host),
[PostgreSQL client environment options](https://www.postgresql.org/docs/17/libpq-envars.html),
[read-only transaction setting](https://www.postgresql.org/docs/17/runtime-config-client.html#GUC-DEFAULT-TRANSACTION-READ-ONLY).

### M1-05a — topology/resource/database preflight, 30/10/2026 (audit complete; deployment unverified)

The user authorized read-only investigation. No cluster/container was created,
no Linux distribution installed, no app/DB/env/hosts/HBA/firewall setting changed,
and no existing service stopped. Evidence snapshot (ignored, no credentials):
`.local-backups/m105a-survey-20261030.json`. This section supersedes the earlier
Compose-era topology below; it is a feasibility assessment, not deployment evidence.

Measured now:

- Windows11Pro,15.77GiB RAM,3.21–3.32GiB available; i5-11400H6cores/12threads.
  C has18.15GiB free and D65.45GiB. Largest grouped working sets included Chrome
  ~2719MiB, ChatGPT~1727MiB, Code~1515MiB, Postman~809MiB; shared pages mean
  these sums are not additive private RAM. No apps were closed automatically.
- Docker28.1.1/WSL2 currently running,12CPUs/8201146368bytes guest total memory;
  guest MemAvailable7358868KiB must not be added to Windows available RAM or
  interpreted as all physically committed/free host memory. No .wslconfig exists.
  Only docker-desktop distro registered; no separate Ubuntu installation observed.
  CIM reports HypervisorPresent=true but VirtualizationFirmwareEnabled=false;
  running WSL2 verifies virtualization works, so do not infer BIOS needs changing.
- Docker VHD on D is3.85GiB; one306.1MB image, stopped dacn2-postgres-1, retained
 73.04MB volume, no running containers. system df again showed negative image
 reclaimable: anomaly recorded, not used to justify cleanup. No prune/delete.
- kubectl1.32.2/Kustomize5.5.0; no current context or context names. k3d/k3s/kind/
  minikube absent from PATH; no claim about every filesystem location/external
  cluster. No Dockerfile or cluster manifests found. No API-server query performed.
- Windows PostgreSQL17.8 (distinct from historical Docker17.11), service running,
  loopback app login PASS. Loaded listen_addresses='*', port5432, ssl=off,
  max_connections100, shared_buffers128MB. Actual listeners0.0.0.0 and[::]:5432.
  Inspected installed data-directory pg_hba.conf has only loopback TCP sources
  with scram-sha-256; pg_hba_file_rules/active firewall policy were not audited.
  Bind-all alone does not prove an external client can authenticate.

Network findings and limits:

- From the existing docker-desktop distro, host.docker.internal resolves to an
  address not assigned to Windows at this snapshot; one bounded TCP5432 probe
  failed. A Windows probe to the same resolved address timed out; no further
  probing of that unverified address was performed after the mismatch was found.
- WSL default gateway172.20.48.1 is assigned to Windows vEthernet. A single2s
  TCP5432 probe from the distro to this verified host address also failed. These
  are preflight TCP failures, not PostgreSQL password/HBA failures or a proven
  firewall root cause. No credentials sent by the probes.
- Distro resolver/network is not the same as a Docker container or K3s Pod.
  Container/Pod DNS, TCP and authenticated SELECT remain NOT_TESTED. Do not assume
  a host alias or fixed WSL IP works in the Pod; addresses may change on restart.
- Existing Windows backend binds127.0.0.1:3000. Inside a Pod that would prevent
  Service/NodePort access; future container config must bind0.0.0.0 inside the Pod
  while retaining loopback default for Windows. No source/env change made here.
- Backend pool max10;5replicas could request up to50connections before other
  clients/DACN1/test/admin usage. This arithmetic is not proof of enough DB capacity.

Conditional proposal, not an installed/approved cluster:

1. Keep Gateway/TLS/client observation on Windows, PostgreSQL on Windows, Colab for
   training. Try k3d with one K3s server and no agent; optional no loadbalancer/
   Traefik/ServiceLB if using direct NodePort mapping, to avoid unused components.
   k3d still needs Docker: moving PostgreSQL native removed only its Docker dependency,
   not the future cluster runtime. Do not put K3s inside the managed docker-desktop distro.
2. Start with one backend Pod and a loopback-only published HTTP port to NodePort,
   then point host Gateway to that port. No public/0.0.0.0 host publish. Keep K3s
   embedded lab datastore; do not reuse DACN1/dacn2 as cluster control-plane datastore.
3. Treat host.docker.internal as a candidate for Windows DB access; test from an
   explicitly selected temporary container first, then from the actual Pod.
   host.k3d.internal is another k3d alias, not proof it targets Windows rather than
   the Docker VM. Record resolved addresses and actual server-observed source IP.
4. Resolve DNS/TCP before changing authentication. If access changes are necessary,
   propose only observed source range + dacn2 + dacn2_app, SCRAM and scoped network
   access; no trust/all-database/all-interface allow rules. Preserve DACN1 and the
   working Windows loopback setup. Secrets stay outside Git/logs. Current ssl=off
   means no TLS guarantee for a future non-loopback DB link; scope that explicitly.
5. kubectl1.32.2 cannot be presumed compatible with the chosen future API server.
   Pin supported k3d/K3s/image/client versions and check ±1minor kubectl skew before
   install; prefer a project-specific client over overwriting Docker's bundled one.
6. Recheck host RAM after the user closes unneeded apps. Aim for ~5GiB available
   before a short single-node trial as a conservative project gate, NOT a vendor
   minimum or a measured requirement; this leaves headroom beyond the K3s baseline
   and one Pod. With current~3.2GiB, full local AI/monitoring/generator/1–5Pod lab
   feasibility is unproven. No cluster memory reservation or runtime limits chosen yet.

If the user requires Docker Desktop to stay off, direct K3s on a new WSL Linux
distribution or another controlled Linux lab is a separate topology choice, not
a drop-in implementation or a proven RAM saving. Preserve the planned stack and
academic scope; no automatic feature reduction.

Next scope recommendation: M1-05b isolate container-to-Windows PostgreSQL
DNS/TCP/authentication using a bounded disposable probe, after user scope choice.
No cluster creation until that path and available RAM are understood. Later install
must verify Ready/DB read-write/stop-recovery/cleanup before M1-05 DONE; one-Pod
benchmark remains M1-06, not a guessed capacity value.

Primary references checked30/10/2026: [K3s requirements](https://docs.k3s.io/installation/requirements)
(Linux;2cores/2GB server baseline excludes workloads),
[k3d architecture/options](https://k3d.io/stable/usage/commands/k3d_cluster_create/),
[k3d host alias](https://k3d.io/stable/faq/faq/#how-to-access-services-like-a-database-running-on-my-docker-host-machine),
[Docker host networking how-to](https://docs.docker.com/desktop/features/networking/networking-how-tos/),
[PostgreSQL HBA](https://www.postgresql.org/docs/17/auth-pg-hba-conf.html),
[kubectl skew policy](https://kubernetes.io/releases/version-skew-policy/).

### M1-04 telemetry boundary — 2026-10-30 (implemented, locally verified)

Use one JSON completion event per HTTP request and a Gateway-owned liveness endpoint
at /gateway/health, keeping /health proxied to the workload. This distinguishes a
live Gateway from a failed backend and prevents local probes becoming scaling input.
Use direct TCP peer IP for the current loopback topology; ignore caller-supplied
forwarding headers and rebuild upstream XFF from the actual peer. Introduce trusted
proxy identity only with a separate topology/authorization decision. Request IDs
are Gateway-generated and correlation-only. Use existing console logging without
new services/queues/client state; synchronous output may block and has no durability
or throughput guarantee. Canonical schema, privacy bounds and verification criteria
are in docs/API_CONTRACT.md; definitions in docs/FEATURE_SPEC.md. M1-04b implemented
the boundary in telemetry.go/main.go; regression/race tests and compiled lab smoke
passed, with evidence in docs/PROGRESS.md. Window/ML/scaling contracts remain separate.

### Local DB hosting override — 2026-10-30 (verified)

At the user's request, use the already installed Windows PostgreSQL 17 at 127.0.0.1:5432 instead of requiring Docker Desktop for local backend work. Data directory: C:/Program Files/PostgreSQL/17/data. Restore both existing databases, preserve owners/grants/sequences and application password; DACN1 remains untouched. Owner dacn2_admin is NOLOGIN/NOCREATEDB/NOSUPERUSER; backend uses dacn2_app with existing limited grants. Docker DB on 15432 is stopped, with volume retained for recovery. Backups, row-hash/sequence comparisons, Windows E2E and smoke after stopping Docker are documented in docs/PROGRESS.md. This changes local DB hosting only; Go/Python/NestJS/PostgreSQL/K3s boundaries and isolated CI service remain. Pod-to-Windows DB connectivity is not implemented or verified. Earlier Compose topology/resource measurements below are historical.

- Go Gateway terminates TLS, proxies admitted traffic, captures HTTP/TLS/H2 evidence, aggregates five-second windows, and applies per-client policy.
- Python/FastAPI validates window contracts, runs four-class ML inference, coordinates policy, and controls scaling.
- NestJS/PostgreSQL provide a dynamic demo workload; K3s scales backend replicas from admitted RPS and measured one-Pod capacity.
- Prometheus/Grafana expose actual traffic, classification, mitigation, latency, resource use, and replica state.

These boundaries are recorded in the user's master plan and justify the multi-component lab. Installed development versions are recorded below. Cluster versions, runtime topology, certificates, RBAC and deployment resource settings still require implementation/verification.

## JA4 independent capture — 2026-10-30

Verified one real Postman ClientHello with Wireshark/TShark 4.6.9 and Npcap 1.88, using bounded loopback-only capture (TCP 8443; 30 s/1 MB/200 packets). Actual 49 packets/0 drops; TShark JA4 at frame 4 was t13i180900_5d04281c6031_78e6aca7449b, identical to the previously reported Gateway log. Evidence and PCAP SHA256 are in docs/PROGRESS.md; raw capture stays ignored/local. No TLS keys were needed because ClientHello is visible in the handshake. This result covers Postman, not independent browser/H2 fingerprint capture; no client identity or bot attribution claim follows from this JA4. Gateway raw/original variants remain unimplemented.

## Diagnostic HTTP/2 baseline — 2026-10-30

Verified real Chrome 156 headless HTTP/2 with a bounded loopback capture and the user's opt-in Go TLS KeyLogWriter. Keys stay in ignored local storage and are used only for offline Wireshark/TShark decoding, not a proposed production capture path. Observed SETTINGS, connection WINDOW_UPDATE, first request pseudo-header order, HEADERS priority metadata and response 200; exact values/evidence are in docs/PROGRESS.md. No standalone PRIORITY frame was seen in this sample; HEADERS still carried priority information. Diagnostic capture succeeds, but the Gateway has no live H2 frame observer or Akamai serialization/hash yet. Gateway stopped after verification to end key logging; clear the user's shell variable before restart. Application source was not changed by the agent in this slice.

## Documentation ownership — 2026-10-29

Decision: keep the master plan at its actual root path; use tasks/current.md as the single execution tracker, this file for decisions, and docs/PROGRESS.md for session handoff. Do not create duplicate docs/TASKS.md, docs/DECISIONS.md, or skill-default trackers.

Reason: existing AGENTS.md establishes canonical project memory; one tracker avoids conflicting completion states. The user's documentation-alignment request authorizes this organizational change, not new technical scope or reduced standards.

Alternatives: adopting the master plan's separate TASKS/DECISIONS logs or adding upstream skill-default trackers. Rejected because these duplicate existing canonical responsibilities.

Impact: checkpoint references in the plan are aligned; application architecture and report KPI targets are unchanged. Verification: local Markdown link and consistency checks recorded in docs/PROGRESS.md.

## Decisions still required

- Validate the proposed Windows/Docker/k3d topology under actual workload in M1; survey results below do not prove full-lab capacity.
- Feature/cross-service contracts beyond the local course-registration backend API.
- Mandatory 12-feature scope for academic acceptance; retain the target until clarified.
- Academic acceptance for lab versus production/external users; keep evidence categories distinct.

Future significant decisions record date, status, rationale, alternatives, verification, and impact on the master plan/report here. Do not present proposed choices as measured facts or approved report changes.

## Local registration consistency — 2026-10-29

User-requested simplification: the backend is only a student-lab API workload. Source is flattened into five files (main, app.module, courses.controller, courses.service, database.service); input checks and response interfaces live beside their callers. One module wires the providers; no feature modules or standalone pipes/types are needed at this size. Unit tests and E2E tests are each consolidated into one file. The unused Hello World root endpoint is removed; health/read/write endpoints and transaction behavior remain. Existing migrations and data are retained. No additional backend business features are planned. The Go/AI/K3s/monitoring boundaries above remain the main project work.

Implemented: PostgreSQL transactions on one checked-out client, with course-row `FOR UPDATE` lock before duplicate/capacity checks. Insert and counter update commit together. Local lock/statement timeouts are 3/5 seconds; failed rollback discards the connection. This serializes writes for each course across backend processes and preserves the existing schema constraints without a cache or distributed lock.

The local NestJS server binds loopback. Synthetic studentCode is caller supplied and normalized uppercase; it is not authenticated identity. Define auth/network controls before networked deployment; Go mitigation does not replace authorization. Contract: docs/API_CONTRACT.md.

E2E uses separate dacn2_test, with test-only INSERT/DELETE permissions for fixture cleanup. Demo grants are unchanged. Verified: 8 unit and 9 E2E tests, including concurrency and rollback. K3s deployment remains unverified.

## M0-01 — Khảo sát môi trường, 29/10/2026

Trạng thái: hoàn thành khảo sát và ghi giới hạn; chưa cài cluster, chưa kiểm chứng năng lực full lab. Các số RAM/disk/CPU dưới đây là snapshot, không phải cam kết tài nguyên hay benchmark.

### Phần cứng và lưu trữ đã đo

- Windows 11 Pro 64-bit; i5-11400H @2.70 GHz, 6 core/12 logical processors.
- RAM total 15.8 GB; available 2.1 GB tại lần khảo sát này. C trống 19.7 GB, D 66.1 GB.
- Docker nhìn thấy 12 CPU, memory limit 8,201,138,176 bytes (~7.64 GiB). Đây là giới hạn dùng chung của engine, không phải RAM được giữ sẵn cho cluster; cần xét cả Windows và ứng dụng khác.
- Docker disk image đã chuyển sang `D:\DockerData\DockerDesktopWSL\disk\docker_data.vhdx`; file hiện khoảng 4.13 GB. Source đặt tại `D:\DACN2`.
- Một container đang chạy: dacn2-postgres-1 healthy, 127.0.0.1:15432 → 5432; snapshot docker stats 36.09 MiB, CPU 1.39%. Không suy ra tài nguyên database khi chịu tải từ snapshot idle này.
- docker system df: 1 image khoảng 306.1 MB, 1 container, 1 volume khoảng 72.9 MB, không build cache. Docker báo reclaimable image âm: không dùng giá trị bất thường này để kết luận dung lượng có thể thu hồi, không chạy prune.

### Công cụ và dependency thực tế

- Git 2.49.0.windows.1; Go 1.27.3 windows/amd64; Python 3.13.3; Node 20.20.2; npm 10.8.2.
- Docker Engine/Client 28.1.1; Compose v2.35.1-desktop.1. Desktop UI phiên storage trước là 4.41.2; không kiểm tra updater trong khảo sát này.
- WSL 2.5.7.0, kernel 6.6.87.1-1. Inventory chỉ có docker-desktop đang Running, WSL version 2; không thấy Ubuntu distribution riêng. VM VirtualBox cũ đã xóa theo thông tin người dùng; chưa audit hypervisor/VM khác.
- kubectl client 1.32.2, Kustomize 5.5.0. k3d/kind/minikube không có trong PATH; điều này không chứng minh không có binary ở nơi khác. Chưa truy cập kubeconfig/cluster ngoài phạm vi hoặc bật Kubernetes trong Docker Desktop.
- npm ls xác nhận @nestjs/core 11.2.8, @nestjs/config 4.0.4, pg 8.23.1, TypeScript 5.9.3. PostgreSQL server 17.11; image cấu hình postgres:17-alpine. Đây là inventory, không phải chứng nhận phiên bản còn được hỗ trợ hay tương thích mọi package tương lai.
- Train model trên Google Colab theo quyết định người dùng; dependency ML/Gateway và runtime inference chưa được chọn/kiểm chứng.

### Repository và dịch vụ đã có

- backend/src gồm app, courses và database modules; database/migrations có 001–003; test có read/registration E2E, setup chọn dacn2_test và grants riêng cho fixture.
- backend/package.json và lockfile, Compose, env examples, docs và tasks tồn tại. Có scripts lint/build/unit/E2E/start, chưa có CI, Dockerfile/K3s manifests, Gateway, AI service, dataset/model hay monitoring artifacts trong inventory.
- Hai DB demo/test và local backups đã được xác minh ở phiên storage. Backup ignored tại `.local-backups/postgres-20261029-220228/`; chưa restore rehearsal và chưa có bản sao ngoài máy.
- Repo có thay đổi local từ các phiên trước; giữ nguyên. Không commit/push hay in secret trong khảo sát này.

### Phương án lab đề xuất cho M1, chưa triển khai

1. Dùng Windows để phát triển; tận dụng Linux engine/WSL2 hiện có. Khi chuyển M1, thử k3d với một K3s server node, chưa thêm worker riêng. k3d chạy K3s trong Docker nên phù hợp về kiến trúc với nền tảng hiện có; đây là suy luận từ môi trường và tài liệu, chưa phải thử nghiệm thành công.
2. Bắt đầu một backend Pod; nhiều replica có thể chạy cùng node. Không coi nhiều Pod trên một máy là HA hay scale nhiều máy. Chưa chọn phiên bản k3d/K3s; phải pin phiên bản tương thích khi triển khai.
3. Giữ PostgreSQL Compose hiện tại trong lúc hoàn thiện M0. Trước deploy K3s, chọn và test đường kết nối DB riêng: endpoint host đang bind loopback không được mặc nhiên coi là truy cập được từ Pod. Không tự mở DB ra LAN; cân nhắc Docker network nội bộ hoặc persistence trong cluster với backup/restore đã kiểm tra.
4. Backend hiện bind 127.0.0.1; deployment trong container/Pod cần cấu hình bind phù hợp và giới hạn ingress, đồng thời chốt lab identity/network boundary. Không đổi bind/config hiện tại trong khảo sát.
5. Colab đảm nhiệm training; inference/FastAPI, Gateway, monitoring và generators sẽ cạnh tranh CPU/RAM local. Xác minh TLS/H2 thật và client identity/NAT khi chọn vị trí Gateway/generators; không coi topology container tự bảo đảm capture đúng.

### Điều kiện cần kiểm chứng trước khi gọi topology khả thi

- RAM available hiện chỉ 2.1 GB. K3s công bố baseline server 2 core/2 GB và không gồm workload; chưa đủ cơ sở kết luận chạy thêm cluster + full workload ổn định. Đóng ứng dụng không cần thiết rồi đo lại; không tự tắt ứng dụng hay tăng memory limit trong phiên khảo sát.
- Chỉ sau khi M0 còn lại hoàn tất và người dùng chọn phần M1: pin versions, tạo cluster lab giới hạn, đo RAM/CPU idle, deploy một backend Pod và kiểm tra health/DB. Sau đó mới thêm inference/monitoring, rồi chạy bounded load; theo dõi Ready/OOM/restart và Windows memory pressure.
- Chốt cặp kubectl/K3s theo policy tương thích: kubectl được hỗ trợ trong ±1 minor version so với kube-apiserver. Không lấy kubectl 1.32.2 hiện tại làm lý do chọn cluster cũ, cũng không tự nâng cấp trong khảo sát.
- M1-05 cần Pod Ready + request qua đường truy cập dự kiến + DB persistence; M1-06 cần benchmark một Pod. Chưa có bằng chứng cho 1→5 Pods, tốc độ scale hay đủ tài nguyên chạy tất cả thành phần.
- Nếu máy không đủ tài nguyên sau đo, ghi blocker và trình phương án lab Linux khác cho người dùng; không tự giảm số feature hoặc điều kiện nghiệm thu.

Nguồn kỹ thuật đã đối chiếu ngày 29/10/2026: [K3s requirements](https://docs.k3s.io/installation/requirements), [k3d overview](https://k3d.io/stable/), [Kubernetes version skew](https://kubernetes.io/releases/version-skew-policy/). Các nhận định về RAM của máy dựa số đo local; tài liệu upstream không chứng minh năng lực của máy này.
