import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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

    const data: any = { ...dto, userId };

    if (dto.courseId) {
      const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
      if (!course) throw new NotFoundException('Course not found');
    }

    return this.prisma.task.create({
      data,
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
      include: { course: { include: { semester: true } } },
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
      include: { course: { include: { semester: true } } },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async update(userId: string, id: string, dto: UpdateTaskDto) {
    // Only allow updating if it belongs to the user specifically (not the class, to prevent changing it for everyone)
    const task = await this.prisma.task.findFirst({ where: { id, userId } });
    if (!task) throw new NotFoundException('Task not found or unauthorized to edit class tasks');
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
}
