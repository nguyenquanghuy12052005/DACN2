BEGIN;

CREATE TABLE courses (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    registered_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT courses_registered_count_valid
        CHECK (
            registered_count >= 0
            AND registered_count <= capacity
        )
);

CREATE TABLE registrations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    course_id BIGINT NOT NULL
        REFERENCES courses(id)
        ON DELETE RESTRICT,
    student_code VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT registrations_course_student_unique
        UNIQUE (course_id, student_code)
);

GRANT SELECT ON courses TO dacn2_app;
GRANT SELECT, INSERT ON registrations TO dacn2_app;
GRANT UPDATE (registered_count) ON courses TO dacn2_app;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
    TO dacn2_app;

COMMIT;