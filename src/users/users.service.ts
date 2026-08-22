import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateUserDto } from '../auth/dto/user.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

export interface UserWithPassword {
  id: string;
  email: string;
  password: string;
  name: string;
  avatar?: string | null;
  role: Role;
  classCode?: string | null;
  joinedClassId?: string | null;
  joinedClass?: any;
  emailVerified: boolean;
  verificationCode?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  private generateClassCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'CLASS-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async create(createUserDto: CreateUserDto): Promise<UserWithPassword> {
    const data: any = { ...createUserDto };
    
    if (data.role === Role.CLASS) {
      let isUnique = false;
      let code = '';
      while (!isUnique) {
        code = this.generateClassCode();
        const existing = await this.prisma.user.findUnique({ where: { classCode: code } });
        if (!existing) {
          isUnique = true;
        }
      }
      data.classCode = code;
    } else {
      data.role = Role.INDIVIDUAL;
    }

    return this.prisma.user.create({
      data,
    }) as unknown as UserWithPassword;
  }

  async findAll(): Promise<Omit<UserWithPassword, 'password'>[]> {
    const users = await this.prisma.user.findMany({
      include: { joinedClass: true }
    });
    return users.map(({ password, ...user }) => user) as any;
  }

  async findById(id: string): Promise<UserWithPassword> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { joinedClass: true }
    });
    if (!user) throw new NotFoundException('User not found');
    return user as unknown as UserWithPassword;
  }

  async findByEmail(email: string): Promise<UserWithPassword | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: { joinedClass: true }
    }) as unknown as Promise<UserWithPassword | null>;
  }

  async update(id: string, updateUserDto: Partial<CreateUserDto>): Promise<UserWithPassword> {
    const data: any = { ...updateUserDto };
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    return this.prisma.user.update({
      where: { id },
      data,
      include: { joinedClass: true }
    }) as unknown as UserWithPassword;
  }

  async findByClassCode(classCode: string) {
    return this.prisma.user.findUnique({
      where: { classCode, role: Role.CLASS }
    });
  }

  async joinClass(userId: string, classCode: string): Promise<UserWithPassword> {
    const classUser = await this.findByClassCode(classCode);
    if (!classUser) throw new NotFoundException('Class not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: { joinedClassId: classUser.id },
      include: { joinedClass: true }
    }) as unknown as UserWithPassword;
  }

  async leaveClass(userId: string): Promise<UserWithPassword> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { joinedClassId: null },
      include: { joinedClass: true }
    }) as unknown as UserWithPassword;
  }

  async updateWhatsappGroup(userId: string, whatsappGroupId: string | null) {
    const targetGroupId = whatsappGroupId?.trim() || null;

    if (targetGroupId) {
      // Cari jika ada kelas lain yang saat ini terhubung ke grup yang sama
      const existingLink = await this.prisma.user.findFirst({
        where: {
          whatsappGroupId: targetGroupId,
          id: { not: userId },
        },
      });

      // Jika ada, putuskan dulu hubungannya dari kelas lama agar tidak bentrok unique constraint
      if (existingLink) {
        await this.prisma.user.update({
          where: { id: existingLink.id },
          data: { whatsappGroupId: null },
        });
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { whatsappGroupId: targetGroupId },
      include: { joinedClass: true }
    }) as unknown as UserWithPassword;
  }

  async addStudentToClass(classUserId: string, studentEmail: string) {
    let student = await this.findByEmail(studentEmail);
    if (!student) {
      const emailPrefix = studentEmail.split('@')[0];
      const displayName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
      const randomPassword = Math.random().toString(36).substring(2, 15);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      student = await this.prisma.user.create({
        data: {
          email: studentEmail,
          name: displayName,
          password: hashedPassword,
          role: Role.INDIVIDUAL,
          joinedClassId: classUserId,
        }
      }) as any;
    } else {
      student = await this.prisma.user.update({
        where: { id: student.id },
        data: { joinedClassId: classUserId },
        include: { joinedClass: true }
      }) as any;
    }
    return student;
  }

  async getStudentsInClass(classUserId: string) {
    return this.prisma.user.findMany({
      where: { joinedClassId: classUserId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true,
      }
    });
  }

  async findByWhatsappGroupId(whatsappGroupId: string) {
    return this.prisma.user.findUnique({
      where: { whatsappGroupId },
      include: {
        students: {
          select: {
            id: true,
            email: true,
            name: true,
          }
        },
        semesters: {
          include: {
            courses: {
              include: {
                schedules: true
              }
            },
          },
        },
        tasks: {
          include: {
            course: true
          }
        }
      },
    });
  }

  async updateReminders(userId: string, data: any) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        remindersEnabled: data.remindersEnabled !== undefined ? data.remindersEnabled : undefined,
        semesterTransitionEnabled: data.semesterTransitionEnabled !== undefined ? data.semesterTransitionEnabled : undefined,
        scheduleReminderOffsets: data.scheduleReminderOffsets !== undefined ? data.scheduleReminderOffsets : undefined,
        taskReminderOffsets: data.taskReminderOffsets !== undefined ? data.taskReminderOffsets : undefined,
        notificationChannel: data.notificationChannel !== undefined ? data.notificationChannel : undefined,
        whatsappNumber: (() => {
          // Explicit number takes priority; else auto-extract from JID (e.g. '628xxx@lid' → '628xxx')
          if (data.whatsappNumber !== undefined) return data.whatsappNumber || undefined;
          if (data.whatsappJid) return data.whatsappJid.split('@')[0];
          return undefined;
        })(),
        whatsappJid: data.whatsappJid !== undefined ? (data.whatsappJid || undefined) : undefined,
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  async exportData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        semesters: {
          include: {
            courses: {
              include: {
                schedules: true
              }
            }
          }
        },
        tasks: true
      }
    });

    if (!user) throw new NotFoundException('User not found');

    return {
      semesters: user.semesters.map(s => ({
        id: s.id,
        name: s.name,
        startDate: s.startDate,
        endDate: s.endDate,
        isActive: s.isActive,
        courses: s.courses.map(c => ({
          id: c.id,
          code: c.code,
          name: c.name,
          credits: c.credits,
          lecturer: c.lecturer,
          schedules: c.schedules.map(sch => ({
            id: sch.id,
            dayOfWeek: sch.dayOfWeek,
            startTime: sch.startTime,
            endTime: sch.endTime,
            room: sch.room,
            link: sch.link
          }))
        }))
      })),
      tasks: user.tasks.map(t => ({
        id: t.id,
        courseId: t.courseId,
        title: t.title,
        description: t.description,
        deadline: t.deadline,
        status: t.status,
        priority: t.priority,
        isGroupTask: t.isGroupTask,
        myPart: t.myPart,
        weightPercentage: t.weightPercentage,
        submissionMethod: t.submissionMethod,
        submissionLink: t.submissionLink
      }))
    };
  }

  async importData(userId: string, data: any) {
    const semesters = data.semesters || [];
    const tasks = data.tasks || [];

    const semesterIdMap = new Map<string, string>();
    const courseIdMap = new Map<string, string>();

    // Process Semesters, Courses, Schedules
    for (const sem of semesters) {
      let dbSemester = await this.prisma.semester.findFirst({
        where: { userId, name: sem.name }
      });

      if (!dbSemester) {
        dbSemester = await this.prisma.semester.create({
          data: {
            userId,
            name: sem.name,
            startDate: new Date(sem.startDate),
            endDate: new Date(sem.endDate),
            isActive: sem.isActive
          }
        });
      }
      semesterIdMap.set(sem.id, dbSemester.id);

      const courses = sem.courses || [];
      for (const c of courses) {
        let dbCourse = await this.prisma.course.findFirst({
          where: { semesterId: dbSemester.id, code: c.code }
        });

        if (!dbCourse) {
          dbCourse = await this.prisma.course.create({
            data: {
              semesterId: dbSemester.id,
              code: c.code,
              name: c.name,
              credits: c.credits || 3,
              lecturer: c.lecturer || null
            }
          });
        }
        courseIdMap.set(c.id, dbCourse.id);

        const schedules = c.schedules || [];
        for (const sch of schedules) {
          const existingSch = await this.prisma.schedule.findFirst({
            where: {
              courseId: dbCourse.id,
              dayOfWeek: sch.dayOfWeek,
              startTime: sch.startTime,
              endTime: sch.endTime
            }
          });

          if (!existingSch) {
            await this.prisma.schedule.create({
              data: {
                courseId: dbCourse.id,
                dayOfWeek: sch.dayOfWeek,
                startTime: sch.startTime,
                endTime: sch.endTime,
                room: sch.room || null,
                link: sch.link || null
              }
            });
          }
        }
      }
    }

    // Process Tasks
    for (const t of tasks) {
      const newCourseId = t.courseId ? (courseIdMap.get(t.courseId) || null) : null;

      const existingTask = await this.prisma.task.findFirst({
        where: {
          userId,
          title: t.title,
          deadline: new Date(t.deadline)
        }
      });

      if (!existingTask) {
        await this.prisma.task.create({
          data: {
            userId,
            courseId: newCourseId,
            title: t.title,
            description: t.description || null,
            deadline: new Date(t.deadline),
            status: t.status || 'PENDING',
            priority: t.priority || 'MEDIUM',
            isGroupTask: t.isGroupTask || false,
            myPart: t.myPart || null,
            weightPercentage: t.weightPercentage || null,
            submissionMethod: t.submissionMethod || 'OFFLINE',
            submissionLink: t.submissionLink || null
          }
        });
      }
    }

    return { success: true };
  }
}
