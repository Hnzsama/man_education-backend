import { IsString, IsInt, IsOptional, Min, Max, IsEnum, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateScheduleDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek: number;

  @ApiProperty({ example: '08:00' })
  @IsString()
  startTime: string;

  @ApiProperty({ example: '10:00' })
  @IsString()
  endTime: string;

  @ApiProperty({ required: false, example: 'Ruang 301' })
  @IsOptional()
  @IsString()
  room?: string;

  @ApiProperty({ required: false, example: 'https://zoom.us/j/123456' })
  @IsOptional()
  @IsString()
  link?: string;
}

export class UpdateScheduleDto {
  @ApiProperty({ required: false, example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek?: number;

  @ApiProperty({ required: false, example: '08:00' })
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiProperty({ required: false, example: '10:00' })
  @IsOptional()
  @IsString()
  endTime?: string;

  @ApiProperty({ required: false, example: 'Ruang 301', nullable: true })
  @ValidateIf((o) => o.room !== null)
  @IsOptional()
  @IsString()
  room?: string | null;

  @ApiProperty({ required: false, example: 'https://zoom.us/j/123456', nullable: true })
  @ValidateIf((o) => o.link !== null)
  @IsOptional()
  @IsString()
  link?: string | null;
}

export class CreateExceptionDto {
  @ApiProperty({ example: '2026-08-11' })
  @IsString()
  date: string;

  @ApiProperty({ enum: ['CANCELLED', 'MOVED', 'NOTE'], default: 'CANCELLED' })
  @IsOptional()
  @IsEnum(['CANCELLED', 'MOVED', 'NOTE'])
  type?: 'CANCELLED' | 'MOVED' | 'NOTE';

  @ApiProperty({ required: false, example: '13:00' })
  @IsOptional()
  @IsString()
  newStartTime?: string;

  @ApiProperty({ required: false, example: '15:00' })
  @IsOptional()
  @IsString()
  newEndTime?: string;

  @ApiProperty({ required: false, example: 'Ruang 202' })
  @IsOptional()
  @IsString()
  newRoom?: string;

  @ApiProperty({ required: false, example: 'https://meet.google.com/abc' })
  @IsOptional()
  @IsString()
  newLink?: string;

  @ApiProperty({ required: false, example: 'Kelas dipindah karena dosen ada rapat' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateExceptionDto {
  @ApiProperty({ enum: ['CANCELLED', 'MOVED', 'NOTE'], required: false })
  @IsOptional()
  @IsEnum(['CANCELLED', 'MOVED', 'NOTE'])
  type?: 'CANCELLED' | 'MOVED' | 'NOTE';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  newStartTime?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  newEndTime?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  newRoom?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  newLink?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
