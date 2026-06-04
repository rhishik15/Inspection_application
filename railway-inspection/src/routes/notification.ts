import { FastifyInstance } from "fastify";
import { requireRole } from "../middleware/role";
import { prisma } from "../plugins/prisma";
import { getActorId } from "../utils/workflow";

export async function notificationRoutes(app: FastifyInstance) {
  app.get("/notifications", { preHandler: requireRole(["ADMIN", "SUPERVISOR", "WORKER"]) }, async (req, reply) => {
    const userId = getActorId(req);
    const { unreadOnly } = req.query as any;

    if (!userId) {
      return reply.status(400).send({ error: "user-id header is required" });
    }

    const where: any = { userId };
    if (unreadOnly === "true") where.read = false;

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
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
      prisma.notification.count({
        where: { userId, read: false }
      })
    ]);

    return { notifications, unreadCount };
  });

  app.post("/notifications/:id/read", { preHandler: requireRole(["ADMIN", "SUPERVISOR", "WORKER"]) }, async (req, reply) => {
    const userId = getActorId(req);
    const { id } = req.params as any;

    if (!userId) {
      return reply.status(400).send({ error: "user-id header is required" });
    }

    const notification = await prisma.notification.findFirst({
      where: { id, userId }
    });

    if (!notification) {
      return reply.status(404).send({ error: "Notification not found" });
    }

    return prisma.notification.update({
      where: { id },
      data: { read: true }
    });
  });

  app.post("/notifications/read-all", { preHandler: requireRole(["ADMIN", "SUPERVISOR", "WORKER"]) }, async (req, reply) => {
    const userId = getActorId(req);

    if (!userId) {
      return reply.status(400).send({ error: "user-id header is required" });
    }

    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true }
    });

    return { success: true };
  });
}
