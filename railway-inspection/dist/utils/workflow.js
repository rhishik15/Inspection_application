"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActorId = getActorId;
exports.createStatusEvent = createStatusEvent;
exports.createNotificationsForUsers = createNotificationsForUsers;
exports.createNotificationsForRoles = createNotificationsForRoles;
exports.describeTask = describeTask;
function getActorId(req) {
    const headerValue = req.headers["user-id"];
    const actorId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    return typeof actorId === "string" && actorId ? actorId : null;
}
async function createStatusEvent(client, taskId, status, actorId, note) {
    return client.taskStatusEvent.create({
        data: {
            taskId,
            status,
            actorId: actorId || null,
            note: note || null
        }
    });
}
async function createNotificationsForUsers(client, userIds, notification) {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueUserIds.length === 0)
        return;
    await client.notification.createMany({
        data: uniqueUserIds.map((userId) => ({
            userId,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            taskId: notification.taskId || null,
            locoId: notification.locoId || null
        }))
    });
}
async function createNotificationsForRoles(client, roles, notification) {
    const users = await client.user.findMany({
        where: {
            role: {
                in: roles
            }
        },
        select: { id: true }
    });
    await createNotificationsForUsers(client, users.map((user) => user.id), notification);
}
function describeTask(task) {
    const locoNumber = task?.loco?.locoNumber || "Unknown loco";
    const inspectionType = task?.inspectionType || "inspection";
    return `Loco ${locoNumber} - ${inspectionType}`;
}
//# sourceMappingURL=workflow.js.map