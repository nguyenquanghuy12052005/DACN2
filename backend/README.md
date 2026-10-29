# Backend demo — API làm tải cho lab DDoS

Backend chỉ cung cấp API đọc/ghi PostgreSQL để đo hệ thống bảo vệ. Phát hiện/chặn DDoS thuộc Go Gateway và AI, không nằm trong backend. Không mở rộng thành hệ thống quản lý sinh viên, tài khoản hay frontend.

## Chỉ cần hiểu 5 file nguồn

- `src/main.ts`: bật server tại `127.0.0.1:3000`.
- `src/app.module.ts`: nối cấu hình, API và database với nhau.
- `src/courses.controller.ts`: nhận 4 API và kiểm tra input.
- `src/courses.service.ts`: SQL đọc môn/ghi đăng ký; chứa luôn kiểu dữ liệu trả về.
- `src/database.service.ts`: kết nối PostgreSQL và commit/rollback transaction.

Luồng: request → controller → service → database. Muốn sửa đường dẫn/input, đọc controller; muốn sửa SQL, đọc service.

API giữ lại: `GET /health`, `GET /courses`, `GET /courses/:id`, `POST /courses/:id/registrations`. Endpoint scaffold `GET /`/Hello World đã bỏ. Chi tiết input/response: [API contract](../docs/API_CONTRACT.md).

Tests chỉ có `test/backend.spec.ts` (unit) và `test/backend.e2e-spec.ts` (API + PostgreSQL). `test/setup-env.ts` buộc E2E dùng DB test; `fixtures/grants.sql` cấp quyền dọn fixture. Ba SQL trong `database/migrations/` giữ lại vì đã áp dụng trên DB hiện có. `.env` là cấu hình riêng; `node_modules/`, `dist/`, `coverage/` là file tự sinh, không cần đọc/sửa.

## Run

The existing local setup uses root .env for Docker and backend/.env for application DB access (use the corresponding examples with your own secrets). Host DB port is 15432; container port is 5432. Do not print or commit secrets.

From D:\DACN2, open Docker Desktop and run:

```powershell
docker compose up -d postgres
docker compose ps
Set-Location .\backend
npm ci
npm run start:dev
```

Server binds 127.0.0.1:3000. GET /health, /courses, /courses/1 are read-only. POST /courses/:id/registrations writes data and accepts only a synthetic studentCode. The caller-supplied code is not authenticated identity.

Stop server with Ctrl+C; stop DB from repository root with docker compose stop postgres (preserves volume).
For production-build smoke tests: npm run build then npm run start:prod. Network/K3s deployment is not configured.

## First-time database setup

<details>
<summary>Chỉ mở khi dựng máy mới — máy hiện tại đã có đủ role/schema</summary>

Skip this section on the existing development database: its role and migrations are already provisioned. These commands are for a NEW installation with an empty PostgreSQL volume. Do not overwrite existing .env files or delete volumes to repeat setup.

