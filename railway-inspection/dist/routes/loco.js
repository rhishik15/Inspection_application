"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.locoRoutes = locoRoutes;
const prisma_1 = require("../plugins/prisma");
const role_1 = require("../middleware/role");
async function locoRoutes(app) {
    //create loco
    app.post("/locos", { preHandler: (0, role_1.requireRole)(["ADMIN"]) }, async (req) => {
        const { locoNumber } = req.body;
        return prisma_1.prisma.loco.create({
            data: { locoNumber }
        });
    });
    //Get all locos
    app.get("/locos", { preHandler: (0, role_1.requireRole)(["ADMIN", "SUPERVISOR"]) }, async () => {
        return prisma_1.prisma.loco.findMany();
    });
    app.get("/locos/:id/history", { preHandler: (0, role_1.requireRole)(["ADMIN", "SUPERVISOR"]) }, async (req, reply) => {
        const { id } = req.params;
        const loco = await prisma_1.prisma.loco.findUnique({
            where: { id },
            include: {
                tasks: {
                    include: {
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
                                worker: true,
                                responses: {
                                    include: { item: true }
                                }
                            },
                            orderBy: { createdAt: "desc" }
                        }
                    },
                    orderBy: { createdAt: "desc" }
                }
            }
        });
        if (!loco) {
            return reply.status(404).send({ error: "Loco not found" });
        }
        const timeline = loco.tasks.flatMap((task) => {
            const statusEvents = task.statusEvents.map((event) => ({
                id: event.id,
                type: "STATUS",
                taskId: task.id,
                status: event.status,
                title: `Status changed to ${event.status}`,
                description: event.note || task.inspectionType,
                actorName: event.actor?.name || null,
                createdAt: event.createdAt
            }));
            const assignmentEvents = task.assignmentEvents.map((event) => ({
                id: event.id,
                type: "ASSIGNMENT",
                taskId: task.id,
                status: event.eventType,
                title: event.eventType === "ASSIGNED" ? "Worker assigned" : "Worker unassigned",
                description: `${event.worker?.name || "Worker"} - ${task.inspectionType}`,
                actorName: event.worker?.name || null,
                createdAt: event.createdAt
            }));
            const inspectionEvents = task.inspections.map((inspection) => ({
                id: inspection.id,
                type: "INSPECTION",
                taskId: task.id,
                status: inspection.submitted ? "SUBMITTED" : "STARTED",
                title: inspection.submitted ? "Inspection submitted" : "Inspection started",
                description: `${inspection.worker?.name || "Worker"} - ${task.inspectionType}`,
                actorName: inspection.worker?.name || null,
                responseCount: inspection.responses.length,
                createdAt: inspection.createdAt
            }));
            return [...statusEvents, ...assignmentEvents, ...inspectionEvents];
        }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return {
            loco: {
                id: loco.id,
                locoNumber: loco.locoNumber,
                createdAt: loco.createdAt
            },
            tasks: loco.tasks,
            timeline
        };
    });
}
//# sourceMappingURL=loco.js.map