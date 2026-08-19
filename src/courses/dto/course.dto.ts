import { IsString, IsInt, IsUUID, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateCourseDto {
  @ApiProperty({ required: false, example: 'SNR301' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: 'Manajemen Jaringan' })
  @IsString()
  name: string;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  @Max(6)
  credits: number;

  @ApiProperty({ required: false, example: 'Dr. Ahmad' })
  @IsOptional()
  @IsString()
  lecturer?: string;
}

export class UpdateCourseDto {
  @ApiProperty({ required: false, example: 'SNR301' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ required: false, example: 'Manajemen Jaringan' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false, example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  credits?: number;

  @ApiProperty({ required: false, example: 'Dr. Ahmad' })
  @IsOptional()
  @IsString()
  lecturer?: string;
}
