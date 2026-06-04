import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../plugins/prisma";
import { requireRole } from "../middleware/role";

const ACTIVE_TEMPLATE_INCLUDE = {
  sections: {
    where: { active: true },
    orderBy: [{ position: "asc" as const }, { id: "asc" as const }],
    include: {
      items: {
        where: { active: true },
        orderBy: [{ position: "asc" as const }, { id: "asc" as const }]
      }
    }
  },
  _count: {
    select: {
      tasks: true,
      inspections: true
    }
  }
};

const ITEM_TYPES = new Set(["text", "number", "boolean", "mcq", "range"]);
const CHOICE_COLORS = new Set(["gray", "green", "yellow", "red", "blue"]);

async function getTemplateWithStructure(id: string) {
  return prisma.inspectionTemplate.findUnique({
    where: { id },
    include: ACTIVE_TEMPLATE_INCLUDE
  });
}

async function getTemplateUsage(templateId: string) {
  const [tasks, inspections] = await Promise.all([
    prisma.task.count({ where: { templateId } }),
    prisma.inspection.count({ where: { templateId } })
  ]);

  return { tasks, inspections, used: tasks + inspections > 0 };
}

async function requireDraftTemplate(templateId: string, reply: any) {
  const template = await prisma.inspectionTemplate.findUnique({
    where: { id: templateId }
  });

  if (!template) {
    reply.status(404).send({ error: "Template not found" });
    return null;
  }

  if (template.status !== "DRAFT") {
    reply.status(409).send({ error: "Only draft templates can be edited" });
    return null;
  }

  return template;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeChoices(type: string, value: unknown) {
  if (type !== "mcq") return { choices: null };
  if (!Array.isArray(value)) {
    return { error: "MCQ items require 2 to 4 choices" };
  }

  const choices = value
    .map((choice, index) => {
      const label = cleanText((choice as any)?.label);
      const rawColor = cleanText((choice as any)?.color).toLowerCase();
      return {
        id: cleanText((choice as any)?.id) || `choice-${index + 1}`,
        label,
        color: CHOICE_COLORS.has(rawColor) ? rawColor : "gray"
      };
    })
    .filter((choice) => choice.label);

  if (choices.length < 2 || choices.length > 4) {
    return { error: "MCQ items require 2 to 4 choices" };
  }

  return { choices };
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeRange(type: string, minValue: unknown, maxValue: unknown) {
  if (type !== "range") return { rangeMin: null, rangeMax: null };

  const rangeMin = normalizeNumber(minValue);
  const rangeMax = normalizeNumber(maxValue);

  if (rangeMin === null || rangeMax === null) {
    return { error: "Range items require numeric min and max values" };
  }

  if (rangeMin > rangeMax) {
    return { error: "Range min cannot be greater than range max" };
  }

  return { rangeMin, rangeMax };
}

export async function templateRoutes(app: FastifyInstance) {

  // CREATE TEMPLATE DRAFT
  app.post("/templates", { preHandler: requireRole(["ADMIN", "SUPERVISOR"]) }, async (req, reply) => {
    const { name } = req.body as any;
    const cleanName = cleanText(name);

    if (!cleanName) {
      return reply.status(400).send({ error: "Name is required" });
    }

    const template = await prisma.inspectionTemplate.create({
      data: {
        name: cleanName,
        status: "DRAFT",
        version: 1
      },
      include: ACTIVE_TEMPLATE_INCLUDE
    });

    return template;
  });

  // GET ALL TEMPLATES
  app.get("/templates", { preHandler: requireRole(["ADMIN", "SUPERVISOR"]) }, async () => {
    return prisma.inspectionTemplate.findMany({
      orderBy: [
        { status: "asc" },
        { name: "asc" },
        { version: "desc" }
      ],
      include: ACTIVE_TEMPLATE_INCLUDE
    });
  });

  // UPDATE TEMPLATE DRAFT
  app.put("/templates/:id", { preHandler: requireRole(["ADMIN", "SUPERVISOR"]) }, async (req, reply) => {
    const { id } = req.params as any;
    const { name } = req.body as any;
    const template = await requireDraftTemplate(id, reply);

    if (!template) return reply;

    const cleanName = cleanText(name);
    if (!cleanName) {
      return reply.status(400).send({ error: "Name is required" });
    }

    return prisma.inspectionTemplate.update({
      where: { id: template.id },
      data: { name: cleanName },
      include: ACTIVE_TEMPLATE_INCLUDE
    });
  });

  // DUPLICATE TEMPLATE INTO AN EDITABLE DRAFT
  app.post("/templates/:id/duplicate", { preHandler: requireRole(["ADMIN", "SUPERVISOR"]) }, async (req, reply) => {
    const { id } = req.params as any;
    const { name } = req.body as any;

    const source = await prisma.inspectionTemplate.findUnique({
      where: { id },
      include: ACTIVE_TEMPLATE_INCLUDE
    });

    if (!source) {
      return reply.status(404).send({ error: "Template not found" });
    }

    const sourceTemplateId = source.sourceTemplateId || source.id;
    const versions = await prisma.inspectionTemplate.findMany({
      where: {
        OR: [
          { id: sourceTemplateId },
          { sourceTemplateId }
        ]
      },
      select: { version: true }
    });
    const nextVersion = Math.max(...versions.map((version) => version.version), 0) + 1;
    const draftName = cleanText(name) || source.name;

    return prisma.inspectionTemplate.create({
      data: {
        name: draftName,
        status: "DRAFT",
        version: nextVersion,
        sourceTemplateId,
        sections: {
          create: source.sections.map((section: any, sectionIndex: number) => ({
            name: section.name,
            position: section.position ?? sectionIndex,
            active: true,
            items: {
              create: section.items.map((item: any, itemIndex: number) => ({
                label: item.label,
                type: item.type,
                position: item.position ?? itemIndex,
                active: true,
                required: item.required ?? true,
                placeholder: item.placeholder ?? null,
                unit: item.unit ?? null,
                rangeMin: item.rangeMin ?? null,
                rangeMax: item.rangeMax ?? null,
                choices: item.choices ?? Prisma.JsonNull
              }))
            }
          }))
        }
      },
      include: ACTIVE_TEMPLATE_INCLUDE
    });
  });

  // PUBLISH A DRAFT TEMPLATE
  app.post("/templates/:id/publish", { preHandler: requireRole(["ADMIN", "SUPERVISOR"]) }, async (req, reply) => {
    const { id } = req.params as any;
    const template = await getTemplateWithStructure(id);

    if (!template) {
      return reply.status(404).send({ error: "Template not found" });
    }

    if (template.status === "PUBLISHED") {
      return template;
    }

    if (template.status !== "DRAFT") {
      return reply.status(409).send({ error: "Only draft templates can be published" });
    }

    const activeItems = template.sections.reduce((count: number, section: any) => count + section.items.length, 0);
    if (template.sections.length === 0 || activeItems === 0) {
      return reply.status(400).send({ error: "Template must contain at least one section and one item before publishing" });
    }

    const publishedAt = new Date();
    await prisma.$transaction([
      prisma.inspectionTemplate.updateMany({
        where: {
          id: { not: template.id },
          name: template.name,
          status: "PUBLISHED"
        },
        data: { status: "ARCHIVED" }
      }),
      prisma.inspectionTemplate.update({
        where: { id: template.id },
        data: {
          status: "PUBLISHED",
          publishedAt
        }
      })
    ]);

    return getTemplateWithStructure(template.id);
  });

  // ARCHIVE USED TEMPLATES, DELETE UNUSED DRAFTS
  app.delete("/templates/:id", { preHandler: requireRole(["ADMIN"]) }, async (req, reply) => {
    const { id } = req.params as any;
    const template = await prisma.inspectionTemplate.findUnique({
      where: { id }
    });

    if (!template) {
      return reply.status(404).send({ error: "Template not found" });
    }

    const usage = await getTemplateUsage(template.id);
    if (usage.used || template.status === "PUBLISHED") {
      return prisma.inspectionTemplate.update({
        where: { id: template.id },
        data: { status: "ARCHIVED" },
        include: ACTIVE_TEMPLATE_INCLUDE
      });
    }

    const sections = await prisma.section.findMany({
      where: { templateId: template.id },
      select: { id: true }
    });

    await prisma.$transaction([
      prisma.item.deleteMany({
        where: { sectionId: { in: sections.map((section) => section.id) } }
      }),
      prisma.section.deleteMany({ where: { templateId: template.id } }),
      prisma.inspectionTemplate.delete({ where: { id: template.id } })
    ]);

    return { success: true };
  });

  // CREATE SECTION
  app.post("/sections", { preHandler: requireRole(["ADMIN", "SUPERVISOR"]) }, async (req, reply) => {
    const { name, templateId, position } = req.body as any;
    const cleanName = cleanText(name);

    if (!cleanName || !templateId) {
      return reply.status(400).send({ error: "name and templateId required" });
    }

    const template = await requireDraftTemplate(templateId, reply);
    if (!template) return reply;

    const nextPosition = typeof position === "number"
      ? position
      : await prisma.section.count({ where: { templateId: template.id, active: true } });

    return prisma.section.create({
      data: {
        name: cleanName,
        templateId: template.id,
        position: nextPosition
      },
      include: {
        items: {
          where: { active: true },
          orderBy: [{ position: "asc" }, { id: "asc" }]
        }
      }
    });
  });

  // UPDATE SECTION
  app.put("/sections/:id", { preHandler: requireRole(["ADMIN", "SUPERVISOR"]) }, async (req, reply) => {
    const { id } = req.params as any;
    const { name, position, active } = req.body as any;

    const section = await prisma.section.findUnique({
      where: { id },
      include: { template: true }
    });

    if (!section) {
      return reply.status(404).send({ error: "Section not found" });
    }

    if (section.template.status !== "DRAFT") {
      return reply.status(409).send({ error: "Only draft template sections can be edited" });
    }

    const data: any = {};
    const cleanName = cleanText(name);
    if (name !== undefined) {
      if (!cleanName) return reply.status(400).send({ error: "Name is required" });
      data.name = cleanName;
    }
    if (typeof position === "number") data.position = position;
    if (typeof active === "boolean") data.active = active;

    return prisma.section.update({
      where: { id },
      data,
      include: {
        items: {
          where: { active: true },
          orderBy: [{ position: "asc" }, { id: "asc" }]
        }
      }
    });
  });

  // REMOVE SECTION
  app.delete("/sections/:id", { preHandler: requireRole(["ADMIN"]) }, async (req, reply) => {
    const { id } = req.params as any;

    const section = await prisma.section.findUnique({
      where: { id },
      include: { template: true }
    });

    if (!section) {
      return reply.status(404).send({ error: "Section not found" });
    }

    if (section.template.status !== "DRAFT" && section.template.status !== "PUBLISHED") {
      return reply.status(409).send({ error: "Only draft or published template sections can be removed" });
    }

    if (section.template.status === "PUBLISHED") {
      await prisma.$transaction([
        prisma.section.update({
          where: { id },
          data: { active: false }
        }),
        prisma.item.updateMany({
          where: { sectionId: id },
          data: { active: false }
        })
      ]);

      return { success: true };
    }

    const usage = await getTemplateUsage(section.templateId);
    if (usage.used) {
      await prisma.$transaction([
        prisma.section.update({
          where: { id },
          data: { active: false }
        }),
        prisma.item.updateMany({
          where: { sectionId: id },
          data: { active: false }
        })
      ]);
    } else {
      await prisma.$transaction([
        prisma.item.deleteMany({ where: { sectionId: id } }),
        prisma.section.delete({ where: { id } })
      ]);
    }

    return { success: true };
  });

  // GET SECTIONS
  app.get("/sections", { preHandler: requireRole(["ADMIN", "SUPERVISOR"]) }, async () => {
    return prisma.section.findMany({
      where: { active: true },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      include: {
        items: {
          where: { active: true },
          orderBy: [{ position: "asc" }, { id: "asc" }]
        }
      }
    });
  });

  // CREATE ITEM
  app.post("/items", { preHandler: requireRole(["ADMIN", "SUPERVISOR"]) }, async (req, reply) => {
    const { label, type, sectionId, position, required, placeholder, unit, rangeMin, rangeMax, choices } = req.body as any;
    const cleanLabel = cleanText(label);
    const cleanType = cleanText(type);

    if (!cleanLabel || !cleanType || !sectionId) {
      return reply.status(400).send({ error: "label, type, sectionId required" });
    }

    if (!ITEM_TYPES.has(cleanType)) {
      return reply.status(400).send({ error: "type must be text, number, boolean, mcq, or range" });
    }

    const normalizedChoices = normalizeChoices(cleanType, choices);
    if (normalizedChoices.error) {
      return reply.status(400).send({ error: normalizedChoices.error });
    }

    const normalizedRange = normalizeRange(cleanType, rangeMin, rangeMax);
    if (normalizedRange.error) {
      return reply.status(400).send({ error: normalizedRange.error });
    }

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: { template: true }
    });

    if (!section) {
      return reply.status(404).send({ error: "Section not found" });
    }

    if (section.template.status !== "DRAFT") {
      return reply.status(409).send({ error: "Only draft template items can be edited" });
    }

    const nextPosition = typeof position === "number"
      ? position
      : await prisma.item.count({ where: { sectionId, active: true } });

    return prisma.item.create({
      data: {
        label: cleanLabel,
        type: cleanType,
        sectionId,
        position: nextPosition,
        required: required !== false,
        placeholder: cleanText(placeholder) || null,
        unit: cleanText(unit) || null,
        rangeMin: normalizedRange.rangeMin,
        rangeMax: normalizedRange.rangeMax,
        choices: normalizedChoices.choices ?? Prisma.JsonNull
      }
    });
  });

  // UPDATE ITEM
  app.put("/items/:id", { preHandler: requireRole(["ADMIN", "SUPERVISOR"]) }, async (req, reply) => {
    const { id } = req.params as any;
    const { label, type, position, active, required, placeholder, unit, rangeMin, rangeMax, choices } = req.body as any;

    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        section: {
          include: { template: true }
        }
      }
    });

    if (!item) {
      return reply.status(404).send({ error: "Item not found" });
    }

    if (item.section.template.status !== "DRAFT") {
      return reply.status(409).send({ error: "Only draft template items can be edited" });
    }

    const data: any = {};
    const cleanLabel = cleanText(label);
    const cleanType = cleanText(type);

    if (label !== undefined) {
      if (!cleanLabel) return reply.status(400).send({ error: "Label is required" });
      data.label = cleanLabel;
    }
    if (type !== undefined) {
      if (!ITEM_TYPES.has(cleanType)) return reply.status(400).send({ error: "type must be text, number, boolean, mcq, or range" });
      data.type = cleanType;
    }
    if (type !== undefined || choices !== undefined) {
      const nextType = data.type ?? item.type;
      const normalizedChoices = normalizeChoices(nextType, choices ?? item.choices);
      if (normalizedChoices.error) return reply.status(400).send({ error: normalizedChoices.error });
      data.choices = normalizedChoices.choices ?? Prisma.JsonNull;
    }
    if (type !== undefined || rangeMin !== undefined || rangeMax !== undefined) {
      const nextType = data.type ?? item.type;
      const normalizedRange = normalizeRange(
        nextType,
        rangeMin ?? item.rangeMin,
        rangeMax ?? item.rangeMax
      );
      if (normalizedRange.error) return reply.status(400).send({ error: normalizedRange.error });
      data.rangeMin = normalizedRange.rangeMin;
      data.rangeMax = normalizedRange.rangeMax;
    }
    if (typeof position === "number") data.position = position;
    if (typeof active === "boolean") data.active = active;
    if (typeof required === "boolean") data.required = required;
    if (placeholder !== undefined) data.placeholder = cleanText(placeholder) || null;
    if (unit !== undefined) data.unit = cleanText(unit) || null;

    return prisma.item.update({
      where: { id },
      data
    });
  });

  // REMOVE ITEM
  app.delete("/items/:id", { preHandler: requireRole(["ADMIN"]) }, async (req, reply) => {
    const { id } = req.params as any;

    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        section: {
          include: { template: true }
        },
        responses: {
          select: { id: true },
          take: 1
        }
      }
    });

    if (!item) {
      return reply.status(404).send({ error: "Item not found" });
    }

    if (item.section.template.status !== "DRAFT") {
      return reply.status(409).send({ error: "Only draft template items can be removed" });
    }

    if (item.responses.length > 0) {
      await prisma.item.update({
        where: { id },
        data: { active: false }
      });
    } else {
      await prisma.item.delete({ where: { id } });
    }

    return { success: true };
  });

  // GET ITEMS
  app.get("/items", { preHandler: requireRole(["ADMIN", "SUPERVISOR"]) }, async () => {
    return prisma.item.findMany({
      where: { active: true },
      orderBy: [{ position: "asc" }, { id: "asc" }]
    });
  });
}
