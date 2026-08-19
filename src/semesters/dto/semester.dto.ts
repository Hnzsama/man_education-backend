import { IsString, IsDate, IsBoolean, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateSemesterDto {
  @ApiProperty({ example: 'Semester 5' })
  @IsString()
  name: string;

  @ApiProperty({ example: '2024-09-01' })
  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @ApiProperty({ example: '2025-01-15' })
  @IsDate()
  @Type(() => Date)
  endDate: Date;

  @ApiProperty({ required: false, example: '2024-09-05' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  academicStartDate?: Date;

  @ApiProperty({ required: false, example: '2024-12-20' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  holidayStartDate?: Date;

  @ApiProperty({ required: false, example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSemesterDto {
  @ApiProperty({ required: false, example: 'Semester 5' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false, example: '2024-09-01' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiProperty({ required: false, example: '2025-01-15' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiProperty({ required: false, example: '2024-09-05' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  academicStartDate?: Date;

  @ApiProperty({ required: false, example: '2024-12-20' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  holidayStartDate?: Date;

  @ApiProperty({ required: false, example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
