# Architecture and decisions

Updated: 2026-10-30. Status: local backend and HTTPS Gateway/JA4 implemented; broader lab architecture planned.
Source: [master plan](../DACN2_PROJECT_MASTER_PLAN.md). Report.pdf was not independently reconciled in this documentation update.

## Planned boundaries

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
