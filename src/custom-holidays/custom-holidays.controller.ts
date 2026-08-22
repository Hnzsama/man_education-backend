import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { CustomHolidaysService } from './custom-holidays.service';
import { CreateCustomHolidayDto, UpdateCustomHolidayDto } from './dto/custom-holiday.dto';

@UseGuards(JwtAuthGuard)
@Controller('custom-holidays')
export class CustomHolidaysController {
  constructor(private customHolidaysService: CustomHolidaysService) {}

  @Post()
  async create(@Request() req: any, @Body() dto: CreateCustomHolidayDto) {
    return this.customHolidaysService.create(req.user.userId, dto);
  }

  @Get()
  async findAll(@Request() req: any) {
    return this.customHolidaysService.findAll(req.user.userId);
  }

  @Put(':id')
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCustomHolidayDto,
  ) {
    return this.customHolidaysService.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.customHolidaysService.remove(req.user.userId, id);
  }
}
