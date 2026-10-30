# Deployment and recovery

Updated: 2026-10-30. M1-05c backend container smoke and M1-05e empty K3s cluster
trial and M1-05f actual Pod-to-WindowsDB read-only probe verified on this Windows
Docker Desktop host. M1-05g backend Deployment/Service read smoke also verified;
cluster stopped, lab resources retained. No production deployment configured.

## Backend container smoke

Prerequisites: Docker Desktop Linux engine running, existing Windows PostgreSQL
on 5432, restored `dacn2` schema and non-admin application login in ignored
`backend/.env`. No migration/bootstrap needed on this machine. Build needs registry
and npm access. Available host RAM was only 1.63 GiB before this slice; run checks
sequentially, stop on resource errors, and reassess before any cluster trial.

From `D:\DACN2`, build the pinned base/locked dependencies:

```powershell
docker build -t dacn2-backend:m105c ./backend
if ($LASTEXITCODE -ne 0) { throw 'Backend image build failed' }
```

Run a single container for a short read-only API check. Published port 13300 is
loopback-only, leaving existing Gateway/backend ports 8443/3000 untouched. This
uses the image's default CMD. The name must be unused; the script never removes
a pre-existing container. DB env values are held in Docker runtime metadata until
removal, so use only the application login and never print `docker inspect` env
or commit/share the env file.

```powershell
$smokeName = 'dacn2-backend-manual-' + [guid]::NewGuid().ToString('N')
docker run -d --rm --pull=never --name $smokeName `
  --read-only --cap-drop=ALL --security-opt=no-new-privileges:true `
  --memory=192m --memory-swap=192m --cpus=0.5 --pids-limit=64 `
  -p 127.0.0.1:13300:3000 --env-file backend/.env `
  -e DB_HOST=host.docker.internal -e DB_PORT=5432 `
  -e HOST=0.0.0.0 -e PORT=3000 -e NODE_OPTIONS=--max-old-space-size=96 `
  dacn2-backend:m105c
if ($LASTEXITCODE -ne 0) { throw 'Container start failed; check port/name/resources' }
try {
  $ready = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try {
      $health = Invoke-RestMethod http://127.0.0.1:13300/health -TimeoutSec 1
      if ($health.status -eq 'ok' -and $health.service -eq 'dacn2-backend') {
        $ready = $true
        break
      }
    } catch { Start-Sleep -Milliseconds 250 }
  }
  if (-not $ready) { throw 'Backend readiness failed; inspect container startup logs' }
  $health
  $courses = Invoke-RestMethod http://127.0.0.1:13300/courses -TimeoutSec 2
  $courses
  Invoke-RestMethod "http://127.0.0.1:13300/courses/$($courses[0].id)" -TimeoutSec 2
} finally {
  docker stop --timeout 3 $smokeName
}
docker ps -a --filter "name=$smokeName"
```

Expect HTTP 200, five courses on the current demo DB, readable Vietnamese names,
and no remaining smoke container. No POST request is needed on the demo DB.
Emergency stop from another terminal: `docker stop --timeout 3 <smoke-name>`.
If startup fails, inspect `docker logs <smoke-name>` while the container exists;
do not alter HBA/firewall or reset the DB to make a check pass.

## Cleanup and recovery

The container is disposable (`--rm`), has no mounted DB volume, and API smoke uses
GET only. Native Windows backend/Gateway and Windows PostgreSQL run independently;
this procedure does not start or stop those services. Do not use
`docker compose down -v` or prune commands.
The lab image/base image/build cache are retained for reproducibility.

