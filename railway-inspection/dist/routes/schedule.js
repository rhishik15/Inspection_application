"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleRoutes = scheduleRoutes;
const role_1 = require("../middleware/role");
const prisma_1 = require("../plugins/prisma");
const workflow_1 = require("../utils/workflow");
const SCHEDULE_INCLUDE = {
    loco: true,
    template: true,
    createdBy: true,
    workers: {
        include: { worker: true }
    }
};
function addFrequency(date, frequency) {
    const next = new Date(date);
    if (frequency === "DAILY")
        next.setDate(next.getDate() + 1);
    if (frequency === "WEEKLY")
        next.setDate(next.getDate() + 7);
    if (frequency === "MONTHLY")
        next.setMonth(next.getMonth() + 1);
    return next;
}
async function scheduleRoutes(app) {
    app.get("/schedules", { preHandler: (0, role_1.requireRole)(["ADMIN", "SUPERVISOR"]) }, async () => {
        return prisma_1.prisma.recurringInspectionSchedule.findMany({
            include: SCHEDULE_INCLUDE,
            orderBy: [
                { active: "desc" },
                { nextRunAt: "asc" }
            ]
        });
    });
    app.post("/schedules", { preHandler: (0, role_1.requireRole)(["ADMIN", "SUPERVISOR"]) }, async (req, reply) => {
        const { locoId, templateId, priority, frequency, nextRunAt, workerIds } = req.body;
        const actorId = (0, workflow_1.getActorId)(req);
        if (!locoId || !templateId || !frequency || !nextRunAt || !Array.isArray(workerIds) || workerIds.length === 0) {
            return reply.status(400).send({ error: "locoId, templateId, frequency, nextRunAt, and workerIds are required" });
        }
        if (!["DAILY", "WEEKLY", "MONTHLY"].includes(frequency)) {
            return reply.status(400).send({ error: "frequency must be DAILY, WEEKLY, or MONTHLY" });
        }
        const nextRunDate = new Date(nextRunAt);
        if (Number.isNaN(nextRunDate.getTime())) {
            return reply.status(400).send({ error: "nextRunAt must be a valid date" });
        }
        const template = await prisma_1.prisma.inspectionTemplate.findUnique({
            where: { id: templateId }
        });
        if (!template || template.status !== "PUBLISHED") {
            return reply.status(400).send({ error: "Published template is required" });
        }
        const uniqueWorkerIds = Array.from(new Set(workerIds.filter((workerId) => typeof workerId === "string" && workerId)));
        return prisma_1.prisma.recurringInspectionSchedule.create({
            data: {
                locoId,
                templateId,
                priority: priority || "MEDIUM",
                frequency,
                nextRunAt: nextRunDate,
                createdById: actorId,
                workers: {
                    create: uniqueWorkerIds.map((workerId) => ({ workerId }))
                }
            },
            include: SCHEDULE_INCLUDE
        });
    });
    app.post("/schedules/:id/deactivate", { preHandler: (0, role_1.requireRole)(["ADMIN", "SUPERVISOR"]) }, async (req, reply) => {
        const { id } = req.params;
        const schedule = await prisma_1.prisma.recurringInspectionSchedule.findUnique({
            where: { id }
        });
        if (!schedule) {
            return reply.status(404).send({ error: "Schedule not found" });
        }
        return prisma_1.prisma.recurringInspectionSchedule.update({
            where: { id },
            data: { active: false },
            include: SCHEDULE_INCLUDE
        });
    });
    app.post("/schedules/generate-due", { preHandler: (0, role_1.requireRole)(["ADMIN", "SUPERVISOR"]) }, async (req) => {
        const actorId = (0, workflow_1.getActorId)(req);
        const now = new Date();
        const dueSchedules = await prisma_1.prisma.recurringInspectionSchedule.findMany({
            where: {
                active: true,
                nextRunAt: { lte: now }
            },
            include: SCHEDULE_INCLUDE
        });
        const generated = [];
        for (const schedule of dueSchedules) {
            const workerIds = schedule.workers.map((entry) => entry.workerId);
            const task = await prisma_1.prisma.$transaction(async (tx) => {
                const createdTask = await tx.task.create({
                    data: {
                        locoId: schedule.locoId,
                        templateId: schedule.templateId,
                        inspectionType: schedule.template.name,
                        priority: schedule.priority,
                        status: workerIds.length > 0 ? "ASSIGNED" : "CREATED"
                    },
                    include: { loco: true }
                });
                await (0, workflow_1.createStatusEvent)(tx, createdTask.id, "CREATED", actorId, `Generated from ${schedule.frequency.toLowerCase()} schedule`);
                if (workerIds.length > 0) {
                    await (0, workflow_1.createStatusEvent)(tx, createdTask.id, "ASSIGNED", actorId, "Generated task assigned to scheduled workers");
                }
                for (const workerId of workerIds) {
                    await tx.taskAssignment.create({
                        data: {
                            taskId: createdTask.id,
                            workerId
                        }
                    });
                    await tx.taskAssignmentEvent.create({
                        data: {
                            taskId: createdTask.id,
                            workerId,
                            eventType: "ASSIGNED"
                        }
                    });
                }
                await (0, workflow_1.createNotificationsForUsers)(tx, workerIds, {
                    title: "Scheduled inspection assigned",
                    message: `${(0, workflow_1.describeTask)(createdTask)} was generated from a recurring schedule.`,
                    type: "SCHEDULE_GENERATED",
                    taskId: createdTask.id,
                    locoId: createdTask.locoId
                });
                await (0, workflow_1.createNotificationsForRoles)(tx, ["ADMIN", "SUPERVISOR"], {
                    title: "Due inspection generated",
                    message: `${(0, workflow_1.describeTask)(createdTask)} was generated from a recurring schedule.`,
                    type: "SCHEDULE_GENERATED",
                    taskId: createdTask.id,
                    locoId: createdTask.locoId
                });
                await tx.recurringInspectionSchedule.update({
                    where: { id: schedule.id },
                    data: {
                        nextRunAt: addFrequency(schedule.nextRunAt, schedule.frequency)
                    }
                });
                return createdTask;
            });
            generated.push(task);
        }
        return { generatedCount: generated.length, tasks: generated };
    });
}
//# sourceMappingURL=schedule.js.map