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
        whatsappNumber: data.whatsappNumber !== undefined ? data.whatsappNumber : undefined,
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