From the repository root, copy the examples only when the destination files do not exist:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (-not (Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
```

Edit root `.env`: replace `POSTGRES_PASSWORD` with a strong local administrator password. Edit `backend/.env`: replace `DB_PASSWORD` with a different application password; keep `DB_USER=dacn2_app`. The examples are placeholders, not usable credentials. In dotenv values, use single quotes if the password contains `#`, spaces or `$` (and avoid a single quote in that value). Never paste passwords into SQL command arguments or shell history.

Root POSTGRES_PASSWORD initializes the administrator only when the volume is empty. Editing it later does not rotate an existing database password.

Start the new database and wait until `docker compose ps` shows healthy:

```powershell
docker compose up -d postgres
docker compose ps
docker compose exec postgres psql -v ON_ERROR_STOP=1 -U dacn2_admin -d dacn2
```

In the interactive psql session, create the least-privilege application login, then set its password using the hidden prompt. Enter the same application password as `backend/.env` twice. Local container administration uses the image's local-socket access; do not change host authentication to trust.

```sql
CREATE ROLE dacn2_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
\password dacn2_app
\q
```

Stop if role creation fails; do not silently recreate or reset an existing role. `POSTGRES_DB=dacn2` in Compose creates the demo database. Apply its migrations from the repository root (raw file copies preserve UTF-8):

```powershell
docker compose cp ./backend/database/migrations/001_initial_schema.sql postgres:/tmp/demo_001.sql
docker compose cp ./backend/database/migrations/002_seed_courses.sql postgres:/tmp/demo_002.sql
docker compose cp ./backend/database/migrations/003_repair_course_names.sql postgres:/tmp/demo_003.sql
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U dacn2_admin -d dacn2 -f /tmp/demo_001.sql -f /tmp/demo_002.sql -f /tmp/demo_003.sql
```

Check each command's exit status (`$LASTEXITCODE` must be 0); stop on any failure. Then complete the E2E database setup below and follow Run/Checks. The application role receives only the grants in migration 001; test fixture grants belong exclusively in `dacn2_test`.

To check the application password before starting NestJS, connect over TCP and enter it at the prompt:

```powershell
docker compose exec postgres psql -h 127.0.0.1 -U dacn2_app -d dacn2 -W -c "SELECT code, name FROM courses ORDER BY code"
```

Expect five rows with readable Vietnamese names. Authentication failure means the role password and `backend/.env` need to be checked; changing root `.env` does not change the application role password.

## Database migrations

Existing demo database already has migrations 001–003 applied. Do not re-run schema creation or delete its volume.

For new SQL, copy the raw UTF-8 file into the container and execute with psql -f. Windows PowerShell text pipelines previously corrupted Vietnamese seed names. Example, from repository root:

```powershell
docker compose cp ./backend/database/migrations/003_repair_course_names.sql postgres:/tmp/003_repair_course_names.sql
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U dacn2_admin -d dacn2 -f /tmp/003_repair_course_names.sql
```

A brand-new installation must complete the first-time role/password and demo migration steps above before tests or backend startup.

## E2E database (one-time setup)

The current machine already has dacn2_test bootstrapped. Jest setup always selects this test database, not dacn2. It uses the same application credentials from backend/.env. No elevated password is needed by the tests.

On another machine, after provisioning dacn2_app, run the following from repository root **only if dacn2_test does not already exist**:

```powershell
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U dacn2_admin -d postgres -c "CREATE DATABASE dacn2_test"
docker compose cp ./backend/database/migrations/001_initial_schema.sql postgres:/tmp/test_001.sql
docker compose cp ./backend/database/migrations/002_seed_courses.sql postgres:/tmp/test_002.sql
docker compose cp ./backend/database/migrations/003_repair_course_names.sql postgres:/tmp/test_003.sql
docker compose cp ./backend/test/fixtures/grants.sql postgres:/tmp/test_grants.sql
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U dacn2_admin -d dacn2_test -f /tmp/test_001.sql -f /tmp/test_002.sql -f /tmp/test_003.sql -f /tmp/test_grants.sql
```

Stop if any command fails. Test grants add INSERT/DELETE for fixtures only in dacn2_test; never apply them to the demo DB.
Tests create unique synthetic course rows and clean their registrations/courses in afterAll. If the test process is forcibly killed, inspect leftover test fixtures in dacn2_test rather than deleting demo data.

</details>

## Checks

From backend:

```powershell
npm run lint
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

Lint uses --fix. E2E requires healthy PostgreSQL and the bootstrapped test database. Expected at this checkpoint: 8 unit tests, 9 E2E tests. CI is not yet configured.

For a read-only lint check, use `npx --no-install eslint "{src,apps,libs,test}/**/*.ts"` instead of the fixing lint script.

With the backend running, use a second terminal for read-only smoke checks:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/courses
Invoke-RestMethod http://127.0.0.1:3000/courses/1
```

Expect HTTP 200, five seeded courses on a clean database, and course 1 with a readable Vietnamese name. E2E checks registration success, validation, duplicates, capacity races and rollback on `dacn2_test`; no POST smoke is needed on the demo database.

Setup sạch đã kiểm chứng với volume PostgreSQL mới và bản sao backend trên máy hiện tại. Sau rút gọn: ESLint/build, 8 unit và 9 E2E PASS. Bằng chứng/giới hạn và trạng thái lab ở [checkpoint](../docs/PROGRESS.md). CI/K3s chưa có.
