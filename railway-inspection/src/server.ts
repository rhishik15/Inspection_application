import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";

import { userRoutes } from "./routes/user";
import { taskRoutes } from "./routes/task";
import { locoRoutes } from "./routes/loco";
import { templateRoutes } from "./routes/template";
import { inspectionRoutes } from "./routes/inspection";
import { notificationRoutes } from "./routes/notification";
import { scheduleRoutes } from "./routes/schedule";
import { exportRoutes } from "./routes/export";

export function buildApp() {
  const app = Fastify({
    logger: true
  });

  // 🔍 GLOBAL REQUEST LOGGER (VERY IMPORTANT FOR DEBUGGING)
  app.addHook("onRequest", async (req) => {
    console.log("👉", req.method, req.url);
  });

  // ✅ CORS FIRST (correct config)
  app.register(cors, {
    origin: true, // allow all (safe for dev)
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  });

  app.get("/health", async () => ({ ok: true }));

  // ✅ REGISTER ROUTES
  app.register(userRoutes);
  app.register(locoRoutes);
  app.register(taskRoutes);
  app.register(inspectionRoutes);
  app.register(templateRoutes);
  app.register(notificationRoutes);
  app.register(scheduleRoutes);
  app.register(exportRoutes);

  return app;
}

const start = async () => {
  const app = buildApp();
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || "0.0.0.0";

  try {
    await app.listen({
      port,
      host
    });

    console.log(`Server running on http://${host}:${port}`);

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}
