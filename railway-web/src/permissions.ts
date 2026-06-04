export type DashboardRole = "ADMIN" | "SUPERVISOR" | "WORKER" | string | undefined;

const normalizeRole = (role: DashboardRole) => (role || "").toUpperCase();

export const getRolePermissions = (role: DashboardRole) => {
  const normalizedRole = normalizeRole(role);
  const isAdmin = normalizedRole === "ADMIN";
  const isSupervisor = normalizedRole === "SUPERVISOR";
  const isWorker = normalizedRole === "WORKER";
  const isOperator = isAdmin || isSupervisor;

  return {
    isAdmin,
    isSupervisor,
    isWorker,
    canViewTasks: isAdmin || isSupervisor || isWorker,
    canViewOperationalDashboard: isOperator,
    canManageTasks: isOperator,
    canViewAssignments: isOperator,
    canViewTemplates: isOperator,
    canManageTemplates: isOperator,
    canViewAnalytics: isOperator,
    canViewLocoHistory: isOperator,
    canManageSchedules: isOperator,
    canViewNotifications: isOperator,
    canExportData: isOperator,
    canPerformDestructiveTemplateActions: isAdmin,
    canManageSetup: isAdmin,
    canManageUserMaster: isAdmin,
    canManageStaff: isAdmin,
    canSubmitWorkerInspection: isWorker
  };
};

export const canAccessDashboardTab = (role: DashboardRole, tabId: string) => {
  const permissions = getRolePermissions(role);

  switch (tabId) {
    case "tasks":
      return permissions.canViewTasks;
    case "task-assign":
      return permissions.canManageTasks;
    case "assignments":
      return permissions.canViewAssignments;
    case "templates-view":
      return permissions.canViewTemplates;
    case "analytics":
      return permissions.canViewAnalytics;
    case "loco-history":
      return permissions.canViewLocoHistory;
    case "schedules":
      return permissions.canManageSchedules;
    case "notifications":
      return permissions.canViewNotifications;
    case "exports":
      return permissions.canExportData;
    case "user-master":
      return permissions.canManageUserMaster;
    case "staff":
      return permissions.canManageStaff;
    case "profile":
    case "settings":
      return true;
    default:
      return false;
  }
};
