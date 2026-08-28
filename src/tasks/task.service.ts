import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateTaskDto, UpdateTaskDto, TaskStatus, CreateSubmissionDto } from './dto/task.dto';
import { join, extname } from 'path';
import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

const ALLOWED_MIMETYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'text/plain'
];

function validateMagicBytes(buffer: Buffer, mimetype: string): boolean {
  if (buffer.length < 4) return false;
  const hex = buffer.toString('hex', 0, 4).toUpperCase();
  
  if (mimetype === 'image/jpeg') {
    return hex.startsWith('FFD8FF');
  }
  if (mimetype === 'image/png') {
    return hex === '89504E47';
  }
  if (mimetype === 'image/gif') {
    return hex === '47494638';
  }
  if (mimetype === 'image/webp') {
    if (buffer.length < 12) return false;
    const riff = buffer.toString('hex', 0, 4).toUpperCase();
    const webpStr = buffer.toString('hex', 8, 12).toUpperCase();
    return riff === '52494646' && webpStr === '57454250';
  }
  if (mimetype === 'application/pdf') {
    return hex === '25504446';
  }
  if (
    mimetype === 'application/zip' ||
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return hex === '504B0304';
  }
  if (mimetype === 'application/msword') {
    return hex === 'D0CF11E0';
  }
  if (mimetype === 'application/vnd.ms-excel') {
    return hex === 'D0CF11E0' || hex.startsWith('09080800');
  }
  if (mimetype === 'text/plain') {
    const checkLength = Math.min(buffer.length, 512);
    for (let i = 0; i < checkLength; i++) {
      if (buffer[i] === 0) return false;
    }
    return true;
  }
  return false;
}


