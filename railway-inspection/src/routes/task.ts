import { FastifyInstance } from "fastify";
import { prisma } from "../plugins/prisma";
import { requireRole } from "../middleware/role";
import {
  createNotificationsForRoles,
  createNotificationsForUsers,
  createStatusEvent,
  describeTask,
  getActorId
} from "../utils/workflow";

export async function taskRoutes(app: FastifyInstance) {

  // GET ALL TASKS (put this early for clarity)
  app.get("/tasks", { preHandler: requireRole(["ADMIN", "SUPERVISOR", "WORKER"]) }, async () => {
  return prisma.task.findMany({
    include: {
      loco: true,
      template: true,
      assignments: {
        include: { worker: true },
        orderBy: { createdAt: "desc" }
      },
      assignmentEvents: {
        include: { worker: true },
        orderBy: { createdAt: "desc" }
      },
      statusEvents: {
        include: { actor: true },
        orderBy: { createdAt: "desc" }
      },
      inspections: {
        include: {
          responses: {
            include: { item: true }
          },
          worker: true
        }
      }
    }
  });
});

  // GET SINGLE TASK
  app.get("/tasks/:id", { preHandler: requireRole(["ADMIN", "SUPERVISOR", "WORKER"]) }, async (req) => {
    const { id } = req.params as any;

    return prisma.task.findUnique({
      where: { id },
      include: {
        loco: true,
        template: true,
        assignments: {
          include: {
            worker: true
          },
          orderBy: { createdAt: "desc" }
        },
        assignmentEvents: {
          include: {
            worker: true
          },
          orderBy: { createdAt: "desc" }
        },
        statusEvents: {
          include: {
            actor: true
          },
          orderBy: { createdAt: "desc" }
        },
        inspections: {
         include: {
            responses: true,
            worker:true
  }
}
      }
    });
  });

  // CREATE TASK
  app.post(
  "/tasks",
  { preHandler: requireRole(["ADMIN", "SUPERVISOR"]) },
  async (req, reply) => {
    const { locoId, templateId, inspectionType, priority } = req.body as any;
    const actorId = getActorId(req);

    let template = null;

    if (templateId) {
      template = await prisma.inspectionTemplate.findUnique({
        where: { id: templateId }
      });
    } else if (inspectionType) {
      template = await prisma.inspectionTemplate.findFirst({
        where: {
          name: inspectionType,
          status: "PUBLISHED"
        },
        orderBy: { version: "desc" }
      });
    }

    if (!template) {
      return reply.status(400).send({ error: "Published template is required" });
    }

    if (template.status !== "PUBLISHED") {
      return reply.status(400).send({ error: "Only published templates can be assigned to tasks" });
    }

    return prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          locoId,
          templateId: template.id,
          inspectionType: template.name,
          priority: priority || "MEDIUM",
          status: "CREATED"
        }
      });

      await createStatusEvent(tx, task.id, "CREATED", actorId, "Task created");

      return task;
    });
  }
);

  // ASSIGN WORKERS
  app.post(
  "/tasks/assign",
  { preHandler: requireRole(["SUPERVISOR", "ADMIN"]) },
  async (req, reply) => {
    const { taskId, workerIds } = req.body as any;
    const actorId = getActorId(req);

    if (!taskId || !Array.isArray(workerIds)) {
      return reply.status(400).send({ error: "taskId and workerIds are required" });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { loco: true }
    });

    if (!task) {
      return reply.status(404).send({ error: "Task not found" });
    }

    const uniqueWorkerIds = Array.from(new Set(workerIds.filter((workerId: any) => typeof workerId === "string" && workerId)));
    const existingAssignments = await prisma.taskAssignment.findMany({
      where: { taskId }
    });

    const existingWorkerIds = new Set(existingAssignments.map((assignment) => assignment.workerId));
    const requestedWorkerIds = new Set(uniqueWorkerIds);
    const addedWorkerIds = uniqueWorkerIds.filter((workerId) => !existingWorkerIds.has(workerId));
    const removedAssignments = existingAssignments.filter((assignment) => !requestedWorkerIds.has(assignment.workerId));

    await prisma.$transaction(async (tx) => {
      for (const assignment of removedAssignments) {
        await tx.taskAssignment.delete({
          where: { id: assignment.id }
        });
        await tx.taskAssignmentEvent.create({
          data: {
            taskId,
            workerId: assignment.workerId,
            eventType: "UNASSIGNED"
          }
        });
      }

      for (const workerId of addedWorkerIds) {
        await tx.taskAssignment.create({
          data: {
            taskId,
            workerId
          }
        });
        await tx.taskAssignmentEvent.create({
          data: {
            taskId,
            workerId,
            eventType: "ASSIGNED"
          }
        });
      }

      if (task.status === "CREATED" && requestedWorkerIds.size > 0) {
        await tx.task.update({
          where: { id: taskId },
          data: { status: "ASSIGNED" }
        });
        await createStatusEvent(tx, taskId, "ASSIGNED", actorId, "Task assigned to worker(s)");
      }

      if (task.status === "ASSIGNED" && requestedWorkerIds.size === 0) {
        await tx.task.update({
          where: { id: taskId },
          data: { status: "CREATED" }
        });
        await createStatusEvent(tx, taskId, "CREATED", actorId, "All workers removed");
      }

      await createNotificationsForUsers(tx, addedWorkerIds, {
        title: "New inspection assigned",
        message: `${describeTask(task)} has been assigned to you.`,
        type: "TASK_ASSIGNED",
        taskId,
        locoId: task.locoId
      });

      await createNotificationsForUsers(tx, removedAssignments.map((assignment) => assignment.workerId), {
        title: "Inspection unassigned",
        message: `${describeTask(task)} has been removed from your assignments.`,
        type: "TASK_UNASSIGNED",
        taskId,
        locoId: task.locoId
      });
    });

    const assignments = await prisma.taskAssignment.findMany({
      where: { taskId },
      include: { worker: true },
      orderBy: { createdAt: "desc" }
    });

    return assignments;
  }
);

  // MARK TASK AS SUBMITTED
  app.post(
  "/tasks/:id/submit",
  { preHandler: requireRole(["WORKER"]) },
  async (req, reply) => {
    const { id } = req.params as any;
    const actorId = getActorId(req);

    const task = await prisma.task.findUnique({
      where: { id },
      include: { loco: true }
    });

    if (!task) {
      return reply.status(404).send({ error: "Task not found" });
    }

    return prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { id },
        data: {
          status: "SUBMITTED"
        }
      });

      await createStatusEvent(tx, id, "SUBMITTED", actorId, "Inspection submitted");
      await createNotificationsForRoles(tx, ["ADMIN", "SUPERVISOR"], {
        title: "Inspection submitted",
        message: `${describeTask(task)} is ready for review.`,
        type: "TASK_SUBMITTED",
        taskId: id,
        locoId: task.locoId
      });

      return updatedTask;
    });
  }
);

  // APPROVE TASK (Now DONE)
  app.post(
  "/tasks/:id/approve",
  { preHandler: requireRole(["SUPERVISOR", "ADMIN"]) },
  async (req, reply) => {
    const { id } = req.params as any;
    const actorId = getActorId(req);

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        loco: true,
        assignments: true
      }
    });

    if (!task) {
      return reply.status(404).send({ error: "Task not found" });
    }

    return prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { id },
        data: {
          status: "DONE"
        }
      });

      await createStatusEvent(tx, id, "DONE", actorId, "Inspection approved");
      await createNotificationsForUsers(tx, task.assignments.map((assignment) => assignment.workerId), {
        title: "Inspection approved",
        message: `${describeTask(task)} has been approved.`,
        type: "TASK_APPROVED",
        taskId: id,
        locoId: task.locoId
      });

      return updatedTask;
    });
  }
);

  // SEND FOR REWORK
  app.post(
  "/tasks/:id/rework",
  { preHandler: requireRole(["SUPERVISOR", "ADMIN"]) },
  async (req, reply) => {
    const { id } = req.params as any;
    const actorId = getActorId(req);

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        loco: true,
        assignments: true
      }
    });

    if (!task) {
      return reply.status(404).send({ error: "Task not found" });
    }

    return prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { id },
        data: {
          status: "REWORK"
        }
      });

      await createStatusEvent(tx, id, "REWORK", actorId, "Inspection sent for rework");
      await createNotificationsForUsers(tx, task.assignments.map((assignment) => assignment.workerId), {
        title: "Inspection sent for rework",
        message: `${describeTask(task)} needs correction.`,
        type: "TASK_REWORK",
        taskId: id,
        locoId: task.locoId
      });

      return updatedTask;
    });
  }
);
}
