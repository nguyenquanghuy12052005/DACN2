# DACN2 — L7 cyber-defense lab

## Tạo traffic bốn kịch bản và lưu CSV

Terminal thứ nhất, từ thư mục dự án:

```powershell
node scripts/dashboard-live.cjs --test-db --traffic-lab --no-browser
```

Chờ báo DEMO TRỰC TIẾP. Terminal thứ hai chạy từng lệnh:

```powershell
node scripts/generate-traffic.cjs Normal
node scripts/generate-traffic.cjs Flash_Crowd
node scripts/generate-traffic.cjs Pure_L7_DDoS
node scripts/generate-traffic.cjs Mixed_Traffic
```

Mỗi lệnh mặc định chạy20giây, dùng Chrome headless đã cài. Client hợp lệ xem
danh sách môn và định kỳ đăng ký fixture; client tấn công mô phỏng lặp request
đọc. Normal dùng1client, Flash4client, DDoS4client, Mixed2hợp lệ+2tấn công.
Thời gian nghỉ hợp lệ500–1500ms. Mỗi lượt có thư mục riêng dưới
`.local-backups/traffic/traffic-UUID/`, gồm `manifest.json`,
`ground-truth.jsonl` và `dataset/windows.csv` cùng event nguồn để replay.

Điều chỉnh thời lượng, trần dispatch và seed:

```powershell
node scripts/generate-traffic.cjs Mixed_Traffic --seconds=60 --rps=8 --seed=42
```

Trần dispatch là tổng số thao tác/giây, tối đa20. Thời lượng5–300giây,
tối đa4client/inflight của generator. Think-time hoặc client bận có thể làm
goodput thấp hơn trần; manifest ghi số thao tác bị bỏ lượt, lỗi và HTTP status.
Chỉ Gateway cố định127.0.0.1:18444 và DB test được phép. Mở Chrome demo thủ công
cùng lúc sẽ tạo event riêng trong Live, nhưng CSV generator chỉ chọn request
đối soát được bằng request ID của chính generator.

Dừng generator bằng Ctrl+C, hoặc terminal khác:

```powershell
node scripts/generate-traffic.cjs stop
```

Generator đóng các context/browser của nó. Khi đã chạy xong, dừng Live để dọn
fixture test:

```powershell
node scripts/dashboard-live.cjs stop
```

CSV dùng12feature hiện có. Nhãn biểu thị kịch bản do người vận hành chọn, có
ground truth cấp request lưu riêng. Thiếu request ID/không ghép được event thì
dataset để trống nhãn và ghi incomplete. Markov fixture của Live không được
chép vào CSV generator; l_markov chờ bảng tham chiếu train-only.
Các lượt này là pilot local, IP phần lớn chungloopback và API chưa có biến thiên
query/tài nguyên tĩnh. Dùng nhiều phiên độc lập và kiểm tra chất lượng trước khi
thu đại trà. Khi chia train/test, nhóm theo `split_group_id` (phiên Gateway gốc);
để có nhóm độc lập, dừng rồi mở Live mới giữa các phiên thu. Loại cửa sổ partial
khỏi tập train chính hoặc xử lý riêng theo đặc tả.

## Clone và chạy Live giống máy tác giả (Windows)

Chuẩn bị **đầy đủ một lần** trên máy nhận source:

1. **Windows 10/11 và PowerShell**. Hướng dẫn này dành cho Windows.
2. **Git for Windows** để clone/pull: https://git-scm.com/downloads/win.
   Nếu nhận ZIP thì không cần Git để chạy, nhưng không dùng được `git pull`.
3. **Node.js >=22.19.0 kèm npm**, thêm vào PATH khi cài: https://nodejs.org/en/download.
4. **Go >=1.27.3**, bộ cài Windows MSI, thêm vào PATH: https://go.dev/dl/.
   Cần Go trên Windows vì Gateway Live được build/chạy trực tiếp trên host.
5. **Google Chrome**, cài cho mọi người dùng ở
   `C:\Program Files\Google\Chrome\Application\chrome.exe`:
   https://www.google.com/chrome/. Bản chỉ cài trong AppData chưa được runner tìm.
6. **Docker Desktop kèm Compose v2**: https://docs.docker.com/desktop/setup/install/windows-install/.
   Hoàn tất yêu cầu WSL2/virtualization theo bộ cài, khởi động lại nếu được yêu cầu.
   Mở Docker Desktop, chờ engine sẵn sàng và chọn **Linux containers**.
