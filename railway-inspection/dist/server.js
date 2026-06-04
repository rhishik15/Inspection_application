"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApp = buildApp;
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const user_1 = require("./routes/user");
const task_1 = require("./routes/task");
const loco_1 = require("./routes/loco");
const template_1 = require("./routes/template");
const inspection_1 = require("./routes/inspection");
const notification_1 = require("./routes/notification");
const schedule_1 = require("./routes/schedule");
const export_1 = require("./routes/export");
function buildApp() {
    const app = (0, fastify_1.default)({
        logger: true
    });
    // 🔍 GLOBAL REQUEST LOGGER (VERY IMPORTANT FOR DEBUGGING)
    app.addHook("onRequest", async (req) => {
        console.log("👉", req.method, req.url);
    });
    // ✅ CORS FIRST (correct config)
    app.register(cors_1.default, {
        origin: true, // allow all (safe for dev)
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    });
    app.get("/health", async () => ({ ok: true }));
    // ✅ REGISTER ROUTES
    app.register(user_1.userRoutes);
    app.register(loco_1.locoRoutes);
    app.register(task_1.taskRoutes);
    app.register(inspection_1.inspectionRoutes);
    app.register(template_1.templateRoutes);
    app.register(notification_1.notificationRoutes);
    app.register(schedule_1.scheduleRoutes);
    app.register(export_1.exportRoutes);
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
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
};
if (require.main === module) {
    start();
}
//# sourceMappingURL=server.js.map