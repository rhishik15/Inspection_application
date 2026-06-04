import { FastifyInstance } from "fastify";
import {prisma} from "../plugins/prisma";
import { requireRole } from "../middleware/role";

export async function locoRoutes(app: FastifyInstance) {
    //create loco
    app.post("/locos", { preHandler: requireRole(["ADMIN"]) }, async (req) => {
        const { locoNumber } = req.body as any;

        return prisma.loco.create({
            data : { locoNumber }
        });
    });

    //Get all locos
    app.get("/locos", { preHandler: requireRole(["ADMIN", "SUPERVISOR"]) }, async () => {
        return prisma.loco.findMany();
    });

    app.get("/locos/:id/history", { preHandler: requireRole(["ADMIN", "SUPERVISOR"]) }, async (req, reply) => {
        const { id } = req.params as any;

        const loco = await prisma.loco.findUnique({
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

        const timeline = loco.tasks.flatMap((task: any) => {
            const statusEvents = task.statusEvents.map((event: any) => ({
                id: event.id,
                type: "STATUS",
                taskId: task.id,
                status: event.status,
                title: `Status changed to ${event.status}`,
                description: event.note || task.inspectionType,
                actorName: event.actor?.name || null,
                createdAt: event.createdAt
            }));

            const assignmentEvents = task.assignmentEvents.map((event: any) => ({
                id: event.id,
                type: "ASSIGNMENT",
                taskId: task.id,
                status: event.eventType,
                title: event.eventType === "ASSIGNED" ? "Worker assigned" : "Worker unassigned",
                description: `${event.worker?.name || "Worker"} - ${task.inspectionType}`,
                actorName: event.worker?.name || null,
                createdAt: event.createdAt
            }));

            const inspectionEvents = task.inspections.map((inspection: any) => ({
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
        }).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
