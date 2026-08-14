import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { UserService } from '../users/users.service';

@Controller('whatsapp-api')
export class WhatsappApiController {
  constructor(private userService: UserService) {}

  @Get('class-info/:groupId')
  async getClassInfo(@Param('groupId') groupId: string) {
    const classAccount = await this.userService.findByWhatsappGroupId(groupId);
    if (!classAccount) {
      throw new NotFoundException('Class not found for this WhatsApp Group ID');
    }
    return classAccount;
  }
}
