# Backend lab API contract

Updated: 2026-10-29. Scope: local M0 course-registration demo.

## Boundary and identity

The backend is an isolated lab workload. `studentCode` is a caller-supplied synthetic participant identifier, not a verified student identity. No real student data, account authentication, or production authorization is implemented. Bind the local server to loopback. Before networked deployment, explicitly design trusted identity/authorization and network access controls; gateway bot detection is not authentication.

## Read operations

- `GET /health`: 200 with service status.
- `GET /courses`: 200, array of `{ id, code, name, capacity, registeredCount, availableSeats }`.
- `GET /courses/:id`: 200 with the same course summary; 400 for invalid ID, 404 for missing course.
- IDs in paths must be positive decimal safe integers (maximum 9007199254740991). IDs in JSON responses are strings to preserve PostgreSQL BIGINT representation.

## Register

`POST /courses/:id/registrations`, `Content-Type: application/json`.

```json
{ "studentCode": "DEMO001" }
```

The body must be an object with exactly `studentCode`, a string matching `[A-Za-z0-9_-]{1,30}`. Normalize to uppercase; do not trim whitespace silently. Invalid bodies/IDs return 400 before any database mutation.

201 response:

```json
{ "id": "1", "courseId": "1", "studentCode": "DEMO001" }
```

- 404: `COURSE_NOT_FOUND`.
- 409: `ALREADY_REGISTERED` (including when the course is now full).
- 409: `COURSE_FULL`.
- Domain errors include `{ statusCode, code, message }`. Validation errors use Nest's standard 400 shape. Unexpected database failures remain 500 and must roll back.
- A retry after a committed registration returns 409; there is no idempotency-key protocol in this slice.

## Consistency and acceptance

All writers lock the course row with `SELECT ... FOR UPDATE` before checking duplicates/capacity. Insert and counter increment run on the same checked-out PostgreSQL client in one transaction. Unique `(course_id, student_code)` and capacity CHECK constraints remain enabled. Rollback must undo both mutations, and pooled clients must always be released. Local transaction lock/statement timeouts bound waits.

Acceptance: valid registration persists once; malformed input, absent course, duplicate, and full capacity leave no mutation. Concurrent distinct participants cannot oversubscribe; concurrent duplicate requests produce one registration/counter increment. An injected counter-update failure rolls back the insert. Unit tests verify transaction cleanup; E2E tests verify persisted outcomes in the dedicated test database.

## Test database

E2E uses `dacn2_test`, separate from `dacn2`; Jest setup selects it before loading the application. Create this database with the existing admin role and apply migrations 001–003 once, then `backend/test/fixtures/grants.sql` (test-only grants). Never apply test grants to the demo database. The test fixture grants allow insertion/deletion of synthetic course rows for cleanup, without elevating the production application role.

E2E creates unique synthetic courses and removes only those rows and dependent registrations in `afterAll`. Do not run E2E against a database containing valuable data. Existing read tests use the seeded CS101 course.
