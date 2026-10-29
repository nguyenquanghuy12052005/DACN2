# DACN2 session checkpoint

Updated: 2026-10-29 (Asia/Bangkok).
Current milestone: M0 environment/bootstrap.
Session task: review/fix the backend foundation, implement course list/detail, and save a resumable handoff.
Session task status: DONE. Work stopped at the user's request. Dynamic course-registration slice: INCOMPLETE; resume only when requested.

## Checkpoint khi dừng — 29/10/2026

### Đang ở đâu

- Đang ở M0 (môi trường/bootstrap), đã hoàn thành phần nền backend và API đọc dữ liệu. Chưa hoàn thành M0; chưa chuyển sang Go Gateway/M1.
- Kịch bản đầu tiên đã chọn: đăng ký học phần. Đặt vé phim và mua hàng là hướng mở rộng về sau.
- Đã có `GET /health`, `GET /courses`, `GET /courses/:id`. Course detail trả 400 cho ID không hợp lệ hoặc không dương, 404 khi không tìm thấy.
- PostgreSQL có bảng `courses`, `registrations`, 5 môn mẫu và role ứng dụng `dacn2_app`. Chưa có API tạo đăng ký; chưa kiểm thử đăng ký đồng thời.
- Chưa có frontend demo, Go Gateway, collector/feature extraction, dataset, model, FastAPI inference, chính sách chặn, K3s deployment, autoscaling, Prometheus/Grafana hay CI.
- Train model trên Google Colab theo lựa chọn của người dùng; máy local phục vụ phát triển và lab/inference sau này.

### Môi trường đã ghi nhận

- Windows 11 Pro 64-bit; Intel i5-11400H (6 core/12 thread), RAM 15.8 GB.
- Dung lượng trống người dùng báo tại thời điểm kiểm tra: C 18.4 GB, D 70.3 GB; cần kiểm tra lại trước khi cài lab.
- Docker Desktop dùng Linux engine/WSL2, khoảng 8 GB RAM; không có Ubuntu WSL riêng trong lần inventory trước. VM Ubuntu VirtualBox cũ đã xóa ổ đĩa theo người dùng.
- Docker Desktop từng lỗi WSL/engine; đã khởi động lại và PostgreSQL chạy được. Nếu tái diễn, kiểm tra engine trước khi chẩn đoán backend; không reset factory hay xóa volume.

### Lệnh tiếp tục phiên sau (PowerShell)

Mở Docker Desktop, chờ Linux engine sẵn sàng rồi chạy:

```powershell
Set-Location D:\DACN2
docker version
docker compose up -d postgres
docker compose ps
Set-Location .\backend
npm run start:dev
```

Ở cửa sổ PowerShell khác:

```powershell
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod http://localhost:3000/courses
Invoke-RestMethod http://localhost:3000/courses/1
```

Chạy kiểm tra từ `D:\DACN2\backend`:

