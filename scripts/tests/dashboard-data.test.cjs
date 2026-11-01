const test = require('node:test');
const assert = require('node:assert/strict');
const { prepareCourses, cleanupCourses } = require('../lib/dashboard-data.cjs');
test('persistent demo reuses stable courses across sessions, performs no setup or shutdown writes', async () => {
  const calls = [];
  const db = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [{ id: '1' }, { id: '2' }] };
    },
  };
  assert.deepEqual(await prepareCourses(db, false, '1'), ['1', '2']);
  await cleanupCourses(db, false, ['1', '2'], '1');
  assert.deepEqual(await prepareCourses(db, false, '2'), ['1', '2']);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(({ sql }) => sql.startsWith('SELECT')));
  assert.deepEqual(calls[0].params, calls[1].params);
});
test('missing demo courses refuses setup without inventing or resetting data', async () => {
  await assert.rejects(
    prepareCourses({ query: async () => ({ rows: [] }) }, false, '1'),
    /chưa có môn demo/,
  );
});
test('QA cleanup rolls back before any delete when fixture ownership differs', async () => {
  const calls = [];
  const db = {
    query: async (sql) => {
      calls.push(sql);
      return { rows: [] };
    },
  };
  await assert.rejects(cleanupCourses(db, true, ['61'], '1'), /ownership/);
  assert.equal(calls.at(-1), 'ROLLBACK');
  assert.ok(!calls.some((sql) => sql.startsWith('DELETE')));
});