7. **Đóng rồi mở lại PowerShell** sau khi cài để nhận PATH. Cần mạng để tải image,
   npm dependencies và Go modules/toolchain; không dùng offline cho lần đầu.

Không cần cài PostgreSQL Windows, NestJS CLI, Vite, OpenSSL, Python, K3s hay
AI để chạy bản Live này. Script tự cài dependencies dự án và chuẩn bị DB/env/cert;
không xin `.env`, mật khẩu hay chứng chỉ từ máy tác giả.

Kiểm tra cài đặt một lượt (sau khi clone):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\team-live.ps1 -CheckOnly
```

Lệnh này chỉ kiểm tra, không cài dependencies, tạo env hoặc khởi động container.
Nó liệt kê cùng lúc các công cụ thiếu, sai phiên bản, Chrome sai vị trí hoặc
Docker chưa sẵn sàng. Trước khi chạy Live, giữ các cổng5173/13001/18444 trống;
cổng15433 dành cho PostgreSQL Compose (không chạy DB khác chiếm cổng này).

Sau khi chuẩn bị đủ, mở PowerShell:

```powershell
git clone https://github.com/nguyenquanghuy12052005/DACN2.git
cd DACN2
powershell -ExecutionPolicy Bypass -File .\scripts\team-live.ps1
```

Script cài thư viện từ lockfile, tạo `.env.team` và certificate riêng nếu chưa
có, khởi động **chỉ PostgreSQL Docker**, rồi chạy cùng bản Live native như máy
tác giả: Chrome → HTTPS Gateway18444 → NestJS13001 → PostgreSQL15433.
Không cần PostgreSQL Windows hoặc `backend/.env`; không sao chép secret của tác giả.
Dùng cửa sổ Chrome lab tự mở để đăng ký tại `/demo` và xem nhật ký/fingerprint
thật tại `/dashboard`. Không có AI, dataset collector hay autoscaling trong bản này.

Nếu đã bật Docker preview bằng `team.ps1 start`, chạy `team.ps1 stop` trước để
giải phóng cổng5173. Ctrl+C dừng Live; PostgreSQL Docker vẫn chạy và giữ đăng ký.
Muốn dừng DB, chạy `powershell -ExecutionPolicy Bypass -File .\scripts\team.ps1 stop`.
Không xoá volume. Dữ liệu Docker của mỗi máy là riêng; không có đăng ký của tác giả.

Những lần sau có thể dùng `node scripts/dashboard-live.cjs --team-db` khi database
Docker còn chạy và dependencies đã cài. Sau `git pull`, dùng lại `team-live.ps1` để
đồng bộ thư viện. Máy tác giả vẫn dùng `node scripts/dashboard-live.cjs` với DB5432.
Lỗi mật khẩu với volume cũ cần đối chiếu `.env.team` gốc, không tạo mật khẩu mới hay
xoá DB để thử lại. Quy trình máy mới này chưa được diễn tập end-to-end; xem PROGRESS.

## Nhận dự án và chạy bằng Docker (Windows)

Yêu cầu: Git, Docker Desktop đang chạy Linux containers, PowerShell và mạng
để tải image/dependencies lần đầu. Không cần cài Node/Go/PostgreSQL trên host.
Sau khi clone Git hoặc giải nén gói source, mở PowerShell tại thư mục dự án:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\team.ps1 start
```

