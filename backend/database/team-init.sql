\set ON_ERROR_STOP on
\getenv app_password TEAM_APP_PASSWORD

-- Tạo tài khoản ứng dụng nếu chưa có.
SELECT format(
    'CREATE ROLE dacn2_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L',
    :'app_password'
)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'dacn2_app'
)
\gexec

-- DB chính được image PostgreSQL tạo từ POSTGRES_DB.
-- Tạo thêm DB kiểm thử riêng.
SELECT 'CREATE DATABASE dacn2_test OWNER dacn2_admin'
WHERE NOT EXISTS (
    SELECT 1 FROM pg_database WHERE datname = 'dacn2_test'
)
\gexec

\connect dacn2

SELECT to_regclass('public.courses') IS NULL AS needs_schema
\gset
\if :needs_schema
    \i /opt/dacn2/migrations/001_initial_schema.sql
\endif

\i /opt/dacn2/migrations/002_seed_courses.sql
\i /opt/dacn2/migrations/003_repair_course_names.sql

\connect dacn2_test

SELECT to_regclass('public.courses') IS NULL AS needs_schema
\gset
\if :needs_schema
    \i /opt/dacn2/migrations/001_initial_schema.sql
\endif

\i /opt/dacn2/migrations/002_seed_courses.sql
\i /opt/dacn2/migrations/003_repair_course_names.sql
\i /opt/dacn2/test-grants.sql