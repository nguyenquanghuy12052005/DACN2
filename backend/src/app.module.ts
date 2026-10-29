import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { DatabaseService } from './database.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
  ],
  controllers: [CoursesController],
  providers: [CoursesService, DatabaseService],
})
export class AppModule {}
