"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationRoutes = notificationRoutes;
const role_1 = require("../middleware/role");
const prisma_1 = require("../plugins/prisma");
const workflow_1 = require("../utils/workflow");
async function notificationRoutes(app) {
    app.get("/notifications", { preHandler: (0, role_1.requireRole)(["ADMIN", "SUPERVISOR", "WORKER"]) }, async (req, reply) => {
        const userId = (0, workflow_1.getActorId)(req);
        const { unreadOnly } = req.query;
        if (!userId) {
            return reply.status(400).send({ error: "user-id header is required" });
        }
        const where = { userId };
        if (unreadOnly === "true")
            where.read = false;
        const [notifications, unreadCount] = await Promise.all([
            prisma_1.prisma.notification.findMany({
                where,
                include: {
                    task: {
                        include: { loco: true }
                    },
                    loco: true
                },
                orderBy: { createdAt: "desc" },
                take: 50
            }),
            prisma_1.prisma.notification.count({
                where: { userId, read: false }
            })
        ]);
        return { notifications, unreadCount };
    });
    app.post("/notifications/:id/read", { preHandler: (0, role_1.requireRole)(["ADMIN", "SUPERVISOR", "WORKER"]) }, async (req, reply) => {
        const userId = (0, workflow_1.getActorId)(req);
        const { id } = req.params;
        if (!userId) {
            return reply.status(400).send({ error: "user-id header is required" });
        }
        const notification = await prisma_1.prisma.notification.findFirst({
            where: { id, userId }
        });
        if (!notification) {
            return reply.status(404).send({ error: "Notification not found" });
        }
        return prisma_1.prisma.notification.update({
            where: { id },
            data: { read: true }
        });
    });
    app.post("/notifications/read-all", { preHandler: (0, role_1.requireRole)(["ADMIN", "SUPERVISOR", "WORKER"]) }, async (req, reply) => {
        const userId = (0, workflow_1.getActorId)(req);
        if (!userId) {
            return reply.status(400).send({ error: "user-id header is required" });
        }
        await prisma_1.prisma.notification.updateMany({
            where: { userId, read: false },
            data: { read: true }
        });
        return { success: true };
    });
}
//# sourceMappingURL=notification.js.map