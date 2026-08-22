import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { TaskService } from './task.service';
import { CreateTaskDto, UpdateTaskDto, TaskStatus } from './dto/task.dto';

@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TaskController {
  constructor(private taskService: TaskService) {}

  @Post()
  async create(@Request() req: any, @Body() dto: CreateTaskDto) {
    return this.taskService.create(req.user.userId, dto);
  }

  @Post('quick-add')
  async quickAdd(@Request() req: any, @Body('text') text: string) {
    return this.taskService.quickAdd(req.user.userId, text);
  }

  @Get()
  async findAll(@Request() req: any, @Query('status') status?: TaskStatus) {
    return this.taskService.findByUser(req.user.userId, status);
  }

  @Get('urgent')
  async getUrgent(@Request() req: any) {
    return this.taskService.getUrgentTasks(req.user.userId);
  }

  @Get(':id')
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.taskService.findByIdUser(req.user.userId, id);
  }

  @Put(':id')
  async update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.taskService.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.taskService.remove(req.user.userId, id);
  }

  @Post(':taskId/checklist')
  async addChecklistItem(@Request() req: any, @Param('taskId') taskId: string, @Body('title') title: string) {
    return this.taskService.addChecklistItem(req.user.userId, taskId, title);
  }

  @Put(':taskId/checklist/:itemId')
  async toggleChecklistItem(
    @Request() req: any,
    @Param('taskId') taskId: string,
    @Param('itemId') itemId: string,
    @Body('isCompleted') isCompleted: boolean
  ) {
    return this.taskService.toggleChecklistItem(req.user.userId, taskId, itemId, isCompleted);
  }

  @Delete(':taskId/checklist/:itemId')
  async removeChecklistItem(
    @Request() req: any,
    @Param('taskId') taskId: string,
    @Param('itemId') itemId: string
  ) {
    return this.taskService.removeChecklistItem(req.user.userId, taskId, itemId);
  }
}
