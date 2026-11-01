// Keep persistent demo data outside the disposable test-fixture lifecycle.
const demoCodes = ['CS101', 'NET301', 'SEC401', 'AI402', 'WEB201'];
async function prepareCourses(db, testMode, stamp) {
  if (!testMode) {
    const { rows } = await db.query(
      'SELECT id::text FROM courses WHERE code = ANY($1::text[]) ORDER BY id',
      [demoCodes],
    );
    if (!rows.length)
      throw Error(
        'dacn2 chưa có môn demo chuẩn; xem hướng dẫn seed, không tự tạo hoặc reset dữ liệu.',
      );
    return rows.map((row) => row.id);
  }
  const ids = [];
  // Caller owns the transaction, so partial setup is rolled back on failure.
  const names = ['Nhập môn lập trình', 'Mạng máy tính', 'Hệ cơ sở dữ liệu'];
  for (let i = 0; i < names.length; i++) {
    const { rows } = await db.query(
      'INSERT INTO courses(code,name,capacity) VALUES ($1,$2,$3) RETURNING id::text',
      [`UI${stamp}${i}`, names[i], i === 2 ? 1 : 20],
    );
    ids.push(rows[0].id);
  }
  return ids;
}
async function cleanupCourses(db, testMode, ids, stamp) {
  if (!testMode || !ids.length) return;
  await db.query('BEGIN');
  try {
    // Check ownership in the same transaction before deleting registrations.
    const { rows } = await db.query(
      'SELECT id::text FROM courses WHERE id = ANY($1::bigint[]) AND code LIKE $2 FOR UPDATE',
      [ids, `UI${stamp}%`],
    );
    const owned = rows.map((row) => row.id);
    if (owned.length !== ids.length) throw Error('Fixture ownership mismatch');
    await db.query(
      'DELETE FROM registrations WHERE course_id = ANY($1::bigint[])',
      [owned],
    );
    await db.query('DELETE FROM courses WHERE id = ANY($1::bigint[])', [owned]);
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}
module.exports = { prepareCourses, cleanupCourses };
