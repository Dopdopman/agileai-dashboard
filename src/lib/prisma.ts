import { PrismaClient } from '@prisma/client';

// Khởi tạo Prisma Client (Sử dụng global pattern để tránh tạo nhiều instance trong dev)
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
