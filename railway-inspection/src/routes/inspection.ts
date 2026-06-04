import { FastifyInstance } from "fastify";
import { prisma } from "../plugins/prisma";
import { requireRole } from "../middleware/role";

async function findTemplateForTask(task: any) {
  if (task.templateId) {
    return prisma.inspectionTemplate.findUnique({
      where: { id: task.templateId }
    });
  }

  return prisma.inspectionTemplate.findFirst({
    where: {
      name: task.inspectionType,
      status: "PUBLISHED"
    },
    orderBy: { version: "desc" }
  });
}

async function findTemplateWithStructureForTask(task: any) {
  if (task.templateId) {
    return prisma.inspectionTemplate.findUnique({
      where: { id: task.templateId },
      include: {
        sections: {
          where: { active: true },
          orderBy: [{ position: "asc" }, { id: "asc" }],
          include: {
            items: {
              where: { active: true },
              orderBy: [{ position: "asc" }, { id: "asc" }]
            }
          }
        }
      }
    });
  }

  return prisma.inspectionTemplate.findFirst({
    where: {
      name: task.inspectionType,
      status: "PUBLISHED"
    },
    orderBy: { version: "desc" },
    include: {
      sections: {
        where: { active: true },
        orderBy: [{ position: "asc" }, { id: "asc" }],
        include: {
          items: {
            where: { active: true },
            orderBy: [{ position: "asc" }, { id: "asc" }]
          }
        }
      }
    }
  });
}

export async function inspectionRoutes(app: FastifyInstance) {

  // START INSPECTION
  app.post("/inspection/start", { preHandler: requireRole(["WORKER"]) }, async (req, reply) => {
    const { taskId, workerId } = req.body as any;
    console.log("HIT");

    if (!taskId || !workerId) {
      return reply.status(400).send({ error: "taskId and workerId required" });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      return reply.status(404).send({ error: "Task not found" });
    }

    const template = await findTemplateForTask(task);

    if (!template) {
      return reply.status(404).send({ error: "Template not found" });
    }

    const existing = await prisma.inspection.findFirst({
      where: { taskId, workerId }
    });

    if (existing) return existing;

    return prisma.inspection.create({
      data: {
        taskId,
        workerId,
        templateId: template.id
      }
    });
  });

  // SUBMIT INSPECTION
  app.post("/inspection/submit", { preHandler: requireRole(["WORKER"]) }, async (req, reply) => {
    const { inspectionId, responses } = req.body as any;

    if (!inspectionId || !Array.isArray(responses)) {
      return reply.status(400).send({ error: "inspectionId and responses required" });
    }

    const itemIds = responses
      .map((response: any) => response?.itemId)
      .filter((itemId: any) => typeof itemId === "string" && itemId);

    const items = await prisma.item.findMany({
      where: { id: { in: itemIds } },
      select: {
        id: true,
        label: true,
        type: true,
        required: true,
        rangeMin: true,
        rangeMax: true
      }
    });
    const itemById = new Map(items.map((item) => [item.id, item]));

    for (const r of responses) {
      if (!r.itemId || r.value === undefined) continue;
      const item = itemById.get(r.itemId);
      if (!item) {
        return reply.status(400).send({ error: "Invalid inspection response item" });
      }

      const value = String(r.value).trim();
      if (item.required !== false && !value) {
        return reply.status(400).send({ error: `${item.label} is required` });
      }

      if (item.type === "range" && value) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
          return reply.status(400).send({ error: `${item.label} must be a numeric value` });
        }

        if (
          item.rangeMin === null ||
          item.rangeMax === null ||
          numericValue < item.rangeMin ||
          numericValue > item.rangeMax
        ) {
          return reply.status(400).send({ error: `${item.label} must be between ${item.rangeMin} and ${item.rangeMax}` });
        }
      }

      await prisma.inspectionResponse.create({
        data: {
          inspectionId,
          itemId: r.itemId,
          value,
          remark: r.remark ?? null
        }
      });
    }

    await prisma.inspection.update({
      where: { id: inspectionId },
      data: { submitted: true }
    });

    return { success: true };
  });
  
  // GET TEMPLATE FOR TASK
  app.get("/inspection/template/:taskId", { preHandler: requireRole(["ADMIN", "SUPERVISOR", "WORKER"]) }, async (req, reply) => {
    const { taskId } = req.params as any;

    if (!taskId) {
      return reply.status(400).send({ error: "taskId required" });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      return reply.status(404).send({ error: "Task not found" });
    }

    const template = await findTemplateWithStructureForTask(task);

    if (!template) {
      return reply.status(404).send({ error: "Template not found" });
    }

    return template;
  });
  // GET INSPECTION WITH RESPONSES
app.get("/inspection/:inspectionId", { preHandler: requireRole(["ADMIN", "SUPERVISOR", "WORKER"]) }, async (req, reply) => {
  const { inspectionId } = req.params as any;

  if (!inspectionId) {
    return reply.status(400).send({ error: "inspectionId required" });
  }

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: {
      responses: true,
      template: {
        include: {
          sections: {
            include: {
              items: true
            }
          }
        }
      }
    }
  });

  if (!inspection) {
    return reply.status(404).send({ error: "Inspection not found" });
  }

  return inspection;
});
}