Lần đầu script tạo `.env.team` với mật khẩu riêng và certificate lab riêng
trong `gateway/.team-tls/`, rồi build/start4service. DB mới tự tạo role,
2database và5môn qua `backend/database/team-init.sql`. DB của mỗi thành viên
nằm trong volume riêng trên máy họ; không có dữ liệu đăng ký/secret của máy gốc.
Không dùng volume có sẵn từ dự án khác. Nếu đổi mật khẩu sau khi DB đã tạo,
phải đồng bộ role DB riêng; sửa env không tự đổi mật khẩu trong volume.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\team.ps1 status
powershell -ExecutionPolicy Bypass -File .\scripts\team.ps1 logs
powershell -ExecutionPolicy Bypass -File .\scripts\team.ps1 stop
```

Stop giữ dữ liệu. Không dùng `down -v` trừ khi chủ động muốn xoá DB local.
Mở http://127.0.0.1:5173/dashboard. Docker backend:13002; HTTPS Gateway:18445;
PostgreSQL:15433. Nếu5173đang bận, dừng demo native trong terminal của nó.

**Trạng thái bàn giao:** API Gateway→backend→DB đã được người dùng xác minh
đọc/ghi/giữ đăng ký qua restart. Dashboard Docker hiện là preview có nhãn mẫu;
Live/đăng ký/fingerprint trong dashboard Docker chưa nối. Bản native đầy đủ hơn
vẫn chạy qua scripts/dashboard-live.cjs trên môi trường Windows đã cấu hình.
AI/dataset/autoscaling chưa triển khai. Đây là source và môi trường để nhóm
làm tiếp, chưa phải bản demo tích hợp toàn bộ. Bộ setup máy mới chưa được chạy
rehearsal trong phiên đóng gói; không coi các bước chưa chạy là PASS.

Mỗi người sửa source trong bản clone, chạy lại lệnh start để rebuild, commit và
push branch riêng. Không gửi node_modules, env thật, cert/key hoặc volume DB.
Certificate tự ký chỉ dùng lab; Chrome có thể báo chưa tin cậy. Hướng dẫn mở
Chrome lab native không tự áp dụng cho container. Không tắt kiểm tra TLS toàn cục.


Status (2026-11-01): **M1 complete in the controlled local lab scope.** HTTPS/H2 Gateway → one K3s backend Pod → Windows PostgreSQL, test-DB writes/races/recovery and one-Pod read benchmark verified. C_work319req/s for the recorded500m/192Mi read profile, with20%headroom; saturation not reached at400RPS. M2 feature/window collector/dataset remains next. HostedCI and academic acceptance questions remain; see [current work](tasks/current.md).

The planned system uses a Go HTTPS Gateway, Python/FastAPI ML control plane, and NestJS/PostgreSQL backend on K3s. It distinguishes Normal, Flash Crowd, Pure L7 DDoS, and Mixed Traffic; applies per-client mitigation; and scales backend Pods from measured admitted RPS. Prometheus/Grafana expose actual behavior.

## Chạy demo đang dùng

Từ `D:\DACN2` chạy `node scripts/dashboard-live.cjs`. Script tự mở Chrome lab,
chạy Vite + Gateway + NestJS native; PostgreSQL Windows cần có sẵn. Đăng ký vào
`dacn2` được giữ sau khi dừng. Đây chưa phải đường K3s/AI/autoscaling.
Dừng bằng Ctrl+C hoặc `node scripts/dashboard-live.cjs stop`.
Xem [hướng dẫn dashboard](dashboard/README.md) và [triển khai/phục hồi](docs/DEPLOYMENT.md).

## Bản đồ code: đọc file nào trước?

```text
DACN2/
├─ dashboard/               Giao diện React và bộ nối log trực tiếp
│  ├─ src/app/              Khung trang, điều hướng, theme, nguồn Live/Mock
│  ├─ src/pages/            Các màn hình đăng ký, tổng quan, mô phỏng
│  ├─ src/components/       Thành phần giao diện dùng lại
│  ├─ src/features/         Kết nối Live và danh mục feature model
│  ├─ src/mocks/            Dữ liệu mẫu có nhãn, không phải dữ liệu train
│  ├─ src/styles/           Kiểu giao diện chung và bố cục gọn
│  ├─ src/tests/            Kiểm thử component React
│  ├─ server/               Đọc log Gateway, kiểm tra dữ liệu, phát SSE cho UI
│  ├─ e2e/                  Kiểm thử giao diện mẫu bằng Chrome
│  └─ e2e-live/             Kiểm thử luồng thật, chỉ ghi dacn2_test
├─ gateway/                 Go: HTTPS, reverse proxy, TLS/H2 fingerprint, telemetry
├─ backend/                 NestJS: API môn học, đăng ký và giao dịch PostgreSQL
│  ├─ src/                  5 file ứng dụng
│  ├─ database/migrations/  SQL tạo bảng, seed và sửa dữ liệu đã có
│  └─ test/                 Unit/E2E và fixture riêng
├─ scripts/                 Các lệnh vận hành được gọi từ thư mục gốc
│  ├─ lib/                  Hàm dùng chung, không chạy trực tiếp
│  └─ tests/                Kiểm thử hàm dùng chung, không bật cluster
├─ kubernetes/              Manifest triển khai backend lên K3s
├─ docs/                    Đặc tả, kiến trúc, cách chạy và bằng chứng tiến độ
├─ tasks/current.md         Tracker công việc duy nhất
└─ .local-backups/          Backup/evidence/công cụ local, không đưa lên Git
```

Luồng đọc code từ thao tác người dùng tới database:

1. **`scripts/dashboard-live.cjs`** bật/tắt các dịch vụ riêng của demo, chọn DB,
   tạo phiên và mở Chrome. **`scripts/lib/dashboard-data.cjs`** chọn môn ổn định
   trong DB chính hoặc tạo/dọn fixture ở DB test.
2. **`dashboard/src/pages/Demo.tsx`** nhận thao tác chọn môn/đăng ký;
   **`src/features/live.ts`** gửi HTTPS tới Gateway và nhận snapshot qua SSE.
3. **`gateway/main.go`** nối các thành phần, mở HTTPS;
   **`config.go`** kiểm tra địa chỉ/cấu hình;
   **`browser_lab.go`** giới hạn origin, token phiên, môn được phép và tần suất.
4. **`gateway/telemetry.go`** reverse proxy tới backend, tạo request ID, ghi
   status/latency/lỗi. **`ja4.go`** tính4biến thể JA4;
   **`h2_initial.go`** đọc SETTINGS; **`h2_frames.go`** đọc frame/HPACK có giới hạn;
   **`h2_live.go`** quản lý observer và connection ID;
   **`akamai.go`** tạo chuỗi/hash fingerprint H2.
5. **`backend/src/main.ts`** khởi động NestJS;
   **`app.module.ts`** nối controller/service;
   **`courses.controller.ts`** định tuyến và kiểm tra input;
   **`courses.service.ts`** đọc môn, đăng ký có transaction/chống trùng/hết chỗ;
   **`database.service.ts`** quản lý pool PostgreSQL.
6. **`dashboard/server/live-adapter.cjs`** lọc log và nối request với fingerprint,
   phát snapshot SSE. **`src/pages/Overview.tsx`** hiển thị số liệu/nhật ký;
   **`src/components/FingerprintPanel.tsx`** giải thích fingerprint;
   **`src/features/model-features.ts`** mô tả12feature dự kiến, chưa tính/train.

Các script lab có mục đích riêng:

- **`scripts/backend-lab.cjs`** vận hành backend trong K3s.
- **`scripts/m1-integration.cjs`** kiểm chứng Gateway→Pod→DB, lỗi và phục hồi.
- **`scripts/benchmark-m1.cjs`** đo tải lab có giới hạn; không phải lệnh demo UI.
- **`scripts/lib/lab-command.cjs`** chạy tiến trình con có timeout và che secrets.
- **`kubernetes/backend.yaml`** khai báo namespace, Deployment và Service.

File `*_test.go`, `*.test.cjs`, `*.spec.ts(x)` là kiểm thử, không phải code dư.
Go giữ source và tests cạnh nhau theo thông lệ package; không tách mỗi file thành
một folder. `node_modules` là thư viện đã cài; `dist` là bản build tạo lại được.
Env thật/cert/key, backup DB, captures và evidence phải được giữ riêng, không commit.
**Chưa có service AI hay collector dataset**; chưa tạo folder rỗng cho phần chưa làm.

## Start here

1. Read the [master plan](DACN2_PROJECT_MASTER_PLAN.md) for scope and M0–M6 milestones.
2. Read [current work](tasks/current.md) for actual status and open questions.
3. Follow [agent instructions](AGENTS.md), [quality constraints](CONSTRAINTS.md), and [skill routing](docs/SKILL_ROUTING.md).
4. Continue using [architecture decisions](docs/ARCHITECTURE.md) and the [session checkpoint](docs/PROGRESS.md).

Primary lab journey: start the controlled backend/Gateway, run legitimate traffic, introduce authorized mixed traffic, observe classification/mitigation/scaling, stop generators, and verify cooldown/cleanup. Intended operators are the project team/evaluators; external user needs and feedback are not validated.

## Actual evidence

M1 Pod demo commands from `D:\DACN2` (project tools/private kubeconfig and existing
WindowsPG required): `node scripts/backend-lab.cjs verify` deploys/checks then stops;
`node scripts/backend-lab.cjs start` leaves lab running explicitly; `stop` stops it.
The retained lab has one backendPod and loopbackNodePort13000. Gateway can target
it with `DACN2_UPSTREAM_URL=http://127.0.0.1:13000`; optional
`DACN2_LISTEN_ADDR=127.0.0.1:18443` keeps a separate smoke instance. Defaults remain
native3000/8443; only explicit HTTP loopback origins/listeners accepted. Full
procedures/results are in [DEPLOYMENT](docs/DEPLOYMENT.md). Startup initContainer
waits for DB DNS to avoid cold-cluster EAI_AGAIN; apphealth does not continuously
check DB. This is a lab workload, not public/authenticated production service.

