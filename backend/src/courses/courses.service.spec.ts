import { DatabaseService } from '../database/database.service';
import { CoursesService } from './courses.service';

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
});
