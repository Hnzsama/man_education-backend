import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';

@Injectable()
export class CourseService {
  constructor(private prisma: PrismaService) {}

  async create(semesterId: string, userId: string, dto: CreateCourseDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user && user.role === 'CLASS' && !user.whatsappGroupId) {
      throw new ForbiddenException('Please link your WhatsApp group first before managing courses.');
    }

    const semester = await this.prisma.semester.findFirst({ where: { id: semesterId, userId } });
    if (!semester) throw new NotFoundException('Semester not found');

    let code = dto.code;
    if (!code || code.trim() === '') {
      const courseInitials = dto.name
        .split(/\s+/)
        .map(w => w[0])
        .filter(Boolean)
        .join('')
        .toUpperCase();
      
      const semesterMatch = semester.name.match(/\d+/);
      const semesterSuffix = semesterMatch ? semesterMatch[0] : '';
      
      code = `${courseInitials}${semesterSuffix}` || 'COURSE';
    }

    return this.prisma.course.create({
      data: {
        ...dto,
        code,
        semesterId,
      },
      include: { schedules: true },
    });
  }

  async findBySemester(semesterId: string) {
    return this.prisma.course.findMany({
      where: { semesterId },
      include: {
        schedules: {
          include: { exceptions: true }
        }
      },
    });
  }

  async findByIdUser(semesterId: string, userId: string, courseId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, semesterId },
      include: { schedules: true },
    });
    if (!course) throw new NotFoundException('Course not found');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { joinedClassId: true }
    });
    const userIds = [userId];
    if (user?.joinedClassId) {
      userIds.push(user.joinedClassId);
    }

    const semester = await this.prisma.semester.findFirst({
      where: { id: semesterId, userId: { in: userIds } }
    });
    if (!semester) throw new NotFoundException('Access denied');

    return course;
  }

  async update(semesterId: string, userId: string, courseId: string, dto: UpdateCourseDto) {
    await this.findByIdUser(semesterId, userId, courseId);
    return this.prisma.course.update({ where: { id: courseId }, data: dto });
  }

  async remove(semesterId: string, userId: string, courseId: string) {
    await this.findByIdUser(semesterId, userId, courseId);
    return this.prisma.course.delete({ where: { id: courseId } });
  }

  async findById(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: { schedules: true, tasks: true, semester: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }
}
