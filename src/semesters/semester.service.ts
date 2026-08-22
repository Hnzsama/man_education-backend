import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateSemesterDto, UpdateSemesterDto } from './dto/semester.dto';

@Injectable()
export class SemesterService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateSemesterDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user && user.role === 'CLASS' && !user.whatsappGroupId) {
      throw new ForbiddenException('Please link your WhatsApp group first before managing semesters.');
    }

    return this.prisma.semester.create({
      data: { ...dto, userId },
      include: { courses: true },
    });
  }

  async findByUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { joinedClassId: true }
    });
    const userIds = [userId];
    if (user?.joinedClassId) {
      userIds.push(user.joinedClassId);
    }
    return this.prisma.semester.findMany({
      where: { userId: { in: userIds } },
      include: { courses: { include: { schedules: { include: { exceptions: true } } } } },
      orderBy: { startDate: 'desc' },
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
    const semester = await this.prisma.semester.findFirst({
      where: { id, userId: { in: userIds } },
      include: { courses: { include: { schedules: { include: { exceptions: true } } } } },
    });
    if (!semester) throw new NotFoundException('Semester not found');
    return semester;
  }

  async update(userId: string, id: string, dto: UpdateSemesterDto) {
    const semester = await this.prisma.semester.findFirst({ where: { id, userId } });
    if (!semester) throw new NotFoundException('Semester not found');
    return this.prisma.semester.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    const semester = await this.prisma.semester.findFirst({ where: { id, userId } });
    if (!semester) throw new NotFoundException('Semester not found');
    return this.prisma.semester.delete({ where: { id } });
  }

  async generateSchedulesWithAI(userId: string, semesterId: string, dto: { image?: string; command?: string }) {
    const semester = await this.prisma.semester.findFirst({ where: { id: semesterId, userId } });
    if (!semester) throw new NotFoundException('Semester not found');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key is not configured');
    }

    const courses = await this.prisma.course.findMany({
      where: { semesterId }
    });

    if (courses.length === 0) {
      throw new ForbiddenException('Please add courses to your semester first before generating schedules.');
    }

    const courseList = courses.map(c => `- ID: "${c.id}", Name: "${c.name}", Code: "${c.code}"`).join('\n');

    const promptText = `
You are an academic schedule parser. Extract all class schedules from the provided image and/or text instructions.
Here are the existing courses in the current semester:
${courseList}

Please parse the schedule and match each extracted class to one of the existing course IDs above.
For each class schedule, extract:
- courseId (must match one of the existing course IDs from the list)
- dayOfWeek (integer: 1 for Monday, 2 for Tuesday, 3 for Wednesday, 4 for Thursday, 5 for Friday, 6 for Saturday, 7 for Sunday)
- startTime (string format HH:MM, e.g. '08:00')
- endTime (string format HH:MM, e.g. '09:40')
- room (optional string, e.g. 'Lab Komputer 3')
- link (optional string, e.g. online class URL)

You must output the result ONLY as a JSON object matching this schema:
{
  "schedules": [
    {
      "courseId": "string",
      "dayOfWeek": number,
      "startTime": "string",
      "endTime": "string",
      "room": "string",
      "link": "string"
    }
  ]
}
If no schedules are found or if none match the existing courses, return an empty array of schedules. Do not output markdown block formatting (e.g. \`\`\`json) outside the JSON structure.
`;

    const parts: any[] = [{ text: promptText }];
    if (dto.image) {
      const match = dto.image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2]
          }
        });
      } else {
        parts.push({
          inlineData: {
            mimeType: 'image/png',
            data: dto.image
          }
        });
      }
    }
    if (dto.command) {
      parts.push({ text: `Additional user instructions: ${dto.command}` });
    }

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini API error: ${errText}`);
    }

    const result = await geminiRes.json();
    const textOutput = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) {
      throw new Error('Failed to get response from Gemini');
    }

    const parsed = JSON.parse(textOutput);
    const createdSchedules: any[] = [];
    if (parsed && Array.isArray(parsed.schedules)) {
      for (const item of parsed.schedules) {
        if (courses.some(c => c.id === item.courseId)) {
          const created = await this.prisma.schedule.create({
            data: {
              courseId: item.courseId,
              dayOfWeek: item.dayOfWeek,
              startTime: item.startTime,
              endTime: item.endTime,
              room: item.room || null,
              link: item.link || null,
            }
          });
          createdSchedules.push(created);
        }
      }
    }
    return createdSchedules;
  }
}
