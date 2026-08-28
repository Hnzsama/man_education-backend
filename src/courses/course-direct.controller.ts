import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { CourseService } from './course.service';

@UseGuards(JwtAuthGuard)
@Controller('courses')
export class CourseDirectController {
  constructor(private courseService: CourseService) {}

  @Get(':courseId')
  async findById(@Param('courseId') courseId: string) {
    return this.courseService.findById(courseId);
  }
}
