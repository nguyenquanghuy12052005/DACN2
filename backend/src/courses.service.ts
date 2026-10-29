import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DatabaseService } from './database.service';

export interface CourseSummary {
  id: string;
  code: string;
  name: string;
  capacity: number;
  registeredCount: number;
  availableSeats: number;
}

export interface Registration {
  id: string;
  courseId: string;
  studentCode: string;
}

interface CourseRow extends QueryResultRow {
  id: string;
  code: string;
  name: string;
  capacity: number;
  registeredCount: number;
  availableSeats: number;
}

@Injectable()
export class CoursesService {
  constructor(private readonly database: DatabaseService) {}

  private toSummary(row: CourseRow): CourseSummary {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      capacity: row.capacity,
      registeredCount: row.registeredCount,
      availableSeats: row.availableSeats,
    };
  }

  async findAll(): Promise<CourseSummary[]> {
    const result = await this.database.query<CourseRow>(`
      SELECT
        id::text AS id,
        code,
        name,
        capacity,
        registered_count AS "registeredCount",
        capacity - registered_count AS "availableSeats"
      FROM courses
      ORDER BY code
    `);

    return result.rows.map((row) => this.toSummary(row));
  }

  async findOne(id: number): Promise<CourseSummary> {
    const result = await this.database.query<CourseRow>(
      `
        SELECT
          id::text AS id,
          code,
          name,
          capacity,
          registered_count AS "registeredCount",
          capacity - registered_count AS "availableSeats"
        FROM courses
        WHERE id = $1
      `,
      [id],
    );

    const course = result.rows[0];
    if (!course) {
      throw new NotFoundException(`Course ${id} was not found`);
    }

    return this.toSummary(course);
  }

  async register(courseId: number, studentCode: string): Promise<Registration> {
    return this.database.transaction(async (client) => {
      const course = await client.query<{
        capacity: number;
        registered_count: number;
      }>(
        'SELECT capacity, registered_count FROM courses WHERE id = $1 FOR UPDATE',
        [courseId],
      );
      if (!course.rows[0]) {
        throw new NotFoundException({
          statusCode: 404,
          code: 'COURSE_NOT_FOUND',
          message: 'Course was not found',
        });
      }
      const duplicate = await client.query(
        'SELECT id FROM registrations WHERE course_id = $1 AND student_code = $2',
        [courseId, studentCode],
      );
      if (duplicate.rows.length > 0) {
        throw new ConflictException({
          statusCode: 409,
          code: 'ALREADY_REGISTERED',
          message: 'Participant is already registered',
        });
      }
      if (course.rows[0].registered_count >= course.rows[0].capacity) {
        throw new ConflictException({
          statusCode: 409,
          code: 'COURSE_FULL',
          message: 'Course has no available seats',
        });
      }
      const registration = await client.query<Registration & QueryResultRow>(
        `INSERT INTO registrations (course_id, student_code) VALUES ($1, $2)
         RETURNING id::text, course_id::text AS "courseId", student_code AS "studentCode"`,
        [courseId, studentCode],
      );
      await client.query(
        'UPDATE courses SET registered_count = registered_count + 1 WHERE id = $1',
        [courseId],
      );
      return registration.rows[0];
    });
  }
}
