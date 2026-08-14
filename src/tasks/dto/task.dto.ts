import { IsString, IsUUID, IsOptional, IsEnum, IsDate, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export class CreateTaskDto {
  @ApiProperty({ example: 'Tugas Praktikum Bab 3' })
  @IsString()
  title: string;

  @ApiProperty({ required: false, example: 'Selesaikan soal 1-10' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2024-12-31T23:59:00Z' })
  @IsDateString()
  deadline: string;

  @ApiProperty({ required: false, example: 'COURSE_UUID' })
  @IsOptional()
  @IsUUID()
  courseId?: string;
}

export class UpdateTaskDto {
  @ApiProperty({ required: false, example: 'Tugas Praktikum Bab 3' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false, example: 'Selesaikan soal 1-10' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, example: '2024-12-31T23:59:00Z' })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiProperty({ required: false, enum: TaskStatus, example: TaskStatus.IN_PROGRESS })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiProperty({ required: false, enum: Priority, example: Priority.HIGH })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;
}
