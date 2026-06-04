export function getActorId(req: any) {
  const headerValue = req.headers["user-id"];
  const actorId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  return typeof actorId === "string" && actorId ? actorId : null;
}

export async function createStatusEvent(
  client: any,
  taskId: string,
  status: string,
  actorId?: string | null,
  note?: string
) {
  return client.taskStatusEvent.create({
    data: {
      taskId,
      status,
      actorId: actorId || null,
      note: note || null
    }
  });
}

export async function createNotificationsForUsers(
  client: any,
  userIds: string[],
  notification: {
    title: string;
    message: string;
    type: string;
    taskId?: string | null;
    locoId?: string | null;
  }
) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueUserIds.length === 0) return;

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

export async function createNotificationsForRoles(
  client: any,
  roles: string[],
  notification: {
    title: string;
    message: string;
    type: string;
    taskId?: string | null;
    locoId?: string | null;
  }
) {
  const users = await client.user.findMany({
    where: {
      role: {
        in: roles as any
      }
    },
    select: { id: true }
  });

  await createNotificationsForUsers(
    client,
    users.map((user: any) => user.id),
    notification
  );
}

export function describeTask(task: any) {
  const locoNumber = task?.loco?.locoNumber || "Unknown loco";
  const inspectionType = task?.inspectionType || "inspection";
  return `Loco ${locoNumber} - ${inspectionType}`;
}
