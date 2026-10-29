import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient } from 'pg';
import { DatabaseService } from '../src/database.service';
import { CoursesService } from '../src/courses.service';
import { CoursesController } from '../src/courses.controller';

jest.mock('pg', () => ({ Pool: jest.fn() }));

describe('DatabaseService transactions', () => {
  const query = jest.fn();
  const release = jest.fn();
  const client = { query, release };
  let database: DatabaseService;

  beforeEach(() => {
    jest.resetAllMocks();
    (Pool as unknown as jest.Mock).mockImplementation(() => ({
      on: jest.fn(),
      connect: jest.fn().mockResolvedValue(client),
    }));
    query.mockResolvedValue({ rows: [] });
    database = new DatabaseService(
      new ConfigService({
        DB_PORT: '5432',
        DB_HOST: 'localhost',
        DB_NAME: 'test',
        DB_USER: 'test',
        DB_PASSWORD: 'placeholder',
      }),
    );
  });

  it('commits on the same client and releases it', async () => {
    await expect(
      database.transaction((connection) => {
        expect(connection).toBe(client);
        return Promise.resolve('saved');
      }),
    ).resolves.toBe('saved');
    expect(query.mock.calls.map(([sql]: [string]) => sql)).toEqual([
      'BEGIN',
      "SET LOCAL lock_timeout = '3s'",
      "SET LOCAL statement_timeout = '5s'",
      'COMMIT',
    ]);
    expect(release).toHaveBeenCalledWith(false);
  });

  it('rolls back and releases when work fails', async () => {
    const failure = new Error('update failed');
    await expect(
      database.transaction(() => Promise.reject(failure)),
    ).rejects.toBe(failure);
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(query).not.toHaveBeenCalledWith('COMMIT');
    expect(release).toHaveBeenCalledWith(false);
  });

  it('discards a connection if rollback also fails', async () => {
    const failure = new Error('work failed');
    query.mockImplementation((sql: string) =>
      sql === 'ROLLBACK'
        ? Promise.reject(new Error('connection lost'))
        : Promise.resolve({ rows: [] }),
    );
    await expect(
      database.transaction(() => Promise.reject(failure)),
    ).rejects.toBe(failure);
    expect(release).toHaveBeenCalledWith(true);
  });
});

describe('CoursesService', () => {
  const course = {
    id: '1',
    code: 'CS101',
    name: 'Nhập môn lập trình',
    capacity: 60,
    registeredCount: 2,
    availableSeats: 58,
  };

  it('returns course summaries from PostgreSQL', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [course],
    });
    const database = { query } as unknown as DatabaseService;
    const service = new CoursesService(database);

    await expect(service.findAll()).resolves.toEqual([course]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM courses'));
  });

  it('returns one course using a parameterized query', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [course] });
    const database = { query } as unknown as DatabaseService;
    const service = new CoursesService(database);

    await expect(service.findOne(1)).resolves.toEqual(course);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1'),
      [1],
    );
  });

  it('throws a not-found error when the course does not exist', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const database = { query } as unknown as DatabaseService;
    const service = new CoursesService(database);

    await expect(service.findOne(999)).rejects.toMatchObject({ status: 404 });
  });

  it('does not return success if updating the registration counter fails', async () => {
    const failure = new Error('counter update failed');
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ capacity: 1, registered_count: 0 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: '7', courseId: '1', studentCode: 'DEMO' }],
      })
      .mockRejectedValueOnce(failure);
    const transaction = jest.fn(
      (work: (client: PoolClient) => Promise<unknown>) =>
        work({ query } as unknown as PoolClient),
    );
    const service = new CoursesService({
      transaction,
    } as unknown as DatabaseService);

    await expect(service.register(1, 'DEMO')).rejects.toBe(failure);
    expect(query).toHaveBeenLastCalledWith(
      'UPDATE courses SET registered_count = registered_count + 1 WHERE id = $1',
      [1],
    );
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});

describe('Lab health', () => {
  it('returns the backend service status', () => {
    const controller = new CoursesController({} as CoursesService);
    expect(controller.health()).toEqual({
      status: 'ok',
      service: 'dacn2-backend',
    });
  });
});
