import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';
import { ResourceUploadListener } from './resource-upload.listener';
import { PrismaModule } from '../prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ResourcesController],
  providers: [ResourcesService, ResourceUploadListener],
})
export class ResourcesModule {}