To return to native backend startup, stop the smoke container and use
`npm run start:dev` from `backend` in a separate terminal with the existing env.
Native bind defaults to 127.0.0.1 if HOST is unset. Preserve existing servers;
do not start another process on port 3000 if one is already running.
DB backup/restore and the historical Docker-DB fallback are in
[backend README](../backend/README.md#windows-postgresql-current-local-setup).

## Verification evidence and limits

2026-10-30: no-fix ESLint/build/8 unit/9 E2E PASS on host Node 20.20.2;
Docker build PASS on Node 24.22.2. Compiled native default bind127.0.0.1 and
container health/list/detail200 verified. Runtime UID1000, no `.env`, `src` or
Nest CLI; read-only filesystem,192MiB/0.5CPU/64PIDs. Demo5courses/3registrations
and row hashes unchanged. Own server/container stopped. Evidence is local ignored
`.local-backups/m105c/1793363254953/result.json`, with secret-free helper
`.local-backups/m105c/smoke.cjs` (60-second outer bound).
Container runtime smoke covers read APIs, not the complete E2E suite on Node24.
No benchmark, load, K3s/Pod, hosted CI, production or real-user result is claimed.

## M1-05e trial design and execution

M1-05d completed the audit/design; M1-05e executed the bounded trial. The user reports that other open apps
consume RAM and will close them for the later trial. Do not close their apps.
Fresh available RAM target≥5GiB before create is a project heuristic; the audit
snapshot2.83GiB is temporary, not a hardware-failure finding. Check resources:

```powershell
Get-CimInstance Win32_OperatingSystem | Select-Object `
  @{Name='AvailableGiB';Expression={[math]::Round($_.FreePhysicalMemory/1MB,2)}}
docker ps
kubectl version --client
```

Expected now: no running containers, existing client1.32.2; free RAM varies.
These commands do not install/start anything. Client1.32.2 is an inventory check
only, not the client for the proposed API1.35.9. Full selected versions/checksums
and primary references are in [ARCHITECTURE](ARCHITECTURE.md).

Execution sequence retained for reproduction (check existing cluster ownership;
do not rerun create over the retained trial cluster):

1. Recheck RAM/disk/ports and absence of a cluster named `dacn2-m105e`; never
   replace an existing cluster. Download k3d5.9.0 and kubectl1.35.9 into ignored
   `.local-backups/tools/`, verify SHA256 against recorded publisher checksums,
   then verify version/--help. Preserve Docker's kubectl and global PATH.
2. Pull the exact K3s release image and compare the OCI index/platform digest to
   the recorded values before use. Do not substitute latest or silently change
   versions. Limit the overall attempt to10minutes and record resource snapshots.
3. Create one server, zero agents, no LB with the verified flags:
   `--servers 1 --agents 0 --no-lb`,
   `--servers-memory 3072m`, `--image rancher/k3s:v1.35.9-k3s1`,
   `--api-port 127.0.0.1:16443`, `--port 127.0.0.1:13000:30080@server:0:direct`,
   `--k3s-arg --disable=traefik@server:0`,
   `--k3s-arg --disable=servicelb@server:0`, `--timeout 180s --wait`,
   `--kubeconfig-update-default=false --kubeconfig-switch-context=false`.
   Include an own run-id runtime label on server0 for cleanup ownership. The
   `:direct` suffix is required for this no-LB setup: a filter without it defaults
   to proxy mode and fails before creation. k3d also creates a tools helper; one
   K3s server does not mean one total Docker container. In this version Docker
   HostConfig uses API port key `6443`, while NodePort uses `30080/tcp`; normalize
   protocol keys before assertions, then verify actual host IP/port values.
4. Store kubeconfig in ignored `.local-backups/m105e/` without printing it or
   merging it into the default config. Use explicit kubectl executable and
   `--kubeconfig` for every check. Verify API health and wait≤120s for the single
   node Ready; check CoreDNS and system Pod errors, OOM/restarts, host/guest memory
   and actual Docker port bindings. Saving an admin kubeconfig is secret handling;
   keep it local with restricted access. Do not expose the API on the LAN.
5. Verify stop/start and Ready recovery within the remaining bound, then stop
   the own cluster. On setup failure/emergency, collect sanitized error evidence
   and delete only the newly-created, ownership-verified trial cluster if needed.
   No prune/global cleanup, no original DB-volume removal. Check remaining own
   containers, context unchanged and host resources after cleanup.

Acceptance for M1-05e: verified tool hashes/versions and explicit kubeconfig;
one node Ready/API healthy with loopback-only bindings under stated bounds;
stop/recovery/cleanup evidence with no unrelated changes. If RAM drops below1GiB,
OOM/restart loops occur, the host becomes unresponsive or the time limit expires,
stop the own trial and report failure. K3s memory cap is an experiment, not a
guarantee of capacity. No backend Pod, DB secret/write, Gateway config change,
load, model or monitoring stack in this first trial.

Later M1-05 scope separately verifies backend Pod/WindowsDB DNS+TCP+auth,
health/read/write in test DB, trusted-client network boundary, recovery/cleanup
and Gateway path. M1-06 then measures one-Pod capacity; a Ready node alone does not
complete M1-05 or prove full-lab1–5Pod feasibility.

## Reuse the stopped M1-05e cluster

Verified2026-10-30: k3d5.9.0/K3s1.35.9+k3s1/kubectl1.35.9, one node Ready,
API `/readyz`ok, CoreDNS/local-path/metrics-serverReady, stop/start recoveryPASS.
Default kubeconfig untouched. Cluster `dacn2-m105e` is **stopped**; one server
and one k3d-tools container retained. Server3GiBcap does not cap total Docker/
WSL memory or tools helper. No backend Pod/DBsecret/write/load introduced.
Application checks not repeated for this infrastructure-only slice.

Evidence: `.local-backups/m105e/1793364531571/result.json` and
`.local-backups/m105e/1793364531571-resume-1793364615141/result.json`.
The latter verifies all three system PodsReady after warmup and recovery.
Admin kubeconfigs are ignored/ACL-restricted; never print/commit/share contents.
Tools/images remain local-only.

Inspect the stopped state from `D:\DACN2` without starting anything:

```powershell
& ./.local-backups/tools/k3d-v5.9.0.exe cluster list
docker ps -a --filter label=k3d.cluster=dacn2-m105e
```

Expect0/1serversrunning; server and tools exited. To repeat a short check,
first close unneeded apps yourself and have≥5GiBfree. Use explicit project
tools/config; preserve Docker's older kubectl and default context.

```powershell
$ErrorActionPreference = 'Stop'
$k3dTool = '.\.local-backups\tools\k3d-v5.9.0.exe'
$kubectlTool = '.\.local-backups\tools\kubectl-v1.35.9.exe'
$trialKubeconfig = '.\.local-backups\m105e\1793364531571-resume-1793364615141\kubeconfig.yaml'
$freeGiB = (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB
if ($freeGiB -lt 5) { throw 'Close unneeded apps and recheck RAM before trial' }
try {
  & $k3dTool cluster start dacn2-m105e --timeout 120s --wait
  if ($LASTEXITCODE -ne 0) { throw 'Cluster start failed' }
  & $kubectlTool --kubeconfig $trialKubeconfig --request-timeout=10s get --raw=/readyz
  if ($LASTEXITCODE -ne 0) { throw 'API readiness failed' }
  & $kubectlTool --kubeconfig $trialKubeconfig wait --for=condition=Ready node --all --timeout=120s
  if ($LASTEXITCODE -ne 0) { throw 'Node Ready failed' }
  & $kubectlTool --kubeconfig $trialKubeconfig -n kube-system rollout status deployment/metrics-server --timeout=90s
  if ($LASTEXITCODE -ne 0) { throw 'Metrics readiness failed' }
  & $kubectlTool --kubeconfig $trialKubeconfig get pods -A
  if ($LASTEXITCODE -ne 0) { throw 'System Pod query failed' }
} finally {
  & $k3dTool cluster stop dacn2-m105e
  if ($LASTEXITCODE -ne 0) { throw 'Cluster stop failed; use emergency stop below' }
}
```

Expect `ok`, a Ready node and three ready system Pods; cleanup stops the cluster.
No HTTP backend response expected on13000 yet: only the Docker mapping exists.
Emergency stop from another terminal:
`& ./.local-backups/tools/k3d-v5.9.0.exe cluster stop dacn2-m105e`.
If CLI stop fails, verify exact names/`k3d.cluster` label before stopping only
`k3d-dacn2-m105e-server-0` and `k3d-dacn2-m105e-tools`. Do not prune or remove
PostgreSQL/DACN1 data. Normal cleanup retains cluster network/volumes/images;
deletion is not required.

## M1-05f Pod database probe

Verified2026-10-30: actual restricted Pod reaches WindowsPG5432 using
`host.docker.internal`. DNS/getent, pg_isready TCP check, pre-auth SASL10 advertising
SCRAM-SHA-256, app login and SELECT on both dacn2/dacn2_test PASS. Actual Windows
PG17.8 sees client127.0.0.1, read_onlyon, sslfalse. No HBA/firewall/DBconfig changes.
Demo5courses/3registrations and test5courses/0registrations; row hashes before/after
unchanged. No demo write. PodIP10.42.0.20 is not the DB-observed peer address.
getent reported IPv6 host alias, not a complete address list or selected libpq route.

Probe source is local-only `.local-backups/m105f/probe.cjs`; evidence
`.local-backups/m105f/1793365214835-bc3ea7/result.json` and manifest/logs. Initial
multi-platform tag import failed with missing content digest. Installed Docker
supports single-platform export, and these tested steps imported cached amd64:

```powershell
# Example only when the owned cluster is running; the successful run retained
# its archive under .local-backups/m105f/1793365214835-bc3ea7/.
docker image save --platform=linux/amd64 -o .local-backups/m105f/postgres-amd64.tar postgres:17-alpine
& ./.local-backups/tools/k3d-v5.9.0.exe image import .local-backups/m105f/postgres-amd64.tar --cluster dacn2-m105e --mode direct
```

To repeat the complete controlled probe from `D:\DACN2`, ensure Docker/WindowsPG
running, original cached postgresimage unchanged, owned cluster stopped and≥5GiB
hostfree. Helper uses installed backendpg/dotenv and existing ignored appenv,
verifies cluster ownership, starts it, imports a cached single-platform image,
creates one uniquely-labelled Pod, and stops everything it started:

```powershell
node .local-backups/m105f/probe.cjs
if ($LASTEXITCODE -ne 0) { throw 'Probe failed; inspect its local result.json' }
```

Expect pass:true, readonlyon for bothDBs, matching hashes, podCleanup confirming
UID/label-owned Pod deletion and finalClusterRunning empty. The Pod uses nonroot
65534/read-onlyrootfs/dropcaps/noServiceAccountToken,64Mi/250m, activeDeadline300s;
whole helper≤10min. Password travels in execstdin only; do not substitute it into
kubectl args, manifest, Secret, shellhistory or logs. Helper/archives/results are
ignored local evidence, not committed deployment artifacts or CI coverage.

Afterward inspect the stopped cluster with the commands above. The successful
probe Pod has already been removed. On interrupted runs, use explicit kubectl
and private kubeconfig to inspect `get pods -l dacn2.task=M1-05f -o wide`; match
the Podname/UID/runlabel in that run's result before deleting only the own probe,
then stop dacn2-m105e. Never delete arbitrary Pods, namespaces or DB volumes.
No backend API is deployed on13000 yet; this proves only the measured PodDB path.

## Backend Pod (M1-05g)

`kubernetes/backend.yaml` defines dacn2-lab namespace, backendDeployment1replica
and NodePort30080. Controlled host exposure is127.0.0.1:13000. CPUrequest100m/
limit500m, memory96Mi/192Mi; nonroot1000/read-only/dropcaps/noSAToken. Recreate
strategy avoids an extra surge Pod at the cost of rollout downtime. Existing
`/health` only reports HTTP process liveness; database reads are checked separately.
See API_CONTRACT for the lab trust boundary and Secret/probe semantics.

From `D:\DACN2`, Docker/WindowsPG running and≥5GiBhostfree before a stopped-cluster
start, use the project-local tools/private kubeconfig already set up above:

```powershell
# Deploy/check read-only routes, then stop cluster; default safe verification.
node scripts/backend-lab.cjs verify
# Deploy/check and leave the lab running explicitly for the next manual steps.
node scripts/backend-lab.cjs start
# Check existing deployment/read APIs, then stop cluster.
node scripts/backend-lab.cjs check
# Emergency/normal stop (retains lab resources and volumes).
node scripts/backend-lab.cjs stop
```

Run one action at a time; inspect its exit code/result.json. Script has a10minute
bound, fresh RAM check and<1GiBemergency stop. It verifies owned cluster/loopback
bindings, imports cached amd64 image, validates manifests against APIserver, creates
private DBpasswordSecret from ignored backend.env via stdin (no secret file/argv/
output), applies resources, checks1ReadyPod and readAPI/inputerror behavior, then
stops unless explicitly invoked with `start`. Existing labelled Secret is retained,
not automatically rotated. Secret base64/data remain in the local cluster datastore;
private admin kubeconfig/Docker users can access them. No production secret-store claim.

M1-05g evidence `.local-backups/m105g/1793366302157/result.json`: health/list/detail200,
invalidID400/missingID404, UID1000/Node24.22.2/noenvfile/notoken, noOOM/restarts0,
demo5courses/3registrations+hashes unchanged, cluster stopped/defaultconfig unchanged.
Earlier first create reachedReady after2exit1restarts; cause not captured. Repeat
cold-start passed with0restarts; do not claim a diagnosed/fixed startup bug. APIserver
schema validation, script syntax and later read smoke verified; no full Node24E2E.

## M1-05h Gateway integration and recovery

Verified2026-10-30. Gateway accepts DACN2_UPSTREAM_URL (default HTTP127.0.0.1:3000)
and DACN2_LISTEN_ADDR (default127.0.0.1:8443); only literal loopback addresses and
explicit ports. Reject credentials/query/fragment/nonroot upstream paths and
nonlocal listeners. Transport connect timeout3s/header timeout5s. Native defaults
or Pod upstream13000 may be selected without retargeting existing processes.
Go fmt/vet/fulltests/race/build PASS after the configuration change.

Cold-cluster EAI_AGAIN was reproduced/captured. Deployment now has an unprivileged
no-secret initContainer waiting for host.docker.internal DNS,45sretry/60shardstop,
64Mi/100m; backend restart assertion remains0. Earlier g first-start uncertainty
is explained by captured h DNS failure, not by weakening restart checks.
`/health` remains process-only; initDNS is not continuous DB liveness.

Build/run the controlled end-to-end demo from project root:

M1-FIX01 (2026-10-30): integration now preserves the failing backend JSON report
in `backendFailure` and readable `error`: original reason, `availableRamGiB` when
measured, child exit code and child `evidencePath`. A4.52GiBpreflight refusal
reports that measured RAM and exact backend evidence instead of only
`node.exe exit=1`. The5GiBgate and startup/cleanup behavior are unchanged.
Malformed/missing reports retain exit status without inventing RAM or dumping
arbitrary stdout/stderr. Plaintext/base64 credentials are redacted in failures.

Regression checks need no Docker/DB/service startup or load:

```powershell
node --test scripts/lab-command.test.cjs
```

Six checks cover RAM refusal/cause/evidence, secret redaction, successful stdin/
stdout, unstructured failure, timeout and spawn failure. Historical user report
was replayed through a real child process. This does not claim a new successful
full M1 demo run. For that demo, build/run:

```powershell
Push-Location gateway
go build -o ../.local-backups/gateway-m1.exe .
Pop-Location
node scripts/m1-integration.cjs
```

Helper starts owned backend and a separate Gateway18443 with keylogging disabled,
validates the lab certificate via its configured CA/fingerprint, tests HTTPS/H2,
then temporarily selects dacn2_test. It proves the unique testfixture route before
POST, checks invalid400/create201/duplicate409/full409, scales owned backend0→1:
Gatewaylocalhealth200/proxy502/recovery200 and persisted testregistration. Finally
restore DB_NAMEdacn2/replicas1, delete ownfixture and stop own Gateway/cluster.
Test sequences advance; cleanup restores rows/hashes, not sequence values.
No demo write or global DB/service stop.

Ready precedes asynchronous Service endpoint propagation; helper records transient
502 reads while awaiting actual testfixture route(≤15s), never POSTs before that
proof. Recreate has expected rollout downtime. Gateway502 body is text/plain,
not backend JSON. Evidence `.local-backups/m105h/1793367144513/result.json`:
Initial16completionevents/IDs/failure-recoverystatuses retained; later expanded
race verification `.local-backups/m105h/1793367774888/result.json` has20events for
19HTTP1+1H2, real Pod last-seat and duplicate races one201/one409 with exact counter1.
Rows/hashes restored and ownprocesses/cluster stopped in both successful runs.

For an interactive demo, root `node scripts/backend-lab.cjs start`, then separate
terminal (existing8443 must be free):

```powershell
Set-Location D:\DACN2\gateway
Remove-Item Env:DACN2_TLS_KEYLOG -ErrorAction SilentlyContinue
$env:DACN2_UPSTREAM_URL = 'http://127.0.0.1:13000'
go run .
```

Postman paths: HTTPS127.0.0.1:8443/gateway/health, /health, /courses and a returned
courseID. Self-signed lab certificate is not installed as a system trust root;
use existing explicit lab certificate handling, not a production trust claim.
Stop GatewayCtrl+C in its own terminal, then root `node scripts/backend-lab.cjs stop`.
Use the automated helper for write/error/recovery so demo rows remain unchanged.

## M1-06 benchmark and current working capacity

From project root after building the Gateway binary above:

```powershell
node scripts/benchmark-m1.cjs
```

Only fixed GETcourses targets13000/18443 are allowed by this runner. It owns a
separate Gateway18443, starts/checks1backendPod, warms up, offers10→400RPS in
bounded tiers and repeats the highest passing tier twice for15s per target.
Max32inflight, request1s/body64KiB, generatorRSS256MiB, generatingwindow180s,
overall10min. Guard stops for hostfree<1GiB/errorburst; Ctrl+C requests cleanup.
Do not remove target/rate/duration bounds. Normal completion stops own Gateway,
RAMguard and cluster; `node scripts/backend-lab.cjs stop` is emergency fallback.
No writes, labels/bot scenarios or model dataset are generated here.

Verified result `.local-backups/m106/1793367470786/result.json` and summary.csv:
400offeredRPS passes both targets, four15s validations each6000HTTP200, no errors/
shed. Direct achieved399.64–399.83RPS,p953.29–3.37ms; Gateway399.97–399.99RPS,
p953.94–4.37ms. C_work319RPS includes explicit20%headroom from the minimum
observed validationgoodput. Saturation NOT_REACHED under400cap; not max capacity.
OnePod500m/192Mi/Node24.22.2, WindowsPG17.8/5courses, HTTP1keepalive, hostgenerator
Node20.20.2; manifest/backendimage/Go sources+binary hashes and host metadata in
environment.json. Recalibrate for different quotas, DBsize, endpointmix or apps.

All15946Gatewayevents reconcile dispatches and return200, DBhashesunchanged,
samePod0restarts/noOOM, generatorpeakRSS83.61MiB; RAMsamples≥5.80GiB (not a
transient-minimum proof), total157.4s/generating128.0s. No long-run stability,
full5Pod/AI/monitoring resource guarantee or public/prod benchmark claim.
Current scripts pin this host's ownedcluster/privatekubeconfig path; do not use
them to adopt/overwrite unrelated clusters or treat them as fresh-machine installers.
Finalcleanup observed serverExit137/OOMKilledfalse/Runningfalse; stop evidence
does not assert graceful control-plane shutdown. All own hostports released;
defaultkubeconfig unchanged, final freeRAM7.36GiB. If an interactive verification
is interrupted outside the benchmark's Ctrl+C handler, run the explicit stop
command and inspect only owned resources before resuming.
