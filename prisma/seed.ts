import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';

// Load environment variables
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // 1. Get or create hnzsama@gmail.com user
  let user = await prisma.user.findUnique({
    where: { email: 'hnzsama@gmail.com' },
  });
  
  if (!user) {
    console.log('User hnzsama@gmail.com not found. Creating...');
    const hashedPassword = await bcrypt.hash('password123', 10);
    user = await prisma.user.create({
      data: {
        email: 'hnzsama@gmail.com',
        name: 'Hnzsama',
        password: hashedPassword,
        role: 'INDIVIDUAL',
      },
    });
  }

  console.log(`Seeding data for user: ${user.email} (${user.id})`);

  // Clean existing tasks and schedules for this user
  await prisma.task.deleteMany({
    where: { userId: user.id },
  });

  await prisma.schedule.deleteMany({
    where: {
      course: {
        semester: {
          userId: user.id,
        },
      },
    },
  });

  await prisma.course.deleteMany({
    where: {
      semester: {
        userId: user.id,
      },
    },
  });

  await prisma.semester.deleteMany({
    where: {
      userId: user.id,
    },
  });

  // 2. Seed Semesters
  const semester1 = await prisma.semester.create({
    data: {
      userId: user.id,
      name: 'Semester 1',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2026-01-31'),
      isActive: false,
    },
  });

  const semester2 = await prisma.semester.create({
    data: {
      userId: user.id,
      name: 'Semester 2',
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-12-31'),
      isActive: true,
    },
  });

  console.log('Semesters seeded.');

  // 3. Seed Courses under Semester 2
  const course1 = await prisma.course.create({
    data: {
      semesterId: semester2.id,
      code: 'IF101',
      name: 'Introduction to Computer Science',
      credits: 3,
      lecturer: 'Dr. Jane Doe',
    },
  });

  const course2 = await prisma.course.create({
    data: {
      semesterId: semester2.id,
      code: 'IF102',
      name: 'Calculus I',
      credits: 4,
      lecturer: 'Prof. John Smith',
    },
  });

  const course3 = await prisma.course.create({
    data: {
      semesterId: semester2.id,
      code: 'IF103',
      name: 'Basic Physics',
      credits: 3,
      lecturer: 'Dr. Alan Turing',
    },
  });

  console.log('Courses seeded.');

  // 4. Seed Schedules
  await prisma.schedule.createMany({
    data: [
      {
        courseId: course1.id,
        dayOfWeek: 1, // Monday
        startTime: '08:00',
        endTime: '10:30',
        room: 'Room 301',
      },
      {
        courseId: course2.id,
        dayOfWeek: 2, // Tuesday
        startTime: '10:00',
        endTime: '12:00',
        room: 'Room 102',
      },
      {
        courseId: course3.id,
        dayOfWeek: 3, // Wednesday
        startTime: '13:00',
        endTime: '15:30',
        room: 'Lab 1',
      },
    ],
  });

  console.log('Schedules seeded.');

  // 5. Seed Tasks
  const oneWeekFromNow = new Date();
  oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);

  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const twoWeeksFromNow = new Date();
  twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  await prisma.task.createMany({
    data: [
      {
        userId: user.id,
        courseId: course1.id,
        title: 'Read Chapter 1 & 2',
        description: 'Read the introductory chapters on algorithms and complexity.',
        deadline: oneWeekFromNow,
        status: 'PENDING',
        priority: 'MEDIUM',
      },
      {
        userId: user.id,
        courseId: course2.id,
        title: 'Calculus Assignment 1',
        description: 'Solve problems 1 to 15 on limits and continuity.',
        deadline: threeDaysFromNow,
        status: 'IN_PROGRESS',
        priority: 'HIGH',
      },
      {
        userId: user.id,
        courseId: course3.id,
        title: 'Physics Group Lab Report',
        description: 'Submit the group lab report for the pendulum experiment.',
        deadline: twoWeeksFromNow,
        status: 'PENDING',
        priority: 'LOW',
      },
      {
        userId: user.id,
        courseId: null,
        title: 'Complete Academic Registration Profile',
        description: 'Check portal status and upload documents.',
        deadline: yesterday,
        status: 'DONE',
        priority: 'LOW',
      },
    ],
  });

  console.log('Tasks seeded.');

  // 6. Get or create the requested class user: CLASS-WGJO8I
  let classUser = await prisma.user.findUnique({
    where: { classCode: 'CLASS-WGJO8I' },
  });

  if (!classUser) {
    console.log('Creating class user with code CLASS-WGJO8I...');
    const hashedClassPassword = await bcrypt.hash('password123', 10);
    classUser = await prisma.user.create({
      data: {
        email: 'class@example.com',
        name: 'Kelas XII RPL 1',
        password: hashedClassPassword,
        role: 'CLASS',
        classCode: 'CLASS-WGJO8I',
      },
    });
  }

  console.log(`Seeding data for class user: ${classUser.email} (${classUser.id})`);

  // Clean existing tasks and schedules for class user
  await prisma.task.deleteMany({
    where: { userId: classUser.id },
  });

  await prisma.schedule.deleteMany({
    where: {
      course: {
        semester: {
          userId: classUser.id,
        },
      },
    },
  });

  await prisma.course.deleteMany({
    where: {
      semester: {
        userId: classUser.id,
      },
    },
  });

  await prisma.semester.deleteMany({
    where: {
      userId: classUser.id,
    },
  });

  // Seed semesters for class user
  await prisma.semester.createMany({
    data: [
      {
        userId: classUser.id,
        name: 'Semester 1',
        startDate: new Date('2023-09-01'),
        endDate: new Date('2024-01-31'),
        isActive: false,
      },
      {
        userId: classUser.id,
        name: 'Semester 2',
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-06-30'),
        isActive: false,
      },
      {
        userId: classUser.id,
        name: 'Semester 3',
        startDate: new Date('2024-09-01'),
        endDate: new Date('2025-01-31'),
        isActive: false,
      },
      {
        userId: classUser.id,
        name: 'Semester 4',
        startDate: new Date('2025-02-01'),
        endDate: new Date('2025-06-30'),
        isActive: false,
      },
      {
        userId: classUser.id,
        name: 'Semester 5',
        startDate: new Date('2025-09-01'),
        endDate: new Date('2026-01-31'),
        isActive: false,
      },
      {
        userId: classUser.id,
        name: 'Semester 6',
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-06-30'),
        isActive: false,
      },
    ],
  });

  const classSemester = await prisma.semester.create({
    data: {
      userId: classUser.id,
      name: 'Semester 7 (Ganjil 2026/2027)',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-12-31'),
      isActive: true,
    },
  });

  // Seed courses for class user
  const classCourse1 = await prisma.course.create({
    data: {
      semesterId: classSemester.id,
      code: 'RPL301',
      name: 'Pemrograman Web dan Perangkat Bergerak',
      credits: 4,
      lecturer: 'Pak Budi Hartono',
    },
  });

  const classCourse2 = await prisma.course.create({
    data: {
      semesterId: classSemester.id,
      code: 'RPL302',
      name: 'Basis Data Terdistribusi',
      credits: 3,
      lecturer: 'Bu Retno Lestari',
    },
  });

  // Seed schedules for class user
  await prisma.schedule.createMany({
    data: [
      {
        courseId: classCourse1.id,
        dayOfWeek: 1, // Monday
        startTime: '07:30',
        endTime: '11:00',
        room: 'Lab Komputer 2',
      },
      {
        courseId: classCourse2.id,
        dayOfWeek: 3, // Wednesday
        startTime: '09:00',
        endTime: '11:30',
        room: 'Lab Komputer 1',
      },
    ],
  });

  // Seed tasks for class user
  const classTaskDeadline = new Date();
  classTaskDeadline.setDate(classTaskDeadline.getDate() + 5);

  await prisma.task.createMany({
    data: [
      {
        userId: classUser.id,
        courseId: classCourse1.id,
        title: 'Tugas Projek E-Commerce (Next.js)',
        description: 'Buatlah projek aplikasi e-commerce sederhana menggunakan Next.js dan TailwindCSS.',
        deadline: classTaskDeadline,
        status: 'PENDING',
        priority: 'HIGH',
      },
      {
        userId: classUser.id,
        courseId: classCourse2.id,
        title: 'Tugas Praktikum Replication Basis Data',
        description: 'Tulis laporan hasil praktikum konfigurasi replikasi master-slave di PostgreSQL.',
        deadline: classTaskDeadline,
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
      },
    ],
  });

  console.log('Class data seeded.');
  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
