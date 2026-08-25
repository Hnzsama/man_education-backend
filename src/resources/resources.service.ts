import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateResourceDto, UpdateResourceDto } from './dto/resource.dto';
import { join } from 'path';
import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { extname } from 'path';

const UPLOADS_DIR = join(process.cwd(), 'uploads', 'resources');

const ALLOWED_MIMETYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip', 'text/plain',
];

@Injectable()
export class ResourcesService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  /** Verify course belongs to the user */
  private async verifyCourse(userId: string, courseId: string) {
    const course = await this.prisma.course.findFirst({
      where: {
        id: courseId,
        semester: { userId },
      },
    });
    if (!course) throw new NotFoundException('Course not found or access denied');
    return course;
  }

  /** List all resources, optionally filtered */
  async findAll(userId: string, courseId?: string, taskId?: string, type?: string) {
    // Fetch courses owned by user
    const userCourses = await this.prisma.course.findMany({
      where: { semester: { userId } },
      select: { id: true },
    });
    const courseIds = userCourses.map((c) => c.id);

    const where: any = { courseId: { in: courseIds } };
    if (courseId) where.courseId = courseId;
    if (taskId) where.taskId = taskId;
    if (type) where.type = type;

    return this.prisma.courseResource.findMany({
      where,
      include: {
        course: { select: { id: true, name: true, code: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Create a resource (link/note immediately DONE, file async via event) */
  async create(
    userId: string,
    dto: CreateResourceDto,
    file?: Express.Multer.File,
  ) {
    await this.verifyCourse(userId, dto.courseId);

    if (dto.type === 'FILE' && !file) {
      throw new BadRequestException('File is required for type FILE');
    }
    if (dto.type === 'LINK' && !dto.url) {
      throw new BadRequestException('URL is required for type LINK');
    }
    if ((dto.type === 'FILE') && file && !ALLOWED_MIMETYPES.includes(file.mimetype)) {
      throw new BadRequestException('File type not allowed');
    }

    const resource = await this.prisma.courseResource.create({
      data: {
        courseId: dto.courseId,
        taskId: dto.taskId || null,
        title: dto.title,
        type: dto.type as any,
        description: dto.description || null,
        url: dto.url || null,
        fileName: file?.originalname || null,
        fileSize: file?.size || null,
        mimeType: file?.mimetype || null,
        uploadStatus: file ? 'PENDING' : 'DONE',
      },
      include: {
        course: { select: { id: true, name: true, code: true } },
        task: { select: { id: true, title: true } },
      },
    });

    // Emit background event if file
    if (file) {
      this.eventEmitter.emit('resource.upload', {
        resourceId: resource.id,
        buffer: file.buffer,
        originalName: file.originalname,
        mimetype: file.mimetype,
      });
    }

    return resource;
  }

  /** Update title/description/url/taskId */
  async update(userId: string, id: string, dto: UpdateResourceDto) {
    const resource = await this.prisma.courseResource.findFirst({
      where: { id, course: { semester: { userId } } },
    });
    if (!resource) throw new NotFoundException('Resource not found');

    return this.prisma.courseResource.update({
      where: { id },
      data: {
        title: dto.title ?? resource.title,
        description: dto.description ?? resource.description,
        url: dto.url ?? resource.url,
        taskId: dto.taskId !== undefined ? (dto.taskId || null) : resource.taskId,
      },
      include: {
        course: { select: { id: true, name: true, code: true } },
        task: { select: { id: true, title: true } },
      },
    });
  }

  /** Delete resource + file on disk */
  async remove(userId: string, id: string) {
    const resource = await this.prisma.courseResource.findFirst({
      where: { id, course: { semester: { userId } } },
    });
    if (!resource) throw new NotFoundException('Resource not found');

    if (resource.filePath) {
      try {
        await fs.unlink(join(UPLOADS_DIR, resource.filePath));
      } catch { /* ignore if already gone */ }
    }

    await this.prisma.courseResource.delete({ where: { id } });
    return { message: 'Resource deleted' };
  }

  /** Background: save file buffer to disk and update DB */
  async processUpload(resourceId: string, buffer: Buffer, originalName: string) {
    try {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
      const ext = extname(originalName);
      const filename = `${randomUUID()}${ext}`;
      await fs.writeFile(join(UPLOADS_DIR, filename), buffer);

      await this.prisma.courseResource.update({
        where: { id: resourceId },
        data: { filePath: filename, uploadStatus: 'DONE' },
      });
    } catch {
      await this.prisma.courseResource.update({
        where: { id: resourceId },
        data: { uploadStatus: 'FAILED' },
      });
    }
  }
}
