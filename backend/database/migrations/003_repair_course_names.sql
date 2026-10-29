BEGIN;

UPDATE courses
SET name = CASE code
    WHEN 'CS101' THEN 'Nhập môn lập trình'
    WHEN 'NET301' THEN 'Mạng máy tính'
    WHEN 'SEC401' THEN 'An toàn hệ thống'
    WHEN 'AI402' THEN 'Học máy ứng dụng'
    WHEN 'WEB201' THEN 'Phát triển ứng dụng web'
    ELSE name
END
WHERE code IN ('CS101', 'NET301', 'SEC401', 'AI402', 'WEB201');

COMMIT;
