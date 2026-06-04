import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting DB fix v2...');

  try {
    // 1. Add new values to the enum type in PostgreSQL
    // Note: ALTER TYPE ... ADD VALUE cannot be executed inside a transaction block in some PG versions,
    // but Prisma's $executeRaw might wrap it. Let's try.
    // If this fails, we might need to do it differently.

    await prisma.$executeRawUnsafe(`ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'REWORK'`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'DONE'`);

    console.log('Enum values added.');

    // 2. Update existing data
    await prisma.$executeRawUnsafe(`UPDATE "Task" SET status = 'DONE' WHERE status = 'APPROVED'`);
    await prisma.$executeRawUnsafe(`UPDATE "Task" SET status = 'ASSIGNED' WHERE status = 'IN_PROGRESS'`);

    console.log('Database records updated.');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
