import { IsString, IsUUID, IsOptional, IsEnum, IsDateString, IsBoolean, IsInt, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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

export enum SubmissionMethod {
  GFORM = 'GFORM',
  EMAIL = 'EMAIL',
  LMS = 'LMS',
  UPLOAD = 'UPLOAD',
  OFFLINE = 'OFFLINE',
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

  @ApiProperty({ example: 'COURSE_UUID' })
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isGroupTask?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  myPart?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  weightPercentage?: number;

  @ApiProperty({ required: false, enum: SubmissionMethod })
  @IsOptional()
  @IsEnum(SubmissionMethod)
  submissionMethod?: SubmissionMethod;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  submissionLink?: string;

  @ApiProperty({ required: false, enum: TaskStatus, example: TaskStatus.PENDING })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiProperty({ required: false, enum: Priority, example: Priority.MEDIUM })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;
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

  @ApiProperty({ required: false, example: 'COURSE_UUID' })
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isGroupTask?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  myPart?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  weightPercentage?: number;

  @ApiProperty({ required: false, enum: SubmissionMethod })
  @IsOptional()
  @IsEnum(SubmissionMethod)
  submissionMethod?: SubmissionMethod;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  submissionLink?: string;
}
