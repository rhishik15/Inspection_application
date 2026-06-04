import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting DB fix...');

  // We can't easily use the Prisma Client if the types are broken,
  // so we'll use raw SQL to fix the existing data.

  try {
    // 1. Update existing statuses to match new ones
    await prisma.$executeRawUnsafe(`UPDATE "Task" SET status = 'DONE' WHERE status = 'APPROVED'`);
    await prisma.$executeRawUnsafe(`UPDATE "Task" SET status = 'ASSIGNED' WHERE status = 'IN_PROGRESS'`);

    console.log('Database records updated.');
  } catch (e) {
    console.error('Error updating records:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
