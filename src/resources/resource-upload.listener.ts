import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ResourcesService } from './resources.service';

@Injectable()
export class ResourceUploadListener {
  constructor(private resourcesService: ResourcesService) {}

  @OnEvent('resource.upload', { async: true })
  async handleUpload(payload: {
    resourceId: string;
    buffer: Buffer;
    originalName: string;
    mimetype: string;
  }) {
    await this.resourcesService.processUpload(
      payload.resourceId,
      payload.buffer,
      payload.originalName,
    );
  }
}
