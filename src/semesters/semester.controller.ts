import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { SemesterService } from './semester.service';
import { CreateSemesterDto, UpdateSemesterDto } from './dto/semester.dto';

@UseGuards(JwtAuthGuard)
@Controller('semesters')
export class SemesterController {
  constructor(private semesterService: SemesterService) {}

  @Get('holidays')
  async getHolidays(@Query('year') year: string) {
    const targetYear = year || new Date().getFullYear().toString();
    try {
      const response = await fetch(`https://api-hari-libur.vercel.app/api?year=${targetYear}`);
      if (response.ok) {
        const json = await response.json();
        // API returns { status, code, data: [...] } — unwrap the array
        if (Array.isArray(json)) return json;
        if (json?.data && Array.isArray(json.data)) return json.data;
      }
    } catch (err) {
      // fallback
    }
    return [];
  }

  @Post()
  async create(@Request() req: any, @Body() dto: CreateSemesterDto) {
    return this.semesterService.create(req.user.userId, dto);
  }

  @Get()
  async findAll(@Request() req: any) {
    return this.semesterService.findByUser(req.user.userId);
  }

  @Get(':id')
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.semesterService.findByIdUser(req.user.userId, id);
  }

  @Put(':id')
  async update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateSemesterDto) {
    return this.semesterService.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.semesterService.remove(req.user.userId, id);
  }

  @Post(':id/schedules/ai-generate')
  async generateSchedulesWithAI(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: { image?: string; command?: string }
  ) {
    return this.semesterService.generateSchedulesWithAI(req.user.userId, id, dto);
  }
}
