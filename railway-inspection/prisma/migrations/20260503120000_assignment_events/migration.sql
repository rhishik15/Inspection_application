CREATE TYPE "AssignmentEventType" AS ENUM ('ASSIGNED', 'UNASSIGNED');

ALTER TABLE "TaskAssignment"
ADD COLUMN "createdAt" TIMESTAMP(3);

UPDATE "TaskAssignment"
SET "createdAt" = "Task"."createdAt"
FROM "Task"
WHERE "TaskAssignment"."taskId" = "Task"."id";

ALTER TABLE "TaskAssignment"
ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "TaskAssignmentEvent" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "eventType" "AssignmentEventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAssignmentEvent_pkey" PRIMARY KEY ("id")
);

INSERT INTO "TaskAssignmentEvent" ("id", "taskId", "workerId", "eventType", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || "id"), "taskId", "workerId", 'ASSIGNED'::"AssignmentEventType", "createdAt"
FROM "TaskAssignment";

ALTER TABLE "TaskAssignmentEvent"
ADD CONSTRAINT "TaskAssignmentEvent_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TaskAssignmentEvent"
ADD CONSTRAINT "TaskAssignmentEvent_workerId_fkey"
FOREIGN KEY ("workerId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
