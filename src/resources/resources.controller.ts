import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { ResourcesService } from './resources.service';
import { CreateResourceDto, UpdateResourceDto } from './dto/resource.dto';

@UseGuards(JwtAuthGuard)
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Get()
  async findAll(
    @Request() req: any,
    @Query('courseId') courseId?: string,
    @Query('taskId') taskId?: string,
    @Query('type') type?: string,
  ) {
    return this.resourcesService.findAll(req.user.userId, courseId, taskId, type);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  async create(
    @Request() req: any,
    @Body() dto: CreateResourceDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.resourcesService.create(req.user.userId, dto, file);
  }

  @Patch(':id')
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateResourceDto,
  ) {
    return this.resourcesService.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.resourcesService.remove(req.user.userId, id);
  }
}
