import { FastifyInstance } from "fastify";
import { requireRole } from "../middleware/role";
import { prisma } from "../plugins/prisma";

function escapeCsv(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsv(headers: string[], rows: unknown[][]) {
  return [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(","))
  ].join("\n");
}

function sendCsv(reply: any, filename: string, headers: string[], rows: unknown[][]) {
  reply
    .header("Content-Type", "text/csv; charset=utf-8")
    .header("Content-Disposition", `attachment; filename="${filename}"`);

  return reply.send(buildCsv(headers, rows));
}

export async function exportRoutes(app: FastifyInstance) {
  app.get("/exports/tasks.csv", { preHandler: requireRole(["ADMIN", "SUPERVISOR"]) }, async (_req, reply) => {
    const tasks = await prisma.task.findMany({
      include: {
        loco: true,
        assignments: { include: { worker: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return sendCsv(reply, "tasks.csv", [
      "Task ID",
      "Loco",
      "Inspection Type",
      "Status",
      "Priority",
      "Assigned Workers",
      "Created At"
    ], tasks.map((task) => [
      task.id,
      task.loco?.locoNumber || "",
      task.inspectionType,
      task.status,
      task.priority,
      task.assignments.map((assignment) => assignment.worker.name).join("; "),
      task.createdAt.toISOString()
    ]));
  });

  app.get("/exports/assignments.csv", { preHandler: requireRole(["ADMIN", "SUPERVISOR"]) }, async (_req, reply) => {
    const assignments = await prisma.taskAssignment.findMany({
      include: {
        worker: true,
        task: {
          include: { loco: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return sendCsv(reply, "assignments.csv", [
      "Assignment ID",
      "Worker",
      "Loco",
      "Inspection Type",
      "Task Status",
      "Assigned At"
    ], assignments.map((assignment) => [
      assignment.id,
      assignment.worker.name,
      assignment.task.loco?.locoNumber || "",
      assignment.task.inspectionType,
      assignment.task.status,
      assignment.createdAt.toISOString()
    ]));
  });

  app.get("/exports/schedules.csv", { preHandler: requireRole(["ADMIN", "SUPERVISOR"]) }, async (_req, reply) => {
    const schedules = await prisma.recurringInspectionSchedule.findMany({
      include: {
        loco: true,
        template: true,
        workers: { include: { worker: true } },
        createdBy: true
      },
      orderBy: { nextRunAt: "asc" }
    });

    return sendCsv(reply, "schedules.csv", [
      "Schedule ID",
      "Loco",
      "Template",
      "Frequency",
      "Priority",
      "Workers",
      "Next Run At",
      "Active",
      "Created By"
    ], schedules.map((schedule) => [
      schedule.id,
      schedule.loco?.locoNumber || "",
      `${schedule.template.name} v${schedule.template.version}`,
      schedule.frequency,
      schedule.priority,
      schedule.workers.map((entry) => entry.worker.name).join("; "),
      schedule.nextRunAt.toISOString(),
      schedule.active ? "Yes" : "No",
      schedule.createdBy?.name || ""
    ]));
  });

  app.get("/exports/loco-history.csv", { preHandler: requireRole(["ADMIN", "SUPERVISOR"]) }, async (req, reply) => {
    const { locoId } = req.query as any;
    const tasks = await prisma.task.findMany({
      where: locoId ? { locoId } : undefined,
      include: {
        loco: true,
        statusEvents: { include: { actor: true } },
        assignmentEvents: { include: { worker: true } },
        inspections: { include: { worker: true, responses: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    const rows = tasks.flatMap((task: any) => {
      const statusRows = task.statusEvents.map((event: any) => [
        task.loco?.locoNumber || "",
        task.id,
        task.inspectionType,
        "STATUS",
        event.status,
        event.actor?.name || "",
        event.note || "",
        event.createdAt.toISOString()
      ]);

      const assignmentRows = task.assignmentEvents.map((event: any) => [
        task.loco?.locoNumber || "",
        task.id,
        task.inspectionType,
        "ASSIGNMENT",
        event.eventType,
        event.worker?.name || "",
        "",
        event.createdAt.toISOString()
      ]);

      const inspectionRows = task.inspections.map((inspection: any) => [
        task.loco?.locoNumber || "",
        task.id,
        task.inspectionType,
        "INSPECTION",
        inspection.submitted ? "SUBMITTED" : "STARTED",
        inspection.worker?.name || "",
        `${inspection.responses.length} responses`,
        inspection.createdAt.toISOString()
      ]);

      return [...statusRows, ...assignmentRows, ...inspectionRows];
    }).sort((a: any[], b: any[]) => new Date(String(b[7])).getTime() - new Date(String(a[7])).getTime());

    return sendCsv(reply, "loco-history.csv", [
      "Loco",
      "Task ID",
      "Inspection Type",
      "Event Type",
      "Status",
      "Actor",
      "Details",
      "Created At"
    ], rows);
  });
}