- The [backend](backend/README.md) implements health, course list/detail, and concurrency-safe course registration using PostgreSQL transactions. API behavior is documented in the [API contract](docs/API_CONTRACT.md).
- Latest recorded backend checks: ESLint/build PASS, 8 unit tests and 9 E2E tests PASS. These are local results, not CI or deployment evidence.
- [Backend CI](.github/workflows/backend-ci.yml) runs install, isolated PostgreSQL setup, lint/build/unit/E2E and compiled health smoke. Open GitHub → Actions → Backend CI after pushing the workflow; no hosted CI result is claimed yet.
- Clean setup verified on 2026-10-29 using an isolated PostgreSQL volume and a clean backend source copy with `npm ci`: role/password, migrations, tests and compiled-backend health/list/detail all passed. This verifies setup on the existing Windows/Docker host, not prerequisite installation on another machine.
- Local PostgreSQL 17 now runs directly on Windows at 127.0.0.1:5432; the backend binds to 127.0.0.1:3000. Docker's former database on 15432 is stopped and retained for recovery. Migration evidence is in [checkpoint](docs/PROGRESS.md).
- Report.pdf is present; its contents were not independently reconciled during this Markdown review.
- HTTPS Go Gateway, four JA4 variants, bounded H2/HPACK/Akamai extraction and request telemetry verified with fixtures/independent captures. k3d/K3s and backendDeployment/Service are installed and retained stopped. Actual Pod DB and Gateway paths, scoped testDBwrites/concurrency/recovery and bounded benchmark have evidence. Dataset/model/inference/autoscaling/monitoring remain; training planned on Colab, full-lab resource feasibility unverified.

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

