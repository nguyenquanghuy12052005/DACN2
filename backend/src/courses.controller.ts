import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { CoursesService, CourseSummary, Registration } from './courses.service';

// Only the endpoints needed to generate read/write traffic in the lab.
@Controller()
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Get('health')
  health(): { status: string; service: string } {
    return { status: 'ok', service: 'dacn2-backend' };
  }

  @Get('courses')
  findAll(): Promise<CourseSummary[]> {
    return this.courses.findAll();
  }

  @Get('courses/:id')
  findOne(@Param('id') id: string): Promise<CourseSummary> {
    return this.courses.findOne(parseCourseId(id));
  }

  @Post('courses/:id/registrations')
  register(
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<Registration> {
    return this.courses.register(parseCourseId(id), parseStudentCode(body));
  }
}

function parseCourseId(value: string): number {
  const id = Number(value);
  if (!/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(id)) {
    throw new BadRequestException('Course id must be a positive safe integer');
  }
  return id;
}

function parseStudentCode(body: unknown): string {
  if (
    body === null ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    !('studentCode' in body) ||
    typeof body.studentCode !== 'string' ||
    !/^[A-Za-z0-9_-]{1,30}$/.test(body.studentCode)
  ) {
    throw new BadRequestException(
      'Body must contain only studentCode (1-30 ASCII letters, digits, underscores or hyphens)',
    );
  }
  return body.studentCode.toUpperCase();
}
