import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateTaskDto, UpdateTaskDto, TaskStatus } from './dto/task.dto';

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
      include: { course: true },
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
      include: { course: { include: { semester: true } }, checklist: true },
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
      include: { course: { include: { semester: true } }, checklist: true },
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

    return this.prisma.task.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    // Only allow deleting if it belongs to the user specifically
    const task = await this.prisma.task.findFirst({ where: { id, userId } });
    if (!task) throw new NotFoundException('Task not found or unauthorized to delete class tasks');
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
      include: { course: true }
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
}