## Run the local Gateway

With the backend running on Windows PostgreSQL, stop an older Gateway in its terminal
with Ctrl+C before restarting. From a separate PowerShell terminal:

```powershell
Set-Location D:\DACN2\gateway
Remove-Item Env:DACN2_TLS_KEYLOG -ErrorAction SilentlyContinue
go run .
```

Existing ignored `cert.pem`/`key.pem` are required. GET `https://127.0.0.1:8443/health`
from the established lab client. A new HTTP/2 TLS connection produces one
`H2 observation` JSON event with metadata/pseudo-header names; normal HTTP/1.1
requests produce no H2 event. Complete supported metadata includes `akamai` with
`format`, `text` and `md5`. Missing/unsupported observations have `akamai: null`
with `akamai_reason`; `headers_observed` alone does not guarantee a fingerprint.
One isolated Chrome headless session passed independent TShark metadata/Node hash
comparison (35 packets/0 drop, health200); see checkpoint for evidence and limits.
ClientHello logs include JA4, JA4_r, JA4_o and JA4_ro; original variants preserve
wire order and may change across browser sessions. Stop with Ctrl+C.

Gateway-owned `GET /gateway/health` returns `service=dacn2-gateway` without contacting
the backend; `/health` still returns backend health through the proxy. HEAD on local
health returns200 without a body; other methods return405 with Allow GET, HEAD.
After restarting with M1-04 code, each handled HTTP request emits one JSON
`gateway_request` line (stdout) with generated X-Request-ID, connection ID, peer IP,
bounded route, latency_ms, committed status/body bytes and classified errors.
Incoming forwarding/request-ID headers are not trusted; no raw query/body/header
values are recorded in these events. See [API contract](docs/API_CONTRACT.md) for
status/null/error semantics and the difference between liveness and backend health.
No TLS session keys are logged unless DACN2_TLS_KEYLOG is explicitly set.

To verify observer code without the real backend, from gateway:

```powershell
go test -run 'TestLiveH2|TestH2|TestTLSReadWrapperProxy|TestGatewayHealth|TestTelemetry' -v -count=1 -timeout 30s .
```

Tests use temporary loopback servers and clean them up; the silent-peer test takes
about two seconds. See [feature contract](docs/FEATURE_SPEC.md) for limits/evidence.

## Delivery boundaries

Traffic generation is restricted to explicitly authorized isolated lab targets, with bounded load/duration/resources, emergency stop, and cleanup.

The master plan targets a reproducible capstone lab demo. Production deployment and real-user validation remain separate unfulfilled quality goals under CONSTRAINTS.md. Academic acceptance and the mandatory 12-feature scope remain open in tasks/current.md; lab evidence must not be reported as production or real-user validation.
