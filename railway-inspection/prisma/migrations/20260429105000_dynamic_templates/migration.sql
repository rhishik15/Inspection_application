-- Dynamic template builder support.
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE "InspectionTemplate"
ADD COLUMN "status" "TemplateStatus" NOT NULL DEFAULT 'PUBLISHED',
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "sourceTemplateId" TEXT,
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "InspectionTemplate"
SET "publishedAt" = "createdAt"
WHERE "publishedAt" IS NULL;

ALTER TABLE "Section"
ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Item"
ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "required" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "placeholder" TEXT,
ADD COLUMN "unit" TEXT;

ALTER TABLE "Task"
ADD COLUMN "templateId" TEXT;

UPDATE "Task"
SET "templateId" = matched."id"
FROM (
  SELECT DISTINCT ON ("name") "id", "name"
  FROM "InspectionTemplate"
  ORDER BY "name", "createdAt" DESC
) AS matched
WHERE "Task"."inspectionType" = matched."name";

ALTER TABLE "InspectionTemplate"
ADD CONSTRAINT "InspectionTemplate_sourceTemplateId_fkey"
FOREIGN KEY ("sourceTemplateId") REFERENCES "InspectionTemplate"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task"
ADD CONSTRAINT "Task_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
