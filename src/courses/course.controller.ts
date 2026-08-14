import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { CourseService } from './course.service';
import { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';

@UseGuards(JwtAuthGuard)
@Controller('semesters/:semesterId/courses')
export class CourseController {
  constructor(private courseService: CourseService) {}

  @Post()
  async create(
    @Request() req: any,
    @Param('semesterId') semesterId: string,
    @Body() dto: CreateCourseDto,
  ) {
    return this.courseService.create(semesterId, req.user.userId, dto);
  }

  @Get()
  async findBySemester(@Param('semesterId') semesterId: string) {
    return this.courseService.findBySemester(semesterId);
  }

  @Get(':courseId')
  async findOne(
    @Request() req: any,
    @Param('semesterId') semesterId: string,
    @Param('courseId') courseId: string,
  ) {
    return this.courseService.findByIdUser(semesterId, req.user.userId, courseId);
  }

  @Put(':courseId')
  async update(
    @Request() req: any,
    @Param('semesterId') semesterId: string,
    @Param('courseId') courseId: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.courseService.update(semesterId, req.user.userId, courseId, dto);
  }

  @Delete(':courseId')
  async remove(
    @Request() req: any,
    @Param('semesterId') semesterId: string,
    @Param('courseId') courseId: string,
  ) {
    return this.courseService.remove(semesterId, req.user.userId, courseId);
  }
}
