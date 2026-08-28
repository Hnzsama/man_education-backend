import { Module } from '@nestjs/common';
import { CourseController } from './course.controller';
import { CourseDirectController } from './course-direct.controller';
import { CourseService } from './course.service';

@Module({
  controllers: [CourseController, CourseDirectController],
  providers: [CourseService],
})
export class CoursesModule {}

