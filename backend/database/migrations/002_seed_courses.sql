BEGIN;

INSERT INTO courses (code, name, capacity)
VALUES
    ('CS101', 'Nhập môn lập trình', 60),
    ('NET301', 'Mạng máy tính', 45),
    ('SEC401', 'An toàn hệ thống', 35),
    ('AI402', 'Học máy ứng dụng', 40),
    ('WEB201', 'Phát triển ứng dụng web', 50)
ON CONFLICT (code) DO NOTHING;

COMMIT;