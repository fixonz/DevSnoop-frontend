import { PrismaClient } from '@prisma/client';

// Prisma Client for Vercel - uses DATABASE_URL from Vercel environment variables
const globalForPrisma = globalThis;

export const prisma = 
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
