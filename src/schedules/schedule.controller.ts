import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { ScheduleService } from './schedule.service';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  CreateExceptionDto,
  UpdateExceptionDto,
} from './dto/schedule.dto';

@UseGuards(JwtAuthGuard)
@Controller('courses/:courseId/schedules')
export class ScheduleController {
  constructor(private scheduleService: ScheduleService) {}

  // ─── Schedule CRUD ────────────────────────────────────────────────────

  @Post()
  async create(
    @Param('courseId') courseId: string,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.scheduleService.create(courseId, dto);
  }

  @Get()
  async findByCourse(@Param('courseId') courseId: string) {
    return this.scheduleService.findByCourse(courseId);
  }

  @Get(':scheduleId')
  async findOne(
    @Param('courseId') courseId: string,
    @Param('scheduleId') scheduleId: string,
  ) {
    return this.scheduleService.findOnecourse(courseId, scheduleId);
  }

  @Put(':scheduleId')
  async update(
    @Param('courseId') courseId: string,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.scheduleService.update(courseId, scheduleId, dto);
  }

  @Delete(':scheduleId')
  async remove(
    @Param('courseId') courseId: string,
    @Param('scheduleId') scheduleId: string,
  ) {
    return this.scheduleService.remove(courseId, scheduleId);
  }

  // ─── Schedule Exceptions ─────────────────────────────────────────────

  @Post(':scheduleId/exceptions')
  async createException(
    @Param('scheduleId') scheduleId: string,
    @Body() dto: CreateExceptionDto,
  ) {
    return this.scheduleService.createException(scheduleId, dto);
  }

  @Get(':scheduleId/exceptions')
  async findExceptions(@Param('scheduleId') scheduleId: string) {
    return this.scheduleService.findExceptions(scheduleId);
  }

  @Put(':scheduleId/exceptions/:id')
  async updateException(
    @Param('id') id: string,
    @Body() dto: UpdateExceptionDto,
  ) {
    return this.scheduleService.updateException(id, dto);
  }

  @Delete(':scheduleId/exceptions/:id')
  async removeException(@Param('id') id: string) {
    return this.scheduleService.removeException(id);
  }
}
