import { FastifyInstance } from "fastify";
import { prisma } from "../plugins/prisma";
import { requireRole } from "../middleware/role";

export async function userRoutes(app: FastifyInstance) {

  // 🔹 helper to generate dummy email
  const generateEmail = (name: string) => {
    return `${name.replace(/\s+/g, "").toLowerCase()}@temp.com`;
  };

  // 🔹 allowed roles (basic guard)
  const validRoles = ["ADMIN", "SUPERVISOR", "WORKER"];

  const cleanText = (value: unknown) => typeof value === "string" ? value.trim() : "";

  // ✅ Create User
  app.post("/users", { preHandler: requireRole(["ADMIN"]) }, async (req, reply) => {
    try {
      const { name, role, department } = req.body as any;
      const cleanName = cleanText(name);
      const cleanDepartment = cleanText(department);

      if (!cleanName || !role) {
        return reply.status(400).send({ error: "Name and role required" });
      }

      if (!validRoles.includes(role)) {
        return reply.status(400).send({ error: "Invalid role" });
      }

      const existing = await prisma.user.findFirst({
        where: {
          name: {
            equals: cleanName,
            mode: "insensitive"
          }
        }
      });

      if (existing) {
        return reply.status(400).send({ error: "User already exists" });
      }

      const user = await prisma.user.create({
        data: {
          name: cleanName,
          role,
          email: generateEmail(cleanName),
          department: cleanDepartment || null
        }
      });

      return user;

    } catch (err) {
      console.error(err);
      return reply.status(500).send({ error: "Failed to create user" });
    }
  });

  // ✅ Get all users
  app.get("/users", { preHandler: requireRole(["ADMIN", "SUPERVISOR"]) }, async (req, reply) => {
    try {
      const users = await prisma.user.findMany();
      return users;
    } catch (err) {
      console.error(err);
      return reply.status(500).send({ error: "Failed to fetch users" });
    }
  });

  // ✅ Update User Master details
  app.put("/users/:id", { preHandler: requireRole(["ADMIN"]) }, async (req, reply) => {
    try {
      const { id } = req.params as any;
      const { department } = req.body as any;

      if (!id) {
        return reply.status(400).send({ error: "User id required" });
      }

      if (department !== undefined && typeof department !== "string") {
        return reply.status(400).send({ error: "Department must be text" });
      }

      const existing = await prisma.user.findUnique({
        where: { id }
      });

      if (!existing) {
        return reply.status(404).send({ error: "User not found" });
      }

      return prisma.user.update({
        where: { id },
        data: {
          department: cleanText(department) || null
        }
      });
    } catch (err) {
      console.error(err);
      return reply.status(500).send({ error: "Failed to update user" });
    }
  });

  app.get("/workers/:workerId/analytics", { preHandler: requireRole(["ADMIN", "SUPERVISOR", "WORKER"]) }, async (req, reply) => {
    try {
      const { workerId } = req.params as any;

      if (!workerId) {
        return reply.status(400).send({ error: "workerId is required" });
      }

      const worker = await prisma.user.findUnique({
        where: { id: workerId }
      });

      if (!worker || worker.role !== "WORKER") {
        return reply.status(404).send({ error: "Worker not found" });
      }

      const tasks = await prisma.task.findMany({
        where: {
          OR: [
            {
              assignments: {
                some: { workerId }
              }
            },
            {
              assignmentEvents: {
                some: {
                  workerId,
                  eventType: "ASSIGNED"
                }
              }
            }
          ]
        },
        include: {
          loco: true,
          assignments: {
            where: { workerId },
            orderBy: { createdAt: "desc" }
          },
          assignmentEvents: {
            where: { workerId },
            orderBy: { createdAt: "desc" }
          },
          inspections: {
            where: { workerId },
            orderBy: { createdAt: "desc" }
          }
        },
        orderBy: { createdAt: "desc" }
      });

      const currentTasks = tasks.filter((task) => task.assignments.length > 0);
      const statusCounts = {
        CREATED: 0,
        ASSIGNED: 0,
        REWORK: 0,
        SUBMITTED: 0,
        DONE: 0
      };
      const priorityCounts = {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        URGENT: 0
      };

      tasks.forEach((task) => {
        statusCounts[task.status] += 1;
        priorityCounts[task.priority] += 1;
      });

      const now = Date.now();
      const activeAssignmentTimes = currentTasks
        .map((task) => task.assignments[0]?.createdAt)
        .filter((createdAt): createdAt is Date => !!createdAt)
        .map((createdAt) => createdAt.getTime())
        .sort((a, b) => b - a);

      const averageActiveAssignmentAgeHours = activeAssignmentTimes.length
        ? activeAssignmentTimes.reduce((sum, createdAt) => sum + (now - createdAt), 0) / activeAssignmentTimes.length / 36e5
        : null;

      const recentEvents = tasks
        .flatMap((task) =>
          task.assignmentEvents.map((event) => ({
            id: event.id,
            taskId: task.id,
            locoNumber: task.loco?.locoNumber || null,
            inspectionType: task.inspectionType,
            eventType: event.eventType,
            createdAt: event.createdAt
          }))
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 8);

      const reworkTasks = statusCounts.REWORK;
      const reworkRate = tasks.length ? Math.round((reworkTasks / tasks.length) * 100) : 0;

      return {
        worker: {
          id: worker.id,
          name: worker.name
        },
        summary: {
          totalHistoricalTasks: tasks.length,
          currentActiveTasks: currentTasks.length,
          doneTasks: statusCounts.DONE,
          submittedTasks: statusCounts.SUBMITTED,
          reworkTasks,
          reworkRate
        },
        statusCounts,
        priorityCounts,
        assignmentAge: {
          newestActiveAssignedAt: activeAssignmentTimes[0] ? new Date(activeAssignmentTimes[0]) : null,
          oldestActiveAssignedAt: activeAssignmentTimes[activeAssignmentTimes.length - 1]
            ? new Date(activeAssignmentTimes[activeAssignmentTimes.length - 1])
            : null,
          averageActiveAssignmentAgeHours
        },
        recentEvents,
        currentTasks: currentTasks.map((task) => ({
          id: task.id,
          locoNumber: task.loco?.locoNumber || null,
          inspectionType: task.inspectionType,
          status: task.status,
          priority: task.priority,
          assignedAt: task.assignments[0]?.createdAt || null,
          latestInspectionAt: task.inspections[0]?.createdAt || null
        }))
      };
    } catch (err) {
      console.error(err);
      return reply.status(500).send({ error: "Failed to fetch worker analytics" });
    }
  });

  // ✅ Login (by name)
  app.post("/login", async (req, reply) => {
    try {
      const { name } = req.body as any;
      const cleanName = typeof name === "string" ? name.trim() : "";

      if (!cleanName) {
        return reply.status(400).send({ error: "Name required" });
      }

      const roleAlias = validRoles.find((role) => role.toLowerCase() === cleanName.toLowerCase());
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            {
              name: {
                equals: cleanName,
                mode: "insensitive"
              }
            },
            ...(roleAlias ? [{ role: roleAlias as any }] : [])
          ]
        },
        orderBy: { createdAt: "asc" }
      });

      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }

      return user;

    } catch (err) {
      console.error(err);
      return reply.status(500).send({ error: "Login failed" });
    }
  });

  // ✅ Register
  app.post("/register", async (req, reply) => {
    try {
      const { name, role } = req.body as any;

      if (!name || !role) {
        return reply.status(400).send({ error: "Name and role required" });
      }

      if (!validRoles.includes(role)) {
        return reply.status(400).send({ error: "Invalid role" });
      }

      const headerRole = req.headers["role"];
      const requesterRole = Array.isArray(headerRole) ? headerRole[0] : headerRole;
      const normalizedRequesterRole = typeof requesterRole === "string" ? requesterRole.toUpperCase() : "";

      if (role !== "WORKER" && normalizedRequesterRole !== "ADMIN") {
        return reply.status(403).send({ error: "Access denied" });
      }

      const existing = await prisma.user.findFirst({
        where: { name }
      });

      if (existing) {
        return reply.status(400).send({ error: "User already exists" });
      }

      const user = await prisma.user.create({
        data: {
          name,
          role,
          email: generateEmail(name)
        }
      });

      return user;

    } catch (err) {
      console.error(err);
      return reply.status(500).send({ error: "Registration failed" });
    }
  });
}
