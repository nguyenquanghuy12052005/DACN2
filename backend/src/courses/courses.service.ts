import { Injectable, NotFoundException } from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { CourseSummary } from './course-summary';

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
}
