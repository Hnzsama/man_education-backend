import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum ResourceType {
  FILE = 'FILE',
  LINK = 'LINK',
  NOTE = 'NOTE',
}

export class CreateResourceDto {
  @IsString()
  courseId: string;

  @IsOptional()
  @IsString()
  taskId?: string;

  @IsString()
  title: string;

  @IsEnum(ResourceType)
  type: ResourceType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  url?: string;
}

export class UpdateResourceDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  taskId?: string;
}
