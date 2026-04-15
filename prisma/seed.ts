import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu dọn dẹp dữ liệu cũ...');
  await prisma.task.deleteMany();
  await prisma.sprint.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  console.log('Đang tạo Users...');
  const users = await Promise.all([
    prisma.user.create({ data: { name: 'Alice', email: 'alice@example.com', role: 'Developer' } }),
    prisma.user.create({ data: { name: 'Bob', email: 'bob@example.com', role: 'Developer' } }),
    prisma.user.create({ data: { name: 'Charlie', email: 'charlie@example.com', role: 'Developer' } }),
  ]);

  console.log('Đang tạo Project...');
  const project = await prisma.project.create({
    data: { name: 'Agile Dashboard Project', description: 'Dự án xây dựng hệ thống đo lường Agile' },
  });

  console.log('Đang tạo Sprint...');
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const sprint = await prisma.sprint.create({
    data: {
      name: 'Sprint 1',
      startDate: oneWeekAgo,
      endDate: oneWeekFromNow,
      projectId: project.id,
    },
  });

  console.log('Đang tạo 20 Tasks...');
  const fibonacci = [1, 2, 3, 5]; // Story points phổ biến

  // 1. Tạo 5 tasks 'To Do'
  for (let i = 1; i <= 5; i++) {
    await prisma.task.create({
      data: {
        title: `Thiết kế UI/UX cho tính năng ${i}`,
        status: 'To Do',
        storyPoints: fibonacci[Math.floor(Math.random() * fibonacci.length)],
        projectId: project.id,
        sprintId: sprint.id,
        assigneeId: users[Math.floor(Math.random() * users.length)].id,
        createdAt: oneWeekAgo,
      }
    });
  }

  // 2. Tạo 5 tasks 'In Progress'
  for (let i = 1; i <= 5; i++) {
    // Bắt đầu làm vào khoảng 1-3 ngày sau khi Sprint bắt đầu
    const startedAt = new Date(oneWeekAgo.getTime() + (1 + Math.random() * 2) * 24 * 60 * 60 * 1000); 
    
    await prisma.task.create({
      data: {
        title: `Phát triển API endpoint ${i}`,
        status: 'In Progress',
        storyPoints: fibonacci[Math.floor(Math.random() * fibonacci.length)],
        projectId: project.id,
        sprintId: sprint.id,
        assigneeId: users[Math.floor(Math.random() * users.length)].id,
        createdAt: oneWeekAgo,
        startedAt: startedAt,
      }
    });
  }

  // 3. Tạo 10 tasks 'Done'
  for (let i = 1; i <= 10; i++) {
    // Bắt đầu làm vào khoảng 0-3 ngày sau khi Sprint bắt đầu
    const startedAt = new Date(oneWeekAgo.getTime() + Math.random() * 3 * 24 * 60 * 60 * 1000); 
    // Hoàn thành sau khi bắt đầu khoảng 1-4 ngày (nhưng phải trước hiện tại)
    const completedAt = new Date(startedAt.getTime() + (1 + Math.random() * 3) * 24 * 60 * 60 * 1000);
    
    await prisma.task.create({
      data: {
        title: `Hoàn thành Component ${i}`,
        status: 'Done',
        storyPoints: fibonacci[Math.floor(Math.random() * fibonacci.length)],
        projectId: project.id,
        sprintId: sprint.id,
        assigneeId: users[Math.floor(Math.random() * users.length)].id,
        createdAt: oneWeekAgo,
        startedAt: startedAt,
        completedAt: completedAt,
      }
    });
  }

  console.log('✅ Seed data thành công! Đã tạo 3 Users, 1 Project, 1 Sprint và 20 Tasks.');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi seed data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
