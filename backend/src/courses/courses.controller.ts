import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { CourseSummary } from './course-summary';
import { CoursesService } from './courses.service';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  findAll(): Promise<CourseSummary[]> {
    return this.coursesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<CourseSummary> {
    if (id < 1) {
      throw new BadRequestException('Course id must be a positive integer');
    }

    return this.coursesService.findOne(id);
  }
}
