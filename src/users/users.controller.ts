import {
  Controller,
  Get,
  UseGuards,
  Request,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Delete,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { UserService } from './users.service';
import { CreateUserDto, LoginDto } from '../auth/dto/user.dto';
import { PrismaService } from '../prisma.service';

import { IsString, IsOptional, IsBoolean, IsArray, IsInt, IsEnum } from 'class-validator';
import { NotificationChannel } from '@prisma/client';

class UpdateWhatsappGroupDto {
  @IsString()
  @IsOptional()
  whatsappGroupId?: string;
}

class UpdateRemindersDto {
  @IsBoolean()
  @IsOptional()
  remindersEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  semesterTransitionEnabled?: boolean;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  scheduleReminderOffsets?: number[];

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  taskReminderOffsets?: number[];

  @IsEnum(NotificationChannel)
  @IsOptional()
  notificationChannel?: NotificationChannel;

  @IsString()
  @IsOptional()
  whatsappNumber?: string;

  @IsString()
  @IsOptional()
  whatsappJid?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private userService: UserService) {}

  @Get()
  async findAll(@Request() req: any) {
    const users = await this.userService.findAll();
    return users.map((u: any) => {
      const { password, ...result } = u;
      return result;
    });
  }

  @Get('me')
  async findMe(@Request() req: any) {
    const user = await this.userService.findById(req.user.userId);
    const { password, ...result } = user;
    return result;
  }

  @Post('whatsapp-group')
  @HttpCode(HttpStatus.OK)
  async updateWhatsappGroup(@Request() req: any, @Body() body: UpdateWhatsappGroupDto) {
    const user: any = await this.userService.updateWhatsappGroup(req.user.userId, body.whatsappGroupId || null);
    const { password, ...result } = user;
    return result;
  }

  @Post('students')
  @HttpCode(HttpStatus.OK)
  async addStudent(@Request() req: any, @Body('email') email: string) {
    if (!email) {
      throw new BadRequestException('Student email is required');
    }
    const currentUser = await this.userService.findById(req.user.userId);
    if (currentUser.role !== 'CLASS') {
      throw new ForbiddenException('Only class managers can add students');
    }
    const student: any = await this.userService.addStudentToClass(req.user.userId, email);
    const { password, ...result } = student;
    return result;
  }

  @Get('students/list')
  @HttpCode(HttpStatus.OK)
  async getStudents(@Request() req: any) {
    const currentUser = await this.userService.findById(req.user.userId);
    if (currentUser.role !== 'CLASS') {
      throw new ForbiddenException('Only class managers can view the student list');
    }
    return this.userService.getStudentsInClass(req.user.userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const user = await this.userService.findById(id);
    const { password, ...result } = user;
    return result;
  }

  @Post('join-class')
  @HttpCode(HttpStatus.OK)
  async joinClass(@Request() req: any, @Body('classCode') classCode: string) {
    if (!classCode) {
      throw new BadRequestException('Class code is required');
    }
    const user = await this.userService.joinClass(req.user.userId, classCode);
    const { password, ...result } = user;
    return result;
  }

  @Post('leave-class')
  @HttpCode(HttpStatus.OK)
  async leaveClass(@Request() req: any) {
    const user = await this.userService.leaveClass(req.user.userId);
    const { password, ...result } = user;
    return result;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateUserDto: Partial<CreateUserDto>) {
    const user = await this.userService.update(id, updateUserDto);
    const { password, ...result } = user;
    return result;
  }

  @Patch('me/reminders')
  @HttpCode(HttpStatus.OK)
  async updateReminders(@Request() req: any, @Body() body: UpdateRemindersDto) {
    const user: any = await this.userService.updateReminders(req.user.userId, body);
    const { password, ...result } = user;
    return result;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.userService.remove(id);
    return { message: 'User deleted successfully' };
  }
}