```powershell
npm run lint
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

- Kết quả đã xác minh cuối phiên triển khai: lint/build PASS; unit 4/4 PASS; E2E 4/4 PASS với PostgreSQL local. Production build chạy được; `/courses/1` trả 200 với tiếng Việt đúng, ID không tồn tại trả 404.
- Các kiểm tra này là bằng chứng phiên triển khai trước checkpoint, không phải lần chạy lại khi chỉ cập nhật Markdown.
- `start:prod` dùng `dist/main`; cổng mặc định 3000, smoke test dùng 3100. Tiến trình test 3100 đã dừng. PostgreSQL được để lại chạy ở cuối phiên trước; phải kiểm tra trạng thái thực khi tiếp tục.
- Dừng backend bằng Ctrl+C. Nếu cần dừng PostgreSQL: từ root chạy `docker compose stop postgres`; giữ volume để bảo toàn dữ liệu.

### Cấu hình và migration cần nhớ

- Backend chạy trên Windows kết nối `127.0.0.1:15432`; PostgreSQL bên trong container dùng 5432. Hai cổng này khác nhau có chủ đích do host 5432 từng không bind được.
- Secret nằm trong `.env` cục bộ đã ignore; dùng `.env.example` làm mẫu. Không in password, không tạo lại role hoặc ghi đè secret nếu đã tồn tại.
- Migrations 001 (schema/grants), 002 (5 môn mẫu), 003 (sửa tên tiếng Việt) đã áp dụng vào database local. Không chạy lại 001 trên database hiện tại vì bảng đã tồn tại.
- Pipeline `Get-Content | docker compose exec ... psql` từng làm hỏng Unicode. Với migration mới, copy nguyên file rồi dùng `psql -f`, ví dụ (thay tên file tương ứng):

```powershell
Set-Location D:\DACN2
docker compose cp .\backend\database\migrations\003_repair_course_names.sql postgres:/tmp/003_repair_course_names.sql
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U dacn2_admin -d dacn2 -f /tmp/003_repair_course_names.sql
```

### Điểm bắt đầu lần sau

1. Đọc `tasks/current.md`, phần liên quan trong master plan, checkpoint này và `CONSTRAINTS.md`; kiểm tra code/trạng thái Docker thực tế.
2. Chốt contract đăng ký (input, response, lỗi, phạm vi định danh/ủy quyền trong lab) vào `docs/API_CONTRACT.md` trước khi triển khai phụ thuộc. File này hiện chưa tồn tại.
3. Triển khai API đăng ký bằng transaction trên cùng một PostgreSQL connection, chống trùng và không vượt capacity khi nhiều request đến đồng thời. Không dùng các query độc lập qua pool cho một transaction.
4. Kiểm thử thành công, input sai, môn không tồn tại, trùng, hết chỗ, rollback và cạnh tranh ghế cuối; dùng fixture test có cleanup, tránh làm bẩn 5 môn mẫu mà E2E hiện giả định `registeredCount = 0`.
5. Sau đó hoàn thiện phần còn thiếu của M0 và mới chuyển sang Gateway/M1. Không tự mở rộng sang vé phim/mua hàng trong lát cắt này.

### Rủi ro và việc chưa xác minh

- Audit trước đó: production dependencies 0 lỗ hổng; full audit còn 8 mức low trong dev tooling. Đây là kết quả thời điểm kiểm tra, cần đánh giá lại khi dependency thay đổi.
- Chưa có commit/backup Git; lần kiểm tra trước các file vẫn untracked. Không được coi checkpoint Markdown là bản sao lưu ngoài máy.
- Các câu hỏi nghiệm thu, đủ 12 features, topology K3s và revision skill upstream còn mở tại tracker.

## Actual state

- NestJS 11 backend and PostgreSQL 17 Compose service run locally; `GET /health` and database startup are verified.
- Versioned schema/seed SQL creates `courses`, `registrations`, least-privilege application grants, and five seed courses.
- Go 1.27.3, Node 20.20.2, Python 3.13.3, Docker Desktop/Linux engine, and kubectl are available. K3s/k3d remains uninstalled and unverified.
- ML training will run on Google Colab; local model inference remains future work.

## This session

- Moved database module/service under `backend/src` so NestJS emits `dist/main.js`; removed the accidental root npm project and generated dependencies.
- Completed `.env.example`, ignored dependencies/build output, and added explicit bootstrap rejection handling.
- Pinned transitive Multer 2.5.0 through an npm override while keeping NestJS 11; production audit reports zero vulnerabilities.
- Verification: lint PASS; build PASS; unit tests 1/1 PASS; E2E tests 1/1 PASS against local PostgreSQL; `npm run start:prod` PASS; `/health` on port 3100 returned the expected JSON.
- Implemented `GET /courses` with typed PostgreSQL mapping and unit/E2E coverage.
- Repaired corrupted Vietnamese seed names with migration `003_repair_course_names.sql`; byte-level PostgreSQL verification confirms valid UTF-8. Future Unicode migrations must be copied into the container as raw files rather than piped through Windows PowerShell.
- Latest verification: lint PASS; build PASS; unit tests 2/2 PASS; E2E tests 2/2 PASS; production `/courses` smoke test PASS.
- Implemented `GET /courses/:id` with a parameterized query, positive-integer validation, and explicit not-found behavior.
- Latest verification after course detail: lint PASS; build PASS; unit tests 4/4 PASS; E2E tests 4/4 PASS.
- Full dependency audit still reports eight low-severity findings in development tooling. npm proposes incompatible major downgrades, so they were not auto-fixed. Production dependencies report zero vulnerabilities.

## Next action

1. Document the registration API contract and lab identity/authorization boundary.
2. Add concurrency-safe registration transactions, including duplicate/full-capacity failure tests and cleanup.
3. Complete M0 environment evidence and pin the selected upstream engineering-skill revision before broader implementation.

## Limitations and Git state

- Upstream skill revision is not pinned. Routing does not install or activate skills; pin before implementation adoption.
- Report.pdf was not independently reviewed in this Markdown task.
- Checkout ownership differs from the active user; read-only status inspection used `git -c safe.directory=D:/DACN2 status --short`. No global configuration changed.
- Existing files remain untracked; no commit was created. Local `.env` files are ignored and were not printed or committed.
