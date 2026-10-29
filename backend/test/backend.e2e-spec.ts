import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database.service';
import { CourseSummary } from '../src/courses.service';

describe('Lab read API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', service: 'dacn2-backend' });
  });

  it('/courses (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/courses')
      .expect(200);
    const courses = response.body as CourseSummary[];

    expect(courses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CS101',
          name: 'Nhập môn lập trình',
          capacity: 60,
          registeredCount: 0,
          availableSeats: 60,
        }),
      ]),
    );
  });

  it('/courses/:id (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/courses/1')
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: '1',
        code: 'CS101',
        name: 'Nhập môn lập trình',
        capacity: 60,
        registeredCount: 0,
        availableSeats: 60,
      }),
    );
  });

  it('/courses/:id rejects invalid and missing ids', async () => {
    await request(app.getHttpServer()).get('/courses/not-a-number').expect(400);
    await request(app.getHttpServer()).get('/courses/0').expect(400);
    await request(app.getHttpServer()).get('/courses/999999').expect(404);
  });

  afterEach(async () => {
    await app.close();
  });
});

describe('Course registrations (isolated PostgreSQL e2e)', () => {
  let app: INestApplication<App>;
  let database: DatabaseService;
  const fixtureIds: string[] = [];
  let courseId: string;

  beforeAll(async () => {
    if (process.env.DB_NAME !== 'dacn2_test') {
      throw new Error('Registration tests require dacn2_test');
    }
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    database = app.get(DatabaseService);
  });

  beforeEach(async () => {
    const result = await database.query<{ id: string }>(
      `INSERT INTO courses (code, name, capacity) VALUES ($1, 'E2E fixture', 1)
       RETURNING id::text`,
      [`T${randomUUID().replaceAll('-', '').slice(0, 16)}`],
    );
    courseId = result.rows[0].id;
    fixtureIds.push(courseId);
  });

  afterAll(async () => {
    try {
      if (database && fixtureIds.length > 0) {
        await database.transaction(async (client) => {
          await client.query(
            'DELETE FROM registrations WHERE course_id = ANY($1::bigint[])',
            [fixtureIds],
          );
          await client.query(
            'DELETE FROM courses WHERE id = ANY($1::bigint[])',
            [fixtureIds],
          );
        });
      }
    } finally {
      if (app) await app.close();
    }
  });

  function register(studentCode: string) {
    return request(app.getHttpServer())
      .post(`/courses/${courseId}/registrations`)
      .send({ studentCode });
  }

  async function expectCounts(count: number) {
    const result = await database.query<{
      registered_count: number;
      actual: number;
    }>(
      `SELECT c.registered_count, (SELECT count(*)::int FROM registrations r
        WHERE r.course_id = c.id) AS actual FROM courses c WHERE c.id = $1`,
      [courseId],
    );
    expect(result.rows[0]).toEqual({ registered_count: count, actual: count });
  }

  it('persists a registration; duplicate has priority over full', async () => {
    const response = await register('demo_01').expect(201);
    expect(response.body).toEqual({
      id: (response.body as { id: string }).id,
      courseId,
      studentCode: 'DEMO_01',
    });
    expect(typeof (response.body as { id: string }).id).toBe('string');
    const duplicate = await register('DEMO_01').expect(409);
    expect((duplicate.body as { code: string }).code).toBe(
      'ALREADY_REGISTERED',
    );
    const full = await register('DEMO_02').expect(409);
    expect((full.body as { code: string }).code).toBe('COURSE_FULL');
    await expectCounts(1);
  });

  it('rejects malformed bodies and IDs without mutation', async () => {
    for (const body of [
      {},
      { studentCode: '' },
      { studentCode: ' a' },
      { studentCode: 42 },
      { studentCode: 'x'.repeat(31) },
      { studentCode: "x';--" },
      { studentCode: 'a', extra: true },
      [],
    ]) {
      await request(app.getHttpServer())
        .post(`/courses/${courseId}/registrations`)
        .send(body)
        .expect(400);
    }
    for (const id of [
      '0',
      '-1',
      'abc',
      '1.5',
      '9007199254740992',
      '9223372036854775808',
    ]) {
      await request(app.getHttpServer())
        .post(`/courses/${id}/registrations`)
        .send({ studentCode: 'VALID' })
        .expect(400);
    }
    const missing = await request(app.getHttpServer())
      .post('/courses/9007199254740991/registrations')
      .send({ studentCode: 'VALID' })
      .expect(404);
    expect((missing.body as { code: string }).code).toBe('COURSE_NOT_FOUND');
    await expectCounts(0);
  });

  it('admits only one of six requests competing for the last seat', async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => register(`RACE_${i}`)),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(5);
    for (const result of results.filter((r) => r.status === 409)) {
      expect((result.body as { code: string }).code).toBe('COURSE_FULL');
    }
    await expectCounts(1);
  });

  it('commits only one concurrent registration for the same participant', async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, () => register('SAME')),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(3);
    for (const result of results.filter((r) => r.status === 409)) {
      expect((result.body as { code: string }).code).toBe('ALREADY_REGISTERED');
    }
    await expectCounts(1);
  });

  it('rolls back an insert when a later capacity constraint fails', async () => {
    await expect(
      database.transaction(async (client) => {
        await client.query(
          'INSERT INTO registrations (course_id, student_code) VALUES ($1, $2)',
          [courseId, 'ROLLBACK'],
        );
        await client.query(
          'UPDATE courses SET registered_count = capacity + 1 WHERE id = $1',
          [courseId],
        );
      }),
    ).rejects.toMatchObject({ code: '23514' });
    await expectCounts(0);
  });
});
