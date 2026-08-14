import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UserService } from './users.service';
import { WhatsappApiController } from '../whatsapp-api/whatsapp-api.controller';
import { ReminderCronService } from './reminder-cron.service';

@Module({
  controllers: [UsersController, WhatsappApiController],
  providers: [UserService, ReminderCronService],
  exports: [UserService],
})
export class UsersModule {}
