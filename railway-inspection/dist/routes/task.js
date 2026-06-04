"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskRoutes = taskRoutes;
const prisma_1 = require("../plugins/prisma");
const role_1 = require("../middleware/role");
const workflow_1 = require("../utils/workflow");
async function taskRoutes(app) {
    // GET ALL TASKS (put this early for clarity)
    app.get("/tasks", { preHandler: (0, role_1.requireRole)(["ADMIN", "SUPERVISOR", "WORKER"]) }, async () => {
        return prisma_1.prisma.task.findMany({
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
    app.get("/tasks/:id", { preHandler: (0, role_1.requireRole)(["ADMIN", "SUPERVISOR", "WORKER"]) }, async (req) => {
        const { id } = req.params;
        return prisma_1.prisma.task.findUnique({
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
                        worker: true
                    }
                }
            }
        });
    });
    // CREATE TASK
    app.post("/tasks", { preHandler: (0, role_1.requireRole)(["ADMIN", "SUPERVISOR"]) }, async (req, reply) => {
        const { locoId, templateId, inspectionType, priority } = req.body;
        const actorId = (0, workflow_1.getActorId)(req);
        let template = null;
        if (templateId) {
            template = await prisma_1.prisma.inspectionTemplate.findUnique({
                where: { id: templateId }
            });
        }
        else if (inspectionType) {
            template = await prisma_1.prisma.inspectionTemplate.findFirst({
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
        return prisma_1.prisma.$transaction(async (tx) => {
            const task = await tx.task.create({
                data: {
                    locoId,
                    templateId: template.id,
                    inspectionType: template.name,
                    priority: priority || "MEDIUM",
                    status: "CREATED"
                }
            });
            await (0, workflow_1.createStatusEvent)(tx, task.id, "CREATED", actorId, "Task created");
            return task;
        });
    });
    // ASSIGN WORKERS
    app.post("/tasks/assign", { preHandler: (0, role_1.requireRole)(["SUPERVISOR", "ADMIN"]) }, async (req, reply) => {
        const { taskId, workerIds } = req.body;
        const actorId = (0, workflow_1.getActorId)(req);
        if (!taskId || !Array.isArray(workerIds)) {
            return reply.status(400).send({ error: "taskId and workerIds are required" });
        }
        const task = await prisma_1.prisma.task.findUnique({
            where: { id: taskId },
            include: { loco: true }
        });
        if (!task) {
            return reply.status(404).send({ error: "Task not found" });
        }
        const uniqueWorkerIds = Array.from(new Set(workerIds.filter((workerId) => typeof workerId === "string" && workerId)));
        const existingAssignments = await prisma_1.prisma.taskAssignment.findMany({
            where: { taskId }
        });
        const existingWorkerIds = new Set(existingAssignments.map((assignment) => assignment.workerId));
        const requestedWorkerIds = new Set(uniqueWorkerIds);
        const addedWorkerIds = uniqueWorkerIds.filter((workerId) => !existingWorkerIds.has(workerId));
        const removedAssignments = existingAssignments.filter((assignment) => !requestedWorkerIds.has(assignment.workerId));
        await prisma_1.prisma.$transaction(async (tx) => {
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
                await (0, workflow_1.createStatusEvent)(tx, taskId, "ASSIGNED", actorId, "Task assigned to worker(s)");
            }
            if (task.status === "ASSIGNED" && requestedWorkerIds.size === 0) {
                await tx.task.update({
                    where: { id: taskId },
                    data: { status: "CREATED" }
                });
                await (0, workflow_1.createStatusEvent)(tx, taskId, "CREATED", actorId, "All workers removed");
            }
            await (0, workflow_1.createNotificationsForUsers)(tx, addedWorkerIds, {
                title: "New inspection assigned",
                message: `${(0, workflow_1.describeTask)(task)} has been assigned to you.`,
                type: "TASK_ASSIGNED",
                taskId,
                locoId: task.locoId
            });
            await (0, workflow_1.createNotificationsForUsers)(tx, removedAssignments.map((assignment) => assignment.workerId), {
                title: "Inspection unassigned",
                message: `${(0, workflow_1.describeTask)(task)} has been removed from your assignments.`,
                type: "TASK_UNASSIGNED",
                taskId,
                locoId: task.locoId
            });
        });
        const assignments = await prisma_1.prisma.taskAssignment.findMany({
            where: { taskId },
            include: { worker: true },
            orderBy: { createdAt: "desc" }
        });
        return assignments;
    });
    // MARK TASK AS SUBMITTED
    app.post("/tasks/:id/submit", { preHandler: (0, role_1.requireRole)(["WORKER"]) }, async (req, reply) => {
        const { id } = req.params;
        const actorId = (0, workflow_1.getActorId)(req);
        const task = await prisma_1.prisma.task.findUnique({
            where: { id },
            include: { loco: true }
        });
        if (!task) {
            return reply.status(404).send({ error: "Task not found" });
        }
        return prisma_1.prisma.$transaction(async (tx) => {
            const updatedTask = await tx.task.update({
                where: { id },
                data: {
                    status: "SUBMITTED"
                }
            });
            await (0, workflow_1.createStatusEvent)(tx, id, "SUBMITTED", actorId, "Inspection submitted");
            await (0, workflow_1.createNotificationsForRoles)(tx, ["ADMIN", "SUPERVISOR"], {
                title: "Inspection submitted",
                message: `${(0, workflow_1.describeTask)(task)} is ready for review.`,
                type: "TASK_SUBMITTED",
                taskId: id,
                locoId: task.locoId
            });
            return updatedTask;
        });
    });
    // APPROVE TASK (Now DONE)
    app.post("/tasks/:id/approve", { preHandler: (0, role_1.requireRole)(["SUPERVISOR", "ADMIN"]) }, async (req, reply) => {
        const { id } = req.params;
        const actorId = (0, workflow_1.getActorId)(req);
        const task = await prisma_1.prisma.task.findUnique({
            where: { id },
            include: {
                loco: true,
                assignments: true
            }
        });
        if (!task) {
            return reply.status(404).send({ error: "Task not found" });
        }
        return prisma_1.prisma.$transaction(async (tx) => {
            const updatedTask = await tx.task.update({
                where: { id },
                data: {
                    status: "DONE"
                }
            });
            await (0, workflow_1.createStatusEvent)(tx, id, "DONE", actorId, "Inspection approved");
            await (0, workflow_1.createNotificationsForUsers)(tx, task.assignments.map((assignment) => assignment.workerId), {
                title: "Inspection approved",
                message: `${(0, workflow_1.describeTask)(task)} has been approved.`,
                type: "TASK_APPROVED",
                taskId: id,
                locoId: task.locoId
            });
            return updatedTask;
        });
    });
    // SEND FOR REWORK
    app.post("/tasks/:id/rework", { preHandler: (0, role_1.requireRole)(["SUPERVISOR", "ADMIN"]) }, async (req, reply) => {
        const { id } = req.params;
        const actorId = (0, workflow_1.getActorId)(req);
        const task = await prisma_1.prisma.task.findUnique({
            where: { id },
            include: {
                loco: true,
                assignments: true
            }
        });
        if (!task) {
            return reply.status(404).send({ error: "Task not found" });
        }
        return prisma_1.prisma.$transaction(async (tx) => {
            const updatedTask = await tx.task.update({
                where: { id },
                data: {
                    status: "REWORK"
                }
            });
            await (0, workflow_1.createStatusEvent)(tx, id, "REWORK", actorId, "Inspection sent for rework");
            await (0, workflow_1.createNotificationsForUsers)(tx, task.assignments.map((assignment) => assignment.workerId), {
                title: "Inspection sent for rework",
                message: `${(0, workflow_1.describeTask)(task)} needs correction.`,
                type: "TASK_REWORK",
                taskId: id,
                locoId: task.locoId
            });
            return updatedTask;
        });
    });
}
//# sourceMappingURL=task.js.map