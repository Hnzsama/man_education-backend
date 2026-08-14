import { IsString, IsDate, IsBoolean, IsUUID } from 'class-validator';
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

  @ApiProperty({ required: false, example: false })
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSemesterDto {
  @ApiProperty({ required: false, example: 'Semester 5' })
  @IsString()
  name?: string;

  @ApiProperty({ required: false, example: '2024-09-01' })
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiProperty({ required: false, example: '2025-01-15' })
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiProperty({ required: false, example: false })
  @IsBoolean()
  isActive?: boolean;
}
