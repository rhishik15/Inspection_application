-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "TaskStatusEvent" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL,
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT,
    "locoId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringInspectionSchedule" (
    "id" TEXT NOT NULL,
    "locoId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "frequency" "RecurrenceFrequency" NOT NULL,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringInspectionSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringScheduleWorker" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,

    CONSTRAINT "RecurringScheduleWorker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskStatusEvent_taskId_createdAt_idx" ON "TaskStatusEvent"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "RecurringInspectionSchedule_active_nextRunAt_idx" ON "RecurringInspectionSchedule"("active", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringScheduleWorker_scheduleId_workerId_key" ON "RecurringScheduleWorker"("scheduleId", "workerId");

-- AddForeignKey
ALTER TABLE "TaskStatusEvent" ADD CONSTRAINT "TaskStatusEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStatusEvent" ADD CONSTRAINT "TaskStatusEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_locoId_fkey" FOREIGN KEY ("locoId") REFERENCES "Loco"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringInspectionSchedule" ADD CONSTRAINT "RecurringInspectionSchedule_locoId_fkey" FOREIGN KEY ("locoId") REFERENCES "Loco"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringInspectionSchedule" ADD CONSTRAINT "RecurringInspectionSchedule_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringInspectionSchedule" ADD CONSTRAINT "RecurringInspectionSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringScheduleWorker" ADD CONSTRAINT "RecurringScheduleWorker_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "RecurringInspectionSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringScheduleWorker" ADD CONSTRAINT "RecurringScheduleWorker_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill a minimal status timeline for existing tasks.
INSERT INTO "TaskStatusEvent" ("id", "taskId", "status", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || "id" || 'created'), "id", 'CREATED', "createdAt"
FROM "Task";

INSERT INTO "TaskStatusEvent" ("id", "taskId", "status", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || "id" || "status"::text), "id", "status", "createdAt" + interval '1 second'
FROM "Task"
WHERE "status" <> 'CREATED';