@Injectable()
export class TaskService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateTaskDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user && user.role === 'CLASS' && !user.whatsappGroupId) {
      throw new ForbiddenException('Please link your WhatsApp group first before managing tasks.');
    }

    const targetUserId = user?.joinedClassId || userId;

    // Check if user has an active semester
    const activeSemester = await this.prisma.semester.findFirst({
      where: { userId: targetUserId, isActive: true },
    });
    if (!activeSemester) {
      throw new BadRequestException('Please create and activate a semester first before managing tasks.');
    }

    // Verify course belongs to active semester if provided
    if (dto.courseId) {
      const course = await this.prisma.course.findFirst({
        where: {
          id: dto.courseId,
          semester: {
            userId: targetUserId,
            isActive: true,
          },
        },
      });
      if (!course) throw new NotFoundException('Course not found in your active semester');
    }

    return this.prisma.task.create({
      data: {
        userId,
        courseId: dto.courseId || null,
        title: dto.title,
        description: dto.description || null,
        deadline: new Date(dto.deadline),
        isGroupTask: dto.isGroupTask || false,
        myPart: dto.myPart || null,
        weightPercentage: dto.weightPercentage || null,
        submissionMethod: dto.submissionMethod || 'OFFLINE',
        submissionLink: dto.submissionLink || null,
        status: dto.status || 'PENDING',
        priority: dto.priority || 'MEDIUM'
      },
      include: { course: true, attachments: true, resources: true },
    });
  }

  async findByUser(userId: string, status?: TaskStatus) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { joinedClassId: true }
    });
    const userIds = [userId];
    if (user?.joinedClassId) {
      userIds.push(user.joinedClassId);
    }

    const where: any = { userId: { in: userIds } };
    if (status) where.status = status;

    return this.prisma.task.findMany({
      where,
      include: { course: { include: { semester: true } }, checklist: true, attachments: true, resources: true },
      orderBy: { deadline: 'asc' },
    });
  }

  async findByIdUser(userId: string, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { joinedClassId: true }
    });
    const userIds = [userId];
    if (user?.joinedClassId) {
      userIds.push(user.joinedClassId);
    }

    const task = await this.prisma.task.findFirst({
      where: { id, userId: { in: userIds } },
      include: { course: { include: { semester: true } }, checklist: true, attachments: true, resources: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async update(userId: string, id: string, dto: UpdateTaskDto) {
    // Only allow updating if it belongs to the user specifically (not the class, to prevent changing it for everyone)
    const task = await this.prisma.task.findFirst({ where: { id, userId } });
    if (!task) throw new NotFoundException('Task not found or unauthorized to edit class tasks');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const targetUserId = user?.joinedClassId || userId;

    // Check if user has an active semester
    const activeSemester = await this.prisma.semester.findFirst({
      where: { userId: targetUserId, isActive: true },
    });
    if (!activeSemester) {
      throw new BadRequestException('Please create and activate a semester first before managing tasks.');
    }

    if (dto.courseId) {
      const course = await this.prisma.course.findFirst({
        where: {
          id: dto.courseId,
          semester: {
            userId: targetUserId,
            isActive: true,
          },
        },
      });
      if (!course) throw new NotFoundException('Course not found in your active semester');
    }

    if (dto.deadline) {
      await this.prisma.sentReminder.deleteMany({
        where: { targetId: id },
      });
    }

    return this.prisma.task.update({
      where: { id },
      data: dto,
      include: { course: true, checklist: true, attachments: true, resources: true }
    });
  }

  async remove(userId: string, id: string) {
    // Only allow deleting if it belongs to the user specifically
    const task = await this.prisma.task.findFirst({
      where: { id, userId },
      include: { attachments: true }
    });
    if (!task) throw new NotFoundException('Task not found or unauthorized to delete class tasks');

    // Delete attachment files from disk
    if (task.attachments && task.attachments.length > 0) {
      for (const attachment of task.attachments) {
        const filePath = join(process.cwd(), 'uploads', 'tasks', attachment.filePath);
        try {
          await fs.unlink(filePath);
        } catch (err) {
          console.error(`Failed to delete task file attachment from disk: ${filePath}`, err);
        }
      }
    }

    return this.prisma.task.delete({ where: { id } });
  }

  async getUrgentTasks(userId: string) {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { joinedClassId: true }
    });
    const userIds = [userId];
    if (user?.joinedClassId) {
      userIds.push(user.joinedClassId);
    }

    return this.prisma.task.findMany({
      where: {
        userId: { in: userIds },
        deadline: { lte: tomorrow },
        status: { not: TaskStatus.DONE },
      },
      include: { course: true },
      orderBy: { deadline: 'asc' },
    });
  }

  async quickAdd(userId: string, text: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const targetUserId = user?.joinedClassId || userId;

    // Get active semester courses for lookup
    const activeSemester = await this.prisma.semester.findFirst({
      where: { userId: targetUserId, isActive: true },
      include: { courses: true }
    });

    const activeCourses = activeSemester ? activeSemester.courses.map(c => ({ id: c.id, code: c.code, name: c.name })) : [];

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new BadRequestException('Gemini API key is not configured');
    }

    const prompt = `Translate this free-text student assignment/task note into a structured JSON task object.
Reference date/time "now" (WIB timezone): ${new Date().toISOString()}.

User Input: "${text}"

Active Courses:
${JSON.stringify(activeCourses)}

JSON format to return (only return JSON, no markdown codeblocks, no extra fields):
{
  "title": "...", // short title
  "description": "...", // description or extra notes
  "deadline": "...", // ISO datetime format
  "courseId": "...", // matched course ID from active courses. Must be null if no course is matching.
  "priority": "LOW" | "MEDIUM" | "HIGH", // default MEDIUM
  "weightPercentage": null | number,
  "submissionMethod": "GFORM" | "EMAIL" | "LMS" | "UPLOAD" | "OFFLINE", // default OFFLINE
  "submissionLink": null | string
}`;

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new BadRequestException(`Gemini API error: ${errText}`);
    }

    const result = await geminiRes.json();
    const textOutput = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) {
      throw new BadRequestException('Failed to get response from Gemini');
    }

    const parsed = JSON.parse(textOutput);

    // Save task
    return this.prisma.task.create({
      data: {
        userId,
        title: parsed.title || 'Tugas Baru',
        description: parsed.description || null,
        deadline: new Date(parsed.deadline || new Date(Date.now() + 24*60*60*1000)),
        courseId: parsed.courseId || null,
        priority: parsed.priority || 'MEDIUM',
        weightPercentage: parsed.weightPercentage || null,
        submissionMethod: parsed.submissionMethod || 'OFFLINE',
        submissionLink: parsed.submissionLink || null
      },
      include: { course: true, attachments: true }
    });
  }

  async addChecklistItem(userId: string, taskId: string, title: string) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, userId } });
    if (!task) throw new NotFoundException('Task not found');
    return this.prisma.taskChecklistItem.create({
      data: { taskId, title }
    });
  }

  async toggleChecklistItem(userId: string, taskId: string, itemId: string, isCompleted: boolean) {
    const item = await this.prisma.taskChecklistItem.findFirst({
      where: { id: itemId, task: { id: taskId, userId } }
    });
    if (!item) throw new NotFoundException('Checklist item not found');
    return this.prisma.taskChecklistItem.update({
      where: { id: itemId },
      data: { isCompleted }
    });
  }

  async removeChecklistItem(userId: string, taskId: string, itemId: string) {
    const item = await this.prisma.taskChecklistItem.findFirst({
      where: { id: itemId, task: { id: taskId, userId } }
    });
    if (!item) throw new NotFoundException('Checklist item not found');
    return this.prisma.taskChecklistItem.delete({
      where: { id: itemId }
    });
  }

  async uploadAttachments(userId: string, taskId: string, files: Express.Multer.File[]) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, userId } });
    if (!task) throw new NotFoundException('Task not found');

    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const uploadDir = join(process.cwd(), 'uploads', 'tasks');
    await fs.mkdir(uploadDir, { recursive: true });

    const results: any[] = [];

    for (const file of files) {
      const MAX_SIZE = 5 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        throw new BadRequestException(`File ${file.originalname} exceeds the 5MB size limit.`);
      }

      if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
        throw new BadRequestException(`File type ${file.mimetype} is not allowed.`);
      }

      if (!validateMagicBytes(file.buffer, file.mimetype)) {
        throw new BadRequestException(`File content verification failed for ${file.originalname}.`);
      }

      let processedBuffer: Buffer;
      let finalMime = file.mimetype;
      let finalExt = extname(file.originalname).toLowerCase();
      let uniqueName = '';

      if (file.mimetype.startsWith('image/')) {
        try {
          processedBuffer = await sharp(file.buffer)
            .webp({ quality: 80 })
            .toBuffer();
          finalMime = 'image/webp';
          finalExt = '.webp';
          uniqueName = `${randomUUID()}${finalExt}`;
        } catch (err) {
          throw new BadRequestException(`Failed to process image ${file.originalname}: ${err.message}`);
        }
      } else {
        processedBuffer = file.buffer;
        uniqueName = `${randomUUID()}${finalExt}`;
      }

      const filePath = join(uploadDir, uniqueName);
      await fs.writeFile(filePath, processedBuffer);

      const attachment = await this.prisma.taskAttachment.create({
        data: {
          taskId,
          name: file.originalname,
          filePath: uniqueName,
          fileType: finalMime,
          fileSize: processedBuffer.length,
        },
      });

      results.push(attachment);
    }

    return results;
  }

  async removeAttachment(userId: string, taskId: string, attachmentId: string) {
    const attachment = await this.prisma.taskAttachment.findFirst({
      where: {
        id: attachmentId,
        taskId,
        task: { userId },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    const filePath = join(process.cwd(), 'uploads', 'tasks', attachment.filePath);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      console.error(`Failed to delete file from disk: ${filePath}`, err);
    }

    return this.prisma.taskAttachment.delete({
      where: { id: attachmentId },
    });
  }

  async getSubmission(userId: string, taskId: string) {
    const task = await this.findByIdUser(userId, taskId);
    if (!task) throw new NotFoundException('Task not found');

    const submission = await this.prisma.taskSubmission.findUnique({
      where: {
        taskId_userId: { taskId, userId },
      },
      include: {
        files: true,
      },
    });

    return submission || null;
  }

  async createOrUpdateSubmission(
    userId: string,
    taskId: string,
    dto: CreateSubmissionDto,
    files?: Express.Multer.File[],
  ) {
    const task = await this.findByIdUser(userId, taskId);
    if (!task) throw new NotFoundException('Task not found');

    let submission = await this.prisma.taskSubmission.findUnique({
      where: {
        taskId_userId: { taskId, userId },
      },
    });

    if (!submission) {
      submission = await this.prisma.taskSubmission.create({
        data: {
          taskId,
          userId,
          submissionLink: dto.submissionLink || null,
        },
      });
    } else {
      submission = await this.prisma.taskSubmission.update({
        where: { id: submission.id },
        data: {
          submissionLink: dto.submissionLink !== undefined ? dto.submissionLink : submission.submissionLink,
        },
      });
    }

    if (files && files.length > 0) {
      const uploadDir = join(process.cwd(), 'uploads', 'submissions');
      await fs.mkdir(uploadDir, { recursive: true });

      for (const file of files) {
        const MAX_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
          throw new BadRequestException(`File ${file.originalname} exceeds the 10MB size limit.`);
        }

        if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
          throw new BadRequestException(`File type ${file.mimetype} is not allowed.`);
        }

        if (!validateMagicBytes(file.buffer, file.mimetype)) {
          throw new BadRequestException(`File content verification failed for ${file.originalname}.`);
        }

        let processedBuffer: Buffer;
        let finalMime = file.mimetype;
        let finalExt = extname(file.originalname).toLowerCase();
        let uniqueName = '';

        if (file.mimetype.startsWith('image/')) {
          try {
            processedBuffer = await sharp(file.buffer)
              .webp({ quality: 80 })
              .toBuffer();
            finalMime = 'image/webp';
            finalExt = '.webp';
            uniqueName = `${randomUUID()}${finalExt}`;
          } catch (err) {
            throw new BadRequestException(`Failed to process image ${file.originalname}: ${err.message}`);
          }
        } else {
          processedBuffer = file.buffer;
          uniqueName = `${randomUUID()}${finalExt}`;
        }

        const filePath = join(uploadDir, uniqueName);
        await fs.writeFile(filePath, processedBuffer);

        await this.prisma.taskSubmissionFile.create({
          data: {
            submissionId: submission.id,
            name: file.originalname,
            filePath: uniqueName,
            fileType: finalMime,
            fileSize: processedBuffer.length,
          },
        });
      }
    }

    return this.prisma.taskSubmission.findUnique({
      where: { id: submission.id },
      include: { files: true },
    });
  }

  async removeSubmissionFile(userId: string, taskId: string, fileId: string) {
    const submissionFile = await this.prisma.taskSubmissionFile.findFirst({
      where: {
        id: fileId,
        submission: {
          taskId,
          userId,
        },
      },
      include: {
        submission: true,
      },
    });

    if (!submissionFile) {
      throw new NotFoundException('Submission file not found');
    }

    const filePath = join(process.cwd(), 'uploads', 'submissions', submissionFile.filePath);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      console.error(`Failed to delete file from disk: ${filePath}`, err);
    }

    await this.prisma.taskSubmissionFile.delete({
      where: { id: fileId },
    });

    return { success: true };
  }
}

