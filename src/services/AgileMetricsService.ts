import { prisma } from '../lib/prisma.js';

export class AgileMetricsService {
  /**
   * 1. Velocity: Tổng story points của các task đã hoàn thành trong Sprint
   */
  static async calculateVelocity(sprintId: string): Promise<number> {
    // Sử dụng aggregate để tính tổng trực tiếp từ database
    const result = await prisma.task.aggregate({
      _sum: {
        storyPoints: true,
      },
      where: {
        sprintId,
        status: 'Done',
      },
    });

    return result._sum.storyPoints || 0;
  }

  /**
   * 2. Cycle Time: Thời gian trung bình từ lúc bắt đầu làm (startedAt) đến khi xong (completedAt)
   * Trả về số ngày trung bình.
   */
  static async calculateCycleTime(sprintId: string): Promise<number> {
    // Lấy các task đã xong và bắt buộc phải có startedAt, completedAt
    const tasks = await prisma.task.findMany({
      where: {
        sprintId,
        status: 'Done',
        startedAt: { not: null },
        completedAt: { not: null },
      },
      select: { startedAt: true, completedAt: true },
    });

    if (tasks.length === 0) return 0;

    // Tính tổng thời gian (milliseconds)
    const totalMs = tasks.reduce((sum, task) => {
      const diff = task.completedAt!.getTime() - task.startedAt!.getTime();
      return sum + Math.max(0, diff); // Đảm bảo không bị âm nếu data lỗi
    }, 0);

    // Chuyển đổi sang số ngày trung bình
    const avgMs = totalMs / tasks.length;
    const avgDays = avgMs / (1000 * 60 * 60 * 24);
    
    return Number(avgDays.toFixed(2));
  }

  /**
   * 3. Lead Time: Thời gian trung bình từ lúc tạo task (createdAt) đến khi xong (completedAt)
   */
  static async calculateLeadTime(sprintId: string): Promise<number> {
    const tasks = await prisma.task.findMany({
      where: {
        sprintId,
        status: 'Done',
        completedAt: { not: null },
      },
      select: { createdAt: true, completedAt: true },
    });

    if (tasks.length === 0) return 0;

    const totalMs = tasks.reduce((sum, task) => {
      const diff = task.completedAt!.getTime() - task.createdAt.getTime();
      return sum + Math.max(0, diff);
    }, 0);

    const avgMs = totalMs / tasks.length;
    const avgDays = avgMs / (1000 * 60 * 60 * 24);
    
    return Number(avgDays.toFixed(2));
  }

  /**
   * 4. Team Productivity: Tổng story points hoàn thành theo từng thành viên
   */
  static async calculateTeamProductivity(sprintId: string) {
    // Sử dụng groupBy để nhóm theo assigneeId và tính tổng story points
    const productivity = await prisma.task.groupBy({
      by: ['assigneeId'],
      _sum: {
        storyPoints: true,
      },
      where: {
        sprintId,
        status: 'Done',
        assigneeId: { not: null }, // Bỏ qua các task không có người nhận
      },
    });

    // Format lại kết quả cho dễ đọc
    return productivity.map((item) => ({
      assigneeId: item.assigneeId,
      totalStoryPoints: item._sum.storyPoints || 0,
    }));
  }

  /**
   * 5. Burndown Data: Tính toán số points còn lại theo từng ngày trong Sprint
   */
  static async getBurndownData(sprintId: string) {
    // 5.1. Lấy tổng số story points của toàn bộ Sprint (tất cả status)
    const totalPointsAgg = await prisma.task.aggregate({
      _sum: { storyPoints: true },
      where: { sprintId },
    });
    const totalPoints = totalPointsAgg._sum.storyPoints || 0;

    // 5.2. Lấy các task đã hoàn thành, sắp xếp theo ngày hoàn thành tăng dần
    const completedTasks = await prisma.task.findMany({
      where: {
        sprintId,
        status: 'Done',
        completedAt: { not: null },
      },
      select: { completedAt: true, storyPoints: true },
      orderBy: { completedAt: 'asc' },
    });

    // 5.3. Nhóm số points hoàn thành theo từng ngày (YYYY-MM-DD)
    const pointsBurnedByDate: Record<string, number> = {};
    for (const task of completedTasks) {
      const dateStr = task.completedAt!.toISOString().split('T')[0];
      pointsBurnedByDate[dateStr] = (pointsBurnedByDate[dateStr] || 0) + task.storyPoints;
    }

    // 5.4. Tính toán số points còn lại (Remaining Points) qua từng ngày
    let currentRemaining = totalPoints;
    const burndownChart = [];
    
    for (const [date, burnedPoints] of Object.entries(pointsBurnedByDate)) {
      currentRemaining -= burnedPoints;
      burndownChart.push({
        date,
        burnedPoints,
        remainingPoints: currentRemaining,
      });
    }

    return {
      totalSprintPoints: totalPoints,
      burndownChart,
    };
  }
}
