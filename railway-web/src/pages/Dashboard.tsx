import { useEffect, useState } from "react";
import { api } from "../api/api";
import { getUser } from "../api/api";
import Sidebar from "../components/Sidebar";
import { getRolePermissions } from "../permissions";

export default function Dashboard() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("tasks");

  // Selection states for creating a task
  const [locos, setLocos] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateLoadError, setTemplateLoadError] = useState("");

  const [selectedLoco, setSelectedLoco] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("MEDIUM");
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const [loadingTasks, setLoadingTasks] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [allAssignments, setAllAssignments] = useState<any[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [expandedWorkers, setExpandedWorkers] = useState<string[]>([]);
  const [expandedAssignmentHistory, setExpandedAssignmentHistory] = useState<string[]>([]);

  // New states for inline assignment
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);
  const [taskWorkerSelection, setTaskWorkerSelection] = useState<string[]>([]);
  const [isUpdatingAssignments, setIsUpdatingAssignments] = useState(false);

  // New states for Template View
  const [viewTemplateId, setViewTemplateId] = useState<string>("");
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [expandedLocos, setExpandedLocos] = useState<string[]>([]);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [templateNameDrafts, setTemplateNameDrafts] = useState<Record<string, string>>({});
  const [sectionNameDrafts, setSectionNameDrafts] = useState<Record<string, string>>({});
  const [itemDrafts, setItemDrafts] = useState<Record<string, any>>({});
  const [templateAction, setTemplateAction] = useState<string | null>(null);

  // Admin-only staff management
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffRole, setNewStaffRole] = useState("WORKER");
  const [staffAction, setStaffAction] = useState<string | null>(null);

  // Admin-only user master
  const [userMasterUsers, setUserMasterUsers] = useState<any[]>([]);
  const [loadingUserMaster, setLoadingUserMaster] = useState(false);
  const [newUserMasterName, setNewUserMasterName] = useState("");
  const [newUserMasterRole, setNewUserMasterRole] = useState("WORKER");
  const [newUserMasterDepartment, setNewUserMasterDepartment] = useState("");
  const [userDepartmentDrafts, setUserDepartmentDrafts] = useState<Record<string, string>>({});
  const [userMasterAction, setUserMasterAction] = useState<string | null>(null);

  // Workflow addon states
  const [selectedHistoryLocoId, setSelectedHistoryLocoId] = useState("");
  const [locoHistory, setLocoHistory] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [scheduleAction, setScheduleAction] = useState<string | null>(null);
  const [newSchedule, setNewSchedule] = useState({
    locoId: "",
    templateId: "",
    priority: "MEDIUM",
    frequency: "WEEKLY",
    nextRunAt: "",
    workerIds: [] as string[]
  });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const user = getUser();
  const role = user?.role;
  const userId = user?.id;
  const permissions = getRolePermissions(role);
  const canManageTasks = permissions.canManageTasks;
  const canViewAssignments = permissions.canViewAssignments;
  const canViewTemplates = permissions.canViewTemplates;
  const canManageTemplates = permissions.canManageTemplates;
  const canViewAnalytics = permissions.canViewAnalytics;
  const canViewLocoHistory = permissions.canViewLocoHistory;
  const canManageSchedules = permissions.canManageSchedules;
  const canViewNotifications = permissions.canViewNotifications;
  const canExportData = permissions.canExportData;
  const canPerformDestructiveTemplateActions = permissions.canPerformDestructiveTemplateActions;
  const canManageUserMaster = permissions.canManageUserMaster;
  const canManageStaff = permissions.canManageStaff;
  const canSubmitWorkerInspection = permissions.canSubmitWorkerInspection;

  useEffect(() => {
    fetchTasks();
    if (canManageTasks) {
      fetchSelectionData();
      refreshTemplates();
      fetchAssignments();
    }
    if (canManageStaff) {
      fetchStaffUsers();
    }
    if (canManageUserMaster) {
      fetchUserMasterUsers();
    }
    if (canManageSchedules) {
      fetchSchedules();
    }
    if (canViewNotifications) {
      fetchNotifications();
    }
  }, [canManageTasks, canManageStaff, canManageUserMaster, canManageSchedules, canViewNotifications]);

  useEffect(() => {
    const locoKeys = Array.from(
      new Set(tasks.map((task) => task.loco?.locoNumber || "Unassigned"))
    ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

    setExpandedLocos((prev) => {
      if (locoKeys.length === 0) return [];
      if (prev.length === 0) return locoKeys;

      const retained = prev.filter((key) => locoKeys.includes(key));
      const additions = locoKeys.filter((key) => !retained.includes(key));
      return [...retained, ...additions];
    });
  }, [tasks]);

  useEffect(() => {
    const workerKeys = workers
      .map((worker) => worker.id)
      .sort((a, b) => {
        const workerA = workers.find((worker) => worker.id === a);
        const workerB = workers.find((worker) => worker.id === b);
        return (workerA?.name || "").localeCompare(workerB?.name || "");
      });

    setExpandedWorkers((prev) => {
      if (workerKeys.length === 0) return [];
      if (prev.length === 0) return workerKeys;

      const retained = prev.filter((key) => workerKeys.includes(key));
      const additions = workerKeys.filter((key) => !retained.includes(key));
      return [...retained, ...additions];
    });
  }, [workers]);

  useEffect(() => {
    if (selectedHistoryLocoId && canViewLocoHistory) {
      fetchLocoHistory(selectedHistoryLocoId);
    }
  }, [selectedHistoryLocoId, canViewLocoHistory]);

  const fetchAssignments = async () => {
    try {
      setLoadingAssignments(true);
      const res = await api.get("/tasks");
      // Flatten assignments from all tasks
      const flattened: any[] = [];
      res.data.forEach((task: any) => {
        const assignments = Array.isArray(task.assignments) ? task.assignments : [];
        assignments.forEach((asn: any) => {
          flattened.push({
            ...asn,
            taskStatus: task.status,
            locoNumber: task.loco?.locoNumber,
            inspectionType: task.inspectionType,
            taskCreatedAt: task.createdAt,
            assignmentEvents: Array.isArray(task.assignmentEvents) ? task.assignmentEvents : []
          });
        });
      });
      setAllAssignments(flattened);
    } catch (err) {
      console.error("Failed to fetch assignments", err);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const fetchSelectionData = async () => {
    try {
      const [locosRes, usersRes] = await Promise.all([
        api.get("/locos"),
        api.get("/users")
      ]);
      setLocos(locosRes.data);
      setWorkers(usersRes.data.filter((u: any) => u.role === "WORKER"));
    } catch (err) {
      console.error("Failed to fetch selection data", err);
    }
  };

  const fetchStaffUsers = async () => {
    try {
      setLoadingStaff(true);
      const res = await api.get("/users");
      const staff = res.data
        .filter((staffUser: any) => staffUser.role === "SUPERVISOR" || staffUser.role === "WORKER")
        .sort((a: any, b: any) => {
          if (a.role !== b.role) return a.role.localeCompare(b.role);
          return (a.name || "").localeCompare(b.name || "");
        });
      setStaffUsers(staff);
    } catch (err) {
      console.error("Failed to fetch staff users", err);
    } finally {
      setLoadingStaff(false);
    }
  };

  const createStaffUser = async () => {
    const name = newStaffName.trim();
    if (!name) {
      alert("Staff name is required.");
      return;
    }

    try {
      setStaffAction("create-staff");
      await api.post("/users", {
        name,
        role: newStaffRole
      });
      setNewStaffName("");
      setNewStaffRole("WORKER");
      await fetchStaffUsers();
      await fetchSelectionData();
      alert("Staff user created successfully.");
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Failed to create staff user.");
    } finally {
      setStaffAction(null);
    }
  };

  const fetchUserMasterUsers = async () => {
    try {
      setLoadingUserMaster(true);
      const res = await api.get("/users");
      const users = Array.isArray(res.data)
        ? res.data.slice().sort((a: any, b: any) => {
            if (a.role !== b.role) return a.role.localeCompare(b.role);
            return (a.name || "").localeCompare(b.name || "");
          })
        : [];
      setUserMasterUsers(users);
      setUserDepartmentDrafts((prev) => {
        const next: Record<string, string> = {};
        users.forEach((masterUser: any) => {
          next[masterUser.id] = prev[masterUser.id] ?? masterUser.department ?? "";
        });
        return next;
      });
    } catch (err) {
      console.error("Failed to fetch user master users", err);
    } finally {
      setLoadingUserMaster(false);
    }
  };

  const createUserMasterUser = async () => {
    const name = newUserMasterName.trim();
    if (!name) {
      alert("User name is required.");
      return;
    }

    try {
      setUserMasterAction("create-user");
      await api.post("/users", {
        name,
        role: newUserMasterRole,
        department: newUserMasterDepartment.trim()
      });
      setNewUserMasterName("");
      setNewUserMasterRole("WORKER");
      setNewUserMasterDepartment("");
      await fetchUserMasterUsers();
      await fetchStaffUsers();
      await fetchSelectionData();
      alert("User created successfully.");
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Failed to create user.");
    } finally {
      setUserMasterAction(null);
    }
  };

  const updateUserDepartment = async (masterUser: any) => {
    const department = (userDepartmentDrafts[masterUser.id] ?? masterUser.department ?? "").trim();

    try {
      setUserMasterAction(`department-${masterUser.id}`);
      await api.put(`/users/${masterUser.id}`, { department });
      await fetchUserMasterUsers();
      await fetchStaffUsers();
      await fetchSelectionData();
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Failed to update department.");
    } finally {
      setUserMasterAction(null);
    }
  };

  const fetchLocoHistory = async (locoId: string) => {
    if (!locoId) {
      setLocoHistory(null);
      return;
    }

    try {
      setLoadingHistory(true);
      const res = await api.get(`/locos/${locoId}/history`);
      setLocoHistory(res.data);
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Failed to load loco history.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchSchedules = async () => {
    try {
      setLoadingSchedules(true);
      const res = await api.get("/schedules");
      setSchedules(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch schedules", err);
    } finally {
      setLoadingSchedules(false);
    }
  };

  const toggleScheduleWorker = (workerId: string) => {
    setNewSchedule((current) => ({
      ...current,
      workerIds: current.workerIds.includes(workerId)
        ? current.workerIds.filter((id) => id !== workerId)
        : [...current.workerIds, workerId]
    }));
  };

  const createSchedule = async () => {
    if (!newSchedule.locoId || !newSchedule.templateId || !newSchedule.nextRunAt || newSchedule.workerIds.length === 0) {
      alert("Please select a loco, template, next run date, and at least one worker.");
      return;
    }

    try {
      setScheduleAction("create-schedule");
      await api.post("/schedules", {
        locoId: newSchedule.locoId,
        templateId: newSchedule.templateId,
        priority: newSchedule.priority,
        frequency: newSchedule.frequency,
        nextRunAt: new Date(newSchedule.nextRunAt).toISOString(),
        workerIds: newSchedule.workerIds
      });
      setNewSchedule({
        locoId: "",
        templateId: "",
        priority: "MEDIUM",
        frequency: "WEEKLY",
        nextRunAt: "",
        workerIds: []
      });
      await fetchSchedules();
      alert("Recurring schedule created.");
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Failed to create schedule.");
    } finally {
      setScheduleAction(null);
    }
  };

  const generateDueSchedules = async () => {
    try {
      setScheduleAction("generate-due");
      const res = await api.post("/schedules/generate-due");
      await fetchSchedules();
      await fetchTasks();
      await fetchAssignments();
      await fetchNotifications();
      alert(`${res.data.generatedCount || 0} due task(s) generated.`);
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Failed to generate due tasks.");
    } finally {
      setScheduleAction(null);
    }
  };

  const deactivateSchedule = async (scheduleId: string) => {
    try {
      setScheduleAction(`deactivate-${scheduleId}`);
      await api.post(`/schedules/${scheduleId}/deactivate`);
      await fetchSchedules();
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Failed to deactivate schedule.");
    } finally {
      setScheduleAction(null);
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoadingNotifications(true);
      const res = await api.get("/notifications");
      setNotifications(res.data.notifications || []);
      setUnreadNotifications(res.data.unreadCount || 0);
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const markNotificationRead = async (notificationId: string) => {
    try {
      await api.post(`/notifications/${notificationId}/read`);
      await fetchNotifications();
    } catch (err) {
      console.error("Failed to mark notification read", err);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await api.post("/notifications/read-all");
      await fetchNotifications();
    } catch (err) {
      console.error("Failed to mark notifications read", err);
    }
  };

  const downloadExport = async (path: string, filename: string) => {
    try {
      const res = await api.get(path, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Failed to download export.");
    }
  };

  const fetchTasks = async () => {
    try {
      setLoadingTasks(true);
      const res = await api.get("/tasks");
      const sorted = res.data.sort((a: any, b: any) => a.id.localeCompare(b.id));
      setTasks(sorted);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTasks(false);
    }
  };

  const createTask = async () => {
    if (!selectedLoco || !selectedTemplate || selectedWorkers.length === 0) {
      alert("Please select a Loco, an Inspection Type, and at least one Worker.");
      return;
    }

    try {
      setIsCreating(true);
      const template = templates.find((t) => t.id === selectedTemplate);

      if (!template || (template.status && template.status !== "PUBLISHED")) {
        alert("Please select a published template.");
        return;
      }

      const taskRes = await api.post("/tasks", {
        locoId: selectedLoco,
        templateId: template.id,
        inspectionType: template.name,
        priority: selectedPriority
      });

      const taskId = taskRes.data.id;

      // 2. Assign workers
      await api.post("/tasks/assign", {
        taskId,
        workerIds: selectedWorkers
      });

      alert("Task created and assigned successfully!");

      // Reset form
      setSelectedLoco("");
      setSelectedTemplate("");
      setSelectedPriority("MEDIUM");
      setSelectedWorkers([]);

      fetchTasks();
      fetchAssignments();
    } catch (err) {
      console.error(err);
      alert("Failed to create task.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleWorkerToggle = (workerId: string) => {
    setSelectedWorkers(prev =>
      prev.includes(workerId)
        ? prev.filter(id => id !== workerId)
        : [...prev, workerId]
    );
  };

  const approveTask = async (taskId: string) => {
    if (approvingId) return;
    try {
      setApprovingId(taskId);
      await api.post(`/tasks/${taskId}/approve`);
      await fetchTasks();
    } catch (err) {
      console.error(err);
      alert("Failed to complete task.");
    } finally {
      setApprovingId(null);
    }
  };

  const reworkTask = async (taskId: string) => {
    try {
      await api.post(`/tasks/${taskId}/rework`);
      await fetchTasks();
    } catch (err) {
      console.error(err);
      alert("Failed to send task for rework.");
    }
  };

  const assignWorkers = (taskId: string) => {
    setAssigningTaskId(taskId);
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const assignments = Array.isArray(task.assignments) ? task.assignments : [];
      setTaskWorkerSelection(assignments.map((a: any) => a.workerId));
    }
  };

  const handleTaskWorkerToggle = (workerId: string) => {
    setTaskWorkerSelection(prev =>
      prev.includes(workerId)
        ? prev.filter(id => id !== workerId)
        : [...prev, workerId]
    );
  };

  const submitTaskAssignment = async (taskId: string) => {
    try {
      setIsUpdatingAssignments(true);
      await api.post("/tasks/assign", {
        taskId,
        workerIds: taskWorkerSelection
      });
      setAssigningTaskId(null);
      await fetchTasks();
      await fetchAssignments();
    } catch (err) {
      console.error(err);
      alert("Failed to update assignments.");
    } finally {
      setIsUpdatingAssignments(false);
    }
  };

  const submitInspection = async (taskId: string) => {
    try {
      if (!userId) {
        alert("Worker user ID is missing.");
        return;
      }

      const inspectionRes = await api.post("/inspection/start", {
        taskId,
        workerId: userId
      });

      const templateRes = await api.get(`/inspection/template/${taskId}`);
      const items = (templateRes.data?.sections || []).flatMap((section: any) => section.items || []);

      if (items.length === 0) {
        alert("No checklist items found for this task.");
        return;
      }

      const responses: any[] = [];

      for (const item of items) {
        const choices = Array.isArray(item.choices) ? item.choices : [];
        const choiceHint = item.type === "mcq" && choices.length > 0
          ? `\nChoices: ${choices.map((choice: any) => choice.label).join(", ")}`
          : "";
        const rangeHint = item.type === "range" && item.rangeMin != null && item.rangeMax != null
          ? `\nAllowed range: ${item.rangeMin} - ${item.rangeMax}${item.unit ? ` ${item.unit}` : ""}`
          : "";
        const value = prompt(`${item.label}${item.unit ? ` (${item.unit})` : ""}${choiceHint}${rangeHint}`);
        if (!value) return;
        if (item.type === "range") {
          const numericValue = Number(value);
          if (!Number.isFinite(numericValue)) {
            alert(`${item.label} must be a numeric value.`);
            return;
          }
          if (item.rangeMin == null || item.rangeMax == null || numericValue < item.rangeMin || numericValue > item.rangeMax) {
            alert(`${item.label} must be between ${item.rangeMin} and ${item.rangeMax}${item.unit ? ` ${item.unit}` : ""}.`);
            return;
          }
        }

        const remark = prompt(`Remark for ${item.label} (optional)`);
        responses.push({
          itemId: item.id,
          itemName: item.label,
          label: item.label,
          type: item.type,
          required: item.required !== false,
          value,
          remark: remark || ""
        });
      }

      await api.post("/inspection/submit", {
        inspectionId: inspectionRes.data.id,
        responses
      });

      await api.post(`/tasks/${taskId}/submit`);
      await fetchTasks();
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Failed to submit inspection.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    window.location.reload();
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const setItemDraftValue = (itemKey: string, field: string, value: any) => {
    setItemDrafts((prev) => ({
      ...prev,
      [itemKey]: {
        ...prev[itemKey],
        [field]: value,
        ...(field === "type" && value === "mcq" && !prev[itemKey]?.choices
          ? { choices: createDefaultChoices() }
          : {})
      }
    }));
  };

  const choicePalette: Record<string, { label: string; bg: string; text: string; border: string }> = {
    gray: { label: "Gray", bg: "#f8fafc", text: "#475569", border: "#cbd5e1" },
    green: { label: "Green", bg: "#ecfdf5", text: "#047857", border: "#a7f3d0" },
    yellow: { label: "Yellow", bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
    red: { label: "Red", bg: "#fff1f2", text: "#9f1239", border: "#fecdd3" },
    blue: { label: "Blue", bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" }
  };

  const createChoiceId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `choice-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const createDefaultChoices = () => [
    { id: createChoiceId(), label: "", color: "green" },
    { id: createChoiceId(), label: "", color: "red" }
  ];

  const getChoiceDrafts = (itemKey: string, fallbackChoices?: any[]) => {
    const draftChoices = itemDrafts[itemKey]?.choices;
    const source = Array.isArray(draftChoices)
      ? draftChoices
      : Array.isArray(fallbackChoices) && fallbackChoices.length > 0
        ? fallbackChoices
        : createDefaultChoices();

    return source.slice(0, 4).map((choice: any, index: number) => ({
      id: choice.id || `choice-${index + 1}`,
      label: choice.label || "",
      color: choicePalette[choice.color] ? choice.color : "gray"
    }));
  };

  const setChoiceDraftValue = (itemKey: string, choiceIndex: number, field: string, value: string, fallbackChoices?: any[]) => {
    const choices = getChoiceDrafts(itemKey, fallbackChoices);
    choices[choiceIndex] = {
      ...choices[choiceIndex],
      [field]: value
    };
    setItemDraftValue(itemKey, "choices", choices);
  };

  const addChoiceDraft = (itemKey: string, fallbackChoices?: any[]) => {
    const choices = getChoiceDrafts(itemKey, fallbackChoices);
    if (choices.length >= 4) return;
    setItemDraftValue(itemKey, "choices", [
      ...choices,
      { id: createChoiceId(), label: "", color: "gray" }
    ]);
  };

  const removeChoiceDraft = (itemKey: string, choiceIndex: number, fallbackChoices?: any[]) => {
    const choices = getChoiceDrafts(itemKey, fallbackChoices);
    if (choices.length <= 2) return;
    setItemDraftValue(itemKey, "choices", choices.filter((_, index) => index !== choiceIndex));
  };

  const buildChoicesPayload = (choices: any[]) => {
    return choices
      .map((choice) => ({
        id: choice.id || createChoiceId(),
        label: String(choice.label || "").trim(),
        color: choicePalette[choice.color] ? choice.color : "gray"
      }))
      .filter((choice) => choice.label);
  };

  const getValidChoicesOrAlert = (itemKey: string, fallbackChoices?: any[]) => {
    const choices = buildChoicesPayload(getChoiceDrafts(itemKey, fallbackChoices));
    if (choices.length < 2 || choices.length > 4) {
      alert("MCQ items require 2 to 4 filled choices.");
      return null;
    }
    return choices;
  };

  const parseRangeValue = (value: any) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const getValidRangeOrAlert = (itemKey: string, fallbackItem?: any) => {
    const draft = itemDrafts[itemKey] || {};
    const rangeMin = parseRangeValue(draft.rangeMin ?? fallbackItem?.rangeMin);
    const rangeMax = parseRangeValue(draft.rangeMax ?? fallbackItem?.rangeMax);

    if (rangeMin === null || rangeMax === null) {
      alert("Range items require numeric min and max values.");
      return null;
    }

    if (rangeMin > rangeMax) {
      alert("Range min cannot be greater than range max.");
      return null;
    }

    return { rangeMin, rangeMax };
  };

  const renderRangeEditor = (itemKey: string, fallbackItem?: any) => {
    const draft = itemDrafts[itemKey] || {};

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '12px', border: '1px solid #dbeafe', borderRadius: '12px', backgroundColor: '#f8fafc' }}>
        <input
          type="number"
          value={draft.rangeMin ?? fallbackItem?.rangeMin ?? ""}
          onChange={(e) => setItemDraftValue(itemKey, "rangeMin", e.target.value)}
          placeholder="Min"
          style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', minWidth: 0 }}
        />
        <input
          type="number"
          value={draft.rangeMax ?? fallbackItem?.rangeMax ?? ""}
          onChange={(e) => setItemDraftValue(itemKey, "rangeMax", e.target.value)}
          placeholder="Max"
          style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', minWidth: 0 }}
        />
      </div>
    );
  };

  const renderChoiceEditor = (itemKey: string, fallbackChoices?: any[]) => {
    const choices = getChoiceDrafts(itemKey, fallbackChoices);

    return (
      <div style={{ display: 'grid', gap: '10px', padding: '12px', border: '1px solid #dbeafe', borderRadius: '12px', backgroundColor: '#f8fafc' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ color: '#334155', fontSize: '0.82rem', fontWeight: '800' }}>MCQ choices</span>
          <button
            type="button"
            onClick={() => addChoiceDraft(itemKey, fallbackChoices)}
            disabled={choices.length >= 4}
            style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #bfdbfe', backgroundColor: choices.length >= 4 ? '#f1f5f9' : '#eff6ff', color: choices.length >= 4 ? '#94a3b8' : '#1e40af', cursor: choices.length >= 4 ? 'not-allowed' : 'pointer', fontWeight: '800', fontSize: '0.78rem' }}
          >
            Add Choice
          </button>
        </div>
        {choices.map((choice, index) => {
          const color = choicePalette[choice.color] || choicePalette.gray;
          return (
            <div key={choice.id || index} style={{ display: 'grid', gridTemplateColumns: '1fr 150px auto', gap: '10px', alignItems: 'center' }}>
              <input
                value={choice.label}
                onChange={(e) => setChoiceDraftValue(itemKey, index, "label", e.target.value, fallbackChoices)}
                placeholder={`Choice ${index + 1}`}
                style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', minWidth: 0 }}
              />
              <select
                value={choice.color}
                onChange={(e) => setChoiceDraftValue(itemKey, index, "color", e.target.value, fallbackChoices)}
                style={{ padding: '10px 12px', borderRadius: '10px', border: `1px solid ${color.border}`, backgroundColor: color.bg, color: color.text, fontWeight: '700' }}
              >
                {Object.entries(choicePalette).map(([value, option]) => (
                  <option key={value} value={value}>{option.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeChoiceDraft(itemKey, index, fallbackChoices)}
                disabled={choices.length <= 2}
                style={{ padding: '9px 10px', borderRadius: '8px', border: '1px solid #fecaca', backgroundColor: choices.length <= 2 ? '#f8fafc' : '#fff1f2', color: choices.length <= 2 ? '#94a3b8' : '#9f1239', cursor: choices.length <= 2 ? 'not-allowed' : 'pointer', fontWeight: '800', fontSize: '0.78rem' }}
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  const refreshTemplates = async (selectedId?: string) => {
    try {
      setLoadingTemplates(true);
      setTemplateLoadError("");
      const templatesRes = await api.get("/templates");
      const templateData = Array.isArray(templatesRes.data) ? templatesRes.data : [];
      setTemplates(templateData);
      if (selectedId) setViewTemplateId(selectedId);
    } catch (err: any) {
      console.error("Failed to fetch templates", err);
      setTemplateLoadError(err?.response?.data?.error || "Failed to load templates.");
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const createTemplateDraft = async () => {
    const name = newTemplateName.trim();
    if (!name) {
      alert("Template name is required.");
      return;
    }

    try {
      setTemplateAction("create-template");
      const res = await api.post("/templates", { name });
      setNewTemplateName("");
      await refreshTemplates(res.data.id);
    } catch (err) {
      console.error(err);
      alert("Failed to create template draft.");
    } finally {
      setTemplateAction(null);
    }
  };

  const duplicateTemplateDraft = async (templateId: string) => {
    try {
      setTemplateAction(`duplicate-${templateId}`);
      const res = await api.post(`/templates/${templateId}/duplicate`);
      await refreshTemplates(res.data.id);
    } catch (err) {
      console.error(err);
      alert("Failed to duplicate template.");
    } finally {
      setTemplateAction(null);
    }
  };

  const updateTemplateName = async (templateId: string, fallbackName: string) => {
    const name = (templateNameDrafts[templateId] ?? fallbackName).trim();
    if (!name) {
      alert("Template name is required.");
      return;
    }

    try {
      setTemplateAction(`template-name-${templateId}`);
      await api.put(`/templates/${templateId}`, { name });
      await refreshTemplates(templateId);
    } catch (err) {
      console.error(err);
      alert("Failed to update template name.");
    } finally {
      setTemplateAction(null);
    }
  };

  const publishTemplate = async (templateId: string) => {
    try {
      setTemplateAction(`publish-${templateId}`);
      await api.post(`/templates/${templateId}/publish`);
      await refreshTemplates(templateId);
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Failed to publish template.");
    } finally {
      setTemplateAction(null);
    }
  };

  const archiveTemplate = async (templateId: string) => {
    if (!canPerformDestructiveTemplateActions) {
      alert("Admin access is required for this action.");
      return;
    }

    if (!window.confirm("Archive or delete this template? Existing inspections will remain linked to their template version.")) {
      return;
    }

    try {
      setTemplateAction(`archive-${templateId}`);
      await api.delete(`/templates/${templateId}`);
      await refreshTemplates();
      setViewTemplateId("");
    } catch (err) {
      console.error(err);
      alert("Failed to archive template.");
    } finally {
      setTemplateAction(null);
    }
  };

  const addSectionToTemplate = async (templateId: string) => {
    const name = (sectionNameDrafts[templateId] || "").trim();
    if (!name) {
      alert("Section name is required.");
      return;
    }

    try {
      setTemplateAction(`section-create-${templateId}`);
      const res = await api.post("/sections", { templateId, name });
      setSectionNameDrafts((prev) => ({ ...prev, [templateId]: "" }));
      if (res.data?.id) {
        setExpandedSections((prev) => prev.includes(res.data.id) ? prev : [...prev, res.data.id]);
      }
      await refreshTemplates(templateId);
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Failed to add section.");
    } finally {
      setTemplateAction(null);
    }
  };

  const updateSectionName = async (sectionId: string, templateId: string, fallbackName: string) => {
    const name = (sectionNameDrafts[sectionId] ?? fallbackName).trim();
    if (!name) {
      alert("Section name is required.");
      return;
    }

    try {
      setTemplateAction(`section-name-${sectionId}`);
      await api.put(`/sections/${sectionId}`, { name });
      await refreshTemplates(templateId);
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Failed to update section.");
    } finally {
      setTemplateAction(null);
    }
  };

  const removeSection = async (sectionId: string, templateId: string, isPublished = false) => {
    if (!canPerformDestructiveTemplateActions) {
      alert("Admin access is required for this action.");
      return;
    }

    const message = isPublished
      ? "Delete this section from the published template? It will be hidden from future inspections, while old inspection records stay intact."
      : "Remove this section from the draft template?";

    if (!window.confirm(message)) return;

    try {
      setTemplateAction(`section-remove-${sectionId}`);
      await api.delete(`/sections/${sectionId}`);
      await refreshTemplates(templateId);
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Failed to remove section.");
    } finally {
      setTemplateAction(null);
    }
  };

  const addItemToSection = async (sectionId: string, templateId: string) => {
    const draft = itemDrafts[`new-${sectionId}`] || {};
    const label = (draft.label || "").trim();
    const type = draft.type || "text";

    if (!label) {
      alert("Item label is required.");
      return;
    }

    const choices = type === "mcq" ? getValidChoicesOrAlert(`new-${sectionId}`) : null;
    if (type === "mcq" && !choices) return;
    const range = type === "range" ? getValidRangeOrAlert(`new-${sectionId}`) : null;
    if (type === "range" && !range) return;

    try {
      setTemplateAction(`item-create-${sectionId}`);
      await api.post("/items", {
        sectionId,
        label,
        type,
        required: draft.required !== false,
        placeholder: draft.placeholder || "",
        unit: draft.unit || "",
        rangeMin: range?.rangeMin,
        rangeMax: range?.rangeMax,
        choices
      });
      setItemDrafts((prev) => ({ ...prev, [`new-${sectionId}`]: { type: "text", required: true } }));
      await refreshTemplates(templateId);
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Failed to add item.");
    } finally {
      setTemplateAction(null);
    }
  };

  const updateItem = async (item: any, templateId: string) => {
    const draft = itemDrafts[item.id] || {};
    const label = (draft.label ?? item.label).trim();
    const type = draft.type ?? item.type;

    if (!label) {
      alert("Item label is required.");
      return;
    }

    const choices = type === "mcq" ? getValidChoicesOrAlert(item.id, item.choices) : null;
    if (type === "mcq" && !choices) return;
    const range = type === "range" ? getValidRangeOrAlert(item.id, item) : null;
    if (type === "range" && !range) return;

    try {
      setTemplateAction(`item-update-${item.id}`);
      await api.put(`/items/${item.id}`, {
        label,
        type,
        required: draft.required ?? item.required ?? true,
        placeholder: draft.placeholder ?? item.placeholder ?? "",
        unit: draft.unit ?? item.unit ?? "",
        rangeMin: range?.rangeMin,
        rangeMax: range?.rangeMax,
        choices
      });
      await refreshTemplates(templateId);
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Failed to update item.");
    } finally {
      setTemplateAction(null);
    }
  };

  const removeItem = async (itemId: string, templateId: string) => {
    if (!canPerformDestructiveTemplateActions) {
      alert("Admin access is required for this action.");
      return;
    }

    if (!window.confirm("Remove this item from the draft section?")) return;

    try {
      setTemplateAction(`item-remove-${itemId}`);
      await api.delete(`/items/${itemId}`);
      await refreshTemplates(templateId);
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Failed to remove item.");
    } finally {
      setTemplateAction(null);
    }
  };

  const toggleLocoSection = (locoNumber: string) => {
    setExpandedLocos((prev) =>
      prev.includes(locoNumber)
        ? prev.filter((id) => id !== locoNumber)
        : [...prev, locoNumber]
    );
  };

  const toggleWorkerSection = (workerId: string) => {
    setExpandedWorkers((prev) =>
      prev.includes(workerId)
        ? prev.filter((id) => id !== workerId)
        : [...prev, workerId]
    );
  };

  const toggleAssignmentHistory = (assignmentId: string) => {
    setExpandedAssignmentHistory((prev) =>
      prev.includes(assignmentId)
        ? prev.filter((id) => id !== assignmentId)
        : [...prev, assignmentId]
    );
  };

  const priorityOrder: Record<string, number> = {
    URGENT: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3
  };

  const statusOrder: Record<string, number> = {
    REWORK: 0,
    SUBMITTED: 1,
    ASSIGNED: 2,
    CREATED: 3,
    DONE: 4
  };

  const priorityColors: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    URGENT: { bg: '#fef2f2', text: '#991b1b', border: '#fecaca', dot: '#ef4444' },
    HIGH: { bg: '#fff7ed', text: '#9a3412', border: '#ffedd5', dot: '#f97316' },
    MEDIUM: { bg: '#eff6ff', text: '#1e40af', border: '#dbeafe', dot: '#3b82f6' },
    LOW: { bg: '#f0fdf4', text: '#166534', border: '#dcfce7', dot: '#22c55e' }
  };

  const statusColors: Record<string, { bg: string; text: string; border?: string }> = {
    DONE: { bg: '#ecfdf5', text: '#065f46', border: '#d1fae5' },
    REWORK: { bg: '#fff1f2', text: '#9f1239', border: '#fecdd3' },
    SUBMITTED: { bg: '#f0f9ff', text: '#075985', border: '#bae6fd' },
    ASSIGNED: { bg: '#fefce8', text: '#854d0e', border: '#fde68a' },
    CREATED: { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' }
  };

  const formatDateTime = (value?: string) => {
    if (!value) return "Not recorded";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not recorded";

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  };

  const getLatestAssignmentTime = (task: any) => {
    const assignments = Array.isArray(task.assignments) ? task.assignments : [];
    return assignments.reduce((latest: string | undefined, assignment: any) => {
      if (!assignment.createdAt) return latest;
      if (!latest || new Date(assignment.createdAt).getTime() > new Date(latest).getTime()) {
        return assignment.createdAt;
      }
      return latest;
    }, undefined);
  };

  const getAssignmentEventsForWorker = (assignment: any) => {
    const events = Array.isArray(assignment.assignmentEvents) ? assignment.assignmentEvents : [];
    return events.filter((event: any) => event.workerId === assignment.workerId);
  };

  const groupedLocoMap = tasks.reduce((acc: Record<string, any[]>, task) => {
    const locoNumber = task.loco?.locoNumber || "Unassigned";
    if (!acc[locoNumber]) acc[locoNumber] = [];
    acc[locoNumber].push(task);
    return acc;
  }, {});

  const locoGroups = Object.entries(groupedLocoMap)
    .map(([locoNumber, locoTasks]) => {
      const sortedTasks = [...locoTasks].sort((a: any, b: any) => {
        const bAssignmentTime = getLatestAssignmentTime(b) || b.createdAt;
        const aAssignmentTime = getLatestAssignmentTime(a) || a.createdAt;
        const assignmentTimeDiff = new Date(bAssignmentTime).getTime() - new Date(aAssignmentTime).getTime();
        if (assignmentTimeDiff !== 0) return assignmentTimeDiff;

        const statusDiff = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
        if (statusDiff !== 0) return statusDiff;

        const priorityDiff = (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
        if (priorityDiff !== 0) return priorityDiff;

        return a.id.localeCompare(b.id);
      });

      const statusCounts = sortedTasks.reduce((acc: Record<string, number>, task: any) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, {});

      return {
        locoNumber,
        tasks: sortedTasks,
        statusCounts,
        activeCount: sortedTasks.filter((task: any) => task.status !== "DONE").length
      };
    })
    .sort((a, b) => a.locoNumber.localeCompare(b.locoNumber, undefined, { numeric: true, sensitivity: "base" }));

  const locomotiveHealth = locoGroups.map((group) => {
    let healthStatus = "PENDING";

    if (group.tasks.some((task: any) => task.status === "REWORK")) {
      healthStatus = "IN REWORK";
    } else if (group.tasks.length > 0 && group.tasks.every((task: any) => task.status === "DONE")) {
      healthStatus = "HEALTHY";
    }

    return {
      locoNumber: group.locoNumber,
      status: healthStatus,
      openTasks: group.tasks.filter((task: any) => task.status !== "DONE").length,
      totalTasks: group.tasks.length
    };
  });

  const locomotiveHealthSummary = locomotiveHealth.reduce((acc, loco) => {
    acc[loco.status] = (acc[loco.status] || 0) + 1;
    return acc;
  }, { HEALTHY: 0, PENDING: 0, "IN REWORK": 0 } as Record<string, number>);

  const activeWorkerLoads = allAssignments.reduce((acc: Record<string, number>, assignment: any) => {
    if (assignment.taskStatus !== "DONE") {
      acc[assignment.workerId] = (acc[assignment.workerId] || 0) + 1;
    }
    return acc;
  }, {});

  const workforceUtilization = workers
    .map((worker) => ({
      id: worker.id,
      name: worker.name,
      activeTasks: activeWorkerLoads[worker.id] || 0
    }))
    .sort((a, b) => b.activeTasks - a.activeTasks || a.name.localeCompare(b.name));

  const assignmentsByWorker = workforceUtilization.map((worker) => {
    const assignments = allAssignments
      .filter((assignment) => assignment.workerId === worker.id)
      .sort((a, b) => {
        const bAssignedAt = b.createdAt || b.taskCreatedAt;
        const aAssignedAt = a.createdAt || a.taskCreatedAt;
        const assignedAtDiff = new Date(bAssignedAt).getTime() - new Date(aAssignedAt).getTime();
        if (assignedAtDiff !== 0) return assignedAtDiff;

        const statusDiff = (statusOrder[a.taskStatus] ?? 99) - (statusOrder[b.taskStatus] ?? 99);
        if (statusDiff !== 0) return statusDiff;

        const locoDiff = (a.locoNumber || "").localeCompare(b.locoNumber || "", undefined, {
          numeric: true,
          sensitivity: "base"
        });
        if (locoDiff !== 0) return locoDiff;

        return (a.inspectionType || "").localeCompare(b.inspectionType || "");
      });

    const statusCounts = assignments.reduce((acc: Record<string, number>, assignment: any) => {
      acc[assignment.taskStatus] = (acc[assignment.taskStatus] || 0) + 1;
      return acc;
    }, {});

    return {
      ...worker,
      assignments,
      statusCounts
    };
  });

  const doneTasks = tasks.filter((task) => task.status === "DONE").length;
  const reworkTasks = tasks.filter((task) => task.status === "REWORK").length;
  const efficiencyBase = doneTasks + reworkTasks;
  const firstPassRate = efficiencyBase === 0 ? 0 : Math.round((doneTasks / efficiencyBase) * 100);
  const reworkRate = efficiencyBase === 0 ? 0 : Math.round((reworkTasks / efficiencyBase) * 100);

  const prioritySummary = tasks.reduce((acc: Record<string, number>, task) => {
    acc[task.priority] = (acc[task.priority] || 0) + 1;
    return acc;
  }, { URGENT: 0, HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<string, number>);

  const publishedTemplates = templates.filter((template) => !template.status || template.status === "PUBLISHED");
  const selectedTemplateForBuilder = templates.find((template) => template.id === viewTemplateId);
  const supervisorCount = staffUsers.filter((staffUser) => staffUser.role === "SUPERVISOR").length;
  const workerCount = staffUsers.filter((staffUser) => staffUser.role === "WORKER").length;
  const userMasterCounts = userMasterUsers.reduce((acc: Record<string, number>, masterUser: any) => {
    acc[masterUser.role] = (acc[masterUser.role] || 0) + 1;
    return acc;
  }, { ADMIN: 0, SUPERVISOR: 0, WORKER: 0 } as Record<string, number>);

  const templateStatusStyle: Record<string, { bg: string; text: string; border: string }> = {
    DRAFT: { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
    PUBLISHED: { bg: '#ecfdf5', text: '#065f46', border: '#d1fae5' },
    ARCHIVED: { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' }
  };

  const renderTaskRow = (task: any, index: number) => {
    const taskInspections = Array.isArray(task.inspections) ? task.inspections : [];
    const taskAssignments = Array.isArray(task.assignments) ? task.assignments : [];
    const pStyle = priorityColors[task.priority] || priorityColors.MEDIUM;
    const sStyle = statusColors[task.status] || statusColors.CREATED;

    return (
      <div
        key={task.id}
        style={{
          padding: '24px 28px',
          borderTop: index === 0 ? 'none' : '1px solid #e2e8f0',
          backgroundColor: task.status === 'REWORK' ? '#fffafc' : 'white'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#1e293b' }}>{task.inspectionType}</span>
              <span style={{
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '0.72rem',
                fontWeight: '700',
                backgroundColor: pStyle.bg,
                color: pStyle.text,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                border: `1px solid ${pStyle.border}`
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: pStyle.dot }}></span>
                {task.priority}
              </span>
              <span style={{
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '0.72rem',
                fontWeight: '700',
                backgroundColor: sStyle.bg,
                color: sStyle.text,
                border: `1px solid ${sStyle.border || '#e2e8f0'}`
              }}>
                {task.status}
              </span>
            </div>
            <div style={{ color: '#64748b', fontSize: '0.875rem' }}>
              {taskAssignments.length > 0
                ? `Assigned to ${taskAssignments.map((assignment: any) => assignment.worker?.name).filter(Boolean).join(", ")}`
                : 'No personnel assigned yet'}
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', color: '#64748b', fontSize: '0.8125rem' }}>
              <span>Last assigned: <strong style={{ color: '#334155' }}>{formatDateTime(getLatestAssignmentTime(task))}</strong></span>
              <span>Created: <strong style={{ color: '#334155' }}>{formatDateTime(task.createdAt)}</strong></span>
            </div>
          </div>

          <div style={{ minWidth: '180px', color: '#64748b', fontSize: '0.8125rem', textAlign: 'right' }}>
            <div>Task ID</div>
            <div style={{ color: '#334155', fontWeight: '600', marginTop: '2px' }}>{task.id}</div>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          {canManageTasks && assigningTaskId === task.id ? (
            <div style={{
              backgroundColor: '#f8fafc',
              padding: '20px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0'
            }}>
              <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', color: '#475569', fontSize: '0.875rem' }}>
                Assign Personnel
              </label>
              <div style={{ maxHeight: '160px', overflowY: 'auto', marginBottom: '16px', paddingRight: '4px' }}>
                {workers.map((worker) => (
                  <label key={worker.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    marginBottom: '4px',
                    backgroundColor: taskWorkerSelection.includes(worker.id) ? '#eff6ff' : 'transparent'
                  }}>
                    <input
                      type="checkbox"
                      checked={taskWorkerSelection.includes(worker.id)}
                      onChange={() => handleTaskWorkerToggle(worker.id)}
                      style={{ marginRight: '10px', width: '16px', height: '16px' }}
                    />
                    <span style={{ fontSize: '0.875rem', color: '#334155' }}>{worker.name}</span>
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => submitTaskAssignment(task.id)}
                  disabled={isUpdatingAssignments}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.875rem'
                  }}
                >
                  {isUpdatingAssignments ? 'Saving...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setAssigningTaskId(null)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: '#fff',
                    color: '#64748b',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.875rem'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {task.status === 'SUBMITTED' && canManageTasks && (
                <>
                  <button
                    onClick={() => approveTask(task.id)}
                    disabled={approvingId === task.id}
                    style={{
                      flex: 1.5,
                      minWidth: '160px',
                      padding: '12px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    {approvingId === task.id ? 'Processing...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => reworkTask(task.id)}
                    style={{
                      flex: 1,
                      minWidth: '140px',
                      padding: '12px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2.5 2v6h6M2.5 8l6-6M21.5 22v-6h-6M21.5 16l-6 6"/></svg>
                    Rework
                  </button>
                </>
              )}

              {canManageTasks && task.status !== 'DONE' && task.status !== 'SUBMITTED' && (
                <button
                  onClick={() => assignWorkers(task.id)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="17" y1="11" x2="23" y2="11"/></svg>
                  {task.status === 'REWORK' ? 'Modify Assignment' : 'Assign Workers'}
                </button>
              )}

              {canSubmitWorkerInspection && task.status !== 'DONE' && (
                <button
                  onClick={() => submitInspection(task.id)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Start Inspection
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '18px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Progress Details
          </h4>

          {taskInspections.length === 0 && (
            <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #e2e8f0', textAlign: 'center' }}>
              <span style={{ fontSize: '0.8125rem', color: '#94a3b8', fontStyle: 'italic' }}>Pending submission from workers</span>
            </div>
          )}

          {(() => {
            const itemMap: Record<string, Array<{ worker: string; value: string; remark?: string }>> = {};
            taskInspections.forEach((inspection: any) => {
              inspection.responses?.forEach((response: any) => {
                const label = response.item?.label || response.itemName || "Unknown Item";
                if (!itemMap[label]) itemMap[label] = [];
                itemMap[label].push({
                  worker: inspection.worker?.name,
                  value: response.value,
                  remark: response.remark
                });
              });
            });

            return Object.keys(itemMap).map((itemName) => {
              const entries = itemMap[itemName];
              const values = entries.map((entry) => entry.value);
              const isMismatch = new Set(values).size > 1;

              return (
                <div
                  key={itemName}
                  style={{
                    backgroundColor: isMismatch ? '#fff5f5' : '#ffffff',
                    border: '1px solid',
                    borderColor: isMismatch ? '#fee2e2' : '#f1f5f9',
                    borderRadius: '10px',
                    marginBottom: '8px',
                    padding: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: '600', fontSize: '0.875rem', color: '#334155' }}>{itemName}</span>
                    {isMismatch && (
                      <span style={{ backgroundColor: '#ef4444', color: 'white', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>
                        CONFLICT
                      </span>
                    )}
                  </div>

                  {entries.map((entry, entryIndex) => (
                    <div key={entryIndex} style={{ fontSize: '0.8125rem', color: '#64748b', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span style={{ fontWeight: '500', color: '#475569' }}>{entry.worker}:</span>
                      <span>{entry.value}</span>
                      {entry.remark && <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>({entry.remark})</span>}
                    </div>
                  ))}
                </div>
              );
            });
          })()}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        role={role}
      />

      <div style={{ flex: 1, marginLeft: '240px', padding: '40px', boxSizing: 'border-box' }}>
        {activeTab === 'tasks' && (
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '40px',
              backgroundColor: 'white',
              padding: '24px 32px',
              borderRadius: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.875rem', fontWeight: '700', color: '#1e293b' }}>Inspection Dashboard</h1>
                <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '1rem' }}>Manage and monitor railway inspection tasks</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: '600', color: '#1e293b' }}>{user?.name}</div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{role}</div>
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  backgroundColor: '#e2e8f0',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  fontWeight: 'bold',
                  color: '#64748b'
                }}>
                  {user?.name?.charAt(0)}
                </div>
              </div>
            </div>

            {canManageTasks && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#eff6ff',
                padding: '24px 32px',
                borderRadius: '16px',
                marginBottom: '40px',
                border: '1px solid #dbeafe'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{
                    backgroundColor: '#3b82f6',
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white'
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                  </div>
                  <div>
                    <h3 style={{ margin: 0, color: '#1e3a8a', fontSize: '1.125rem' }}>Ready to assign new inspections?</h3>
                    <p style={{ margin: '4px 0 0', color: '#60a5fa' }}>Create tasks and delegate them to available workers.</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('task-assign')}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)'
                  }}
                >
                  Create New Task
                </button>
              </div>
            )}

            <div style={{ display: 'grid', gap: '20px' }}>
              {loadingTasks && tasks.length === 0 && <p>Loading tasks...</p>}
              {!loadingTasks && tasks.length === 0 && (
                <div style={{ textAlign: 'center', padding: '100px 0' }}>
                  <p style={{ fontSize: '1.125rem', color: '#64748b' }}>No tasks found. Start by creating a new inspection task.</p>
                </div>
              )}
              {locoGroups.map((group) => {
                const isExpanded = expandedLocos.includes(group.locoNumber);

                return (
                  <section
                    key={group.locoNumber}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '20px',
                      border: '1px solid #e2e8f0',
                      overflow: 'hidden',
                      boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)'
                    }}
                  >
                    <button
                      onClick={() => toggleLocoSection(group.locoNumber)}
                      style={{
                        width: '100%',
                        padding: '24px 28px',
                        border: 'none',
                        backgroundColor: '#f8fafc',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '20px',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ display: 'grid', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b' }}>Loco {group.locoNumber}</h2>
                          <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: '600' }}>
                            {group.tasks.length} inspections
                          </span>
                          <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: '600' }}>
                            {group.activeCount} active
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {Object.entries(group.statusCounts).map(([status, count]) => {
                            const chipStyle = statusColors[status] || statusColors.CREATED;
                            return (
                              <span
                                key={status}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '999px',
                                  fontSize: '0.74rem',
                                  fontWeight: '700',
                                  backgroundColor: chipStyle.bg,
                                  color: chipStyle.text,
                                  border: `1px solid ${chipStyle.border || '#e2e8f0'}`
                                }}
                              >
                                {status} {count}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#64748b"
                        strokeWidth="2"
                        style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>

                    {isExpanded && (
                      <div>
                        {group.tasks.map((task, index) => renderTaskRow(task, index))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'task-assign' && canManageTasks && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.875rem', fontWeight: '700', color: '#1e293b' }}>Create Task</h1>
                <p style={{ margin: '4px 0 0', color: '#64748b' }}>Configure and assign a new locomotive inspection</p>
              </div>
              <button
                onClick={() => setActiveTab('tasks')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'white',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Back to Dashboard
              </button>
            </div>

            <div style={{
              backgroundColor: 'white',
              padding: '40px',
              borderRadius: '20px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              border: '1px solid #f1f5f9'
            }}>
              <div style={{ display: 'grid', gap: '32px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600', color: '#475569', fontSize: '0.9375rem' }}>Select Locomotive</label>
                    <select
                      value={selectedLoco}
                      onChange={(e) => setSelectedLoco(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '14px',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        fontSize: '1rem',
                        backgroundColor: '#f8fafc',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                    >
                      <option value="">-- Select Loco Number --</option>
                      {locos.map(l => (
                        <option key={l.id} value={l.id}>{l.locoNumber}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600', color: '#475569', fontSize: '0.9375rem' }}>Inspection Schedule</label>
                    <select
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '14px',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        fontSize: '1rem',
                        backgroundColor: '#f8fafc',
                        outline: 'none'
                      }}
                    >
                      <option value="">-- Select Published Template --</option>
                      {publishedTemplates.map(t => (
                        <option key={t.id} value={t.id}>{t.name} v{t.version || 1}</option>
                      ))}
                    </select>
                    {publishedTemplates.length === 0 && (
                      <p style={{ margin: '8px 0 0', color: '#ef4444', fontSize: '0.8125rem' }}>
                        Publish a template before creating inspection tasks.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600', color: '#475569', fontSize: '0.9375rem' }}>Priority Level</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                    {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
                      <button
                        key={p}
                        onClick={() => setSelectedPriority(p)}
                        style={{
                          padding: '12px',
                          borderRadius: '10px',
                          border: '2px solid',
                          borderColor: selectedPriority === p ? '#3b82f6' : '#f1f5f9',
                          backgroundColor: selectedPriority === p ? '#eff6ff' : '#f8fafc',
                          color: selectedPriority === p ? '#1e40af' : '#64748b',
                          fontWeight: '700',
                          fontSize: '0.8125rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600', color: '#475569', fontSize: '0.9375rem' }}>Assign Personnel</label>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '12px',
                    padding: '20px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0'
                  }}>
                    {workers.map(w => (
                      <label key={w.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        backgroundColor: selectedWorkers.includes(w.id) ? 'white' : 'transparent',
                        boxShadow: selectedWorkers.includes(w.id) ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 0.2s'
                      }}>
                        <input
                          type="checkbox"
                          checked={selectedWorkers.includes(w.id)}
                          onChange={() => handleWorkerToggle(w.id)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.9375rem', fontWeight: '500', color: '#334155' }}>{w.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  onClick={createTask}
                  disabled={isCreating}
                  style={{
                    width: '100%',
                    padding: '16px',
                    backgroundColor: isCreating ? '#94a3b8' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: isCreating ? 'not-allowed' : 'pointer',
                    fontWeight: '700',
                    fontSize: '1rem',
                    boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.3)',
                    marginTop: '8px'
                  }}
                >
                  {isCreating ? 'Creating Task...' : 'Finalize & Assign Task'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && canViewAnalytics && (
          <div style={{ maxWidth: '1300px', margin: '0 auto', display: 'grid', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '24px', flexWrap: 'wrap' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.875rem', fontWeight: '700', color: '#1e293b' }}>Performance & Analytics</h1>
                <p style={{ margin: '6px 0 0', color: '#64748b' }}>Frontend-derived operational insights from the current task and assignment data.</p>
              </div>
              <button
                onClick={() => {
                  fetchTasks();
                  fetchAssignments();
                }}
                style={{
                  padding: '10px 18px',
                  backgroundColor: 'white',
                  color: '#3b82f6',
                  border: '1px solid #dbeafe',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                Refresh Analytics
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>
              <div style={{ backgroundColor: 'white', borderRadius: '18px', border: '1px solid #dcfce7', padding: '22px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Healthy Locos</div>
                <div style={{ marginTop: '10px', fontSize: '2rem', fontWeight: '800', color: '#166534' }}>{locomotiveHealthSummary.HEALTHY}</div>
              </div>
              <div style={{ backgroundColor: 'white', borderRadius: '18px', border: '1px solid #fde68a', padding: '22px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending Locos</div>
                <div style={{ marginTop: '10px', fontSize: '2rem', fontWeight: '800', color: '#92400e' }}>{locomotiveHealthSummary.PENDING}</div>
              </div>
              <div style={{ backgroundColor: 'white', borderRadius: '18px', border: '1px solid #fecdd3', padding: '22px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#9f1239', textTransform: 'uppercase', letterSpacing: '0.05em' }}>In Rework</div>
                <div style={{ marginTop: '10px', fontSize: '2rem', fontWeight: '800', color: '#9f1239' }}>{locomotiveHealthSummary["IN REWORK"]}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
              <section style={{ backgroundColor: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '24px 28px', borderBottom: '1px solid #e2e8f0' }}>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#1e293b' }}>Locomotive Health</h2>
                  <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '0.9rem' }}>Each locomotive is classified from the current inspection statuses.</p>
                </div>
                <div style={{ display: 'grid' }}>
                  {locomotiveHealth.length === 0 && (
                    <div style={{ padding: '28px', color: '#94a3b8' }}>No locomotive activity available.</div>
                  )}
                  {locomotiveHealth.map((loco, index) => {
                    const color =
                      loco.status === 'HEALTHY' ? { bg: '#ecfdf5', text: '#065f46', border: '#d1fae5' } :
                      loco.status === 'IN REWORK' ? { bg: '#fff1f2', text: '#9f1239', border: '#fecdd3' } :
                      { bg: '#fefce8', text: '#854d0e', border: '#fde68a' };

                    return (
                      <div key={loco.locoNumber} style={{ padding: '18px 28px', borderTop: index === 0 ? 'none' : '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontWeight: '700', color: '#1e293b' }}>Loco {loco.locoNumber}</div>
                          <div style={{ marginTop: '4px', color: '#64748b', fontSize: '0.84rem' }}>
                            {loco.openTasks} open of {loco.totalTasks} inspections
                          </div>
                        </div>
                        <span style={{ padding: '6px 12px', borderRadius: '999px', backgroundColor: color.bg, color: color.text, border: `1px solid ${color.border}`, fontSize: '0.75rem', fontWeight: '700' }}>
                          {loco.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section style={{ backgroundColor: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '24px 28px' }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#1e293b' }}>Task Efficiency</h2>
                <p style={{ margin: '6px 0 20px', color: '#64748b', fontSize: '0.9rem' }}>Based on the current split between completed tasks and tasks presently in rework.</p>

                <div style={{ display: 'grid', gap: '18px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#334155', fontWeight: '600' }}>
                      <span>Completed</span>
                      <span>{firstPassRate}%</span>
                    </div>
                    <div style={{ height: '12px', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${firstPassRate}%`, height: '100%', backgroundColor: '#10b981' }}></div>
                    </div>
                    <div style={{ marginTop: '6px', fontSize: '0.82rem', color: '#64748b' }}>{doneTasks} tasks currently marked done</div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#334155', fontWeight: '600' }}>
                      <span>In Rework</span>
                      <span>{reworkRate}%</span>
                    </div>
                    <div style={{ height: '12px', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${reworkRate}%`, height: '100%', backgroundColor: '#ef4444' }}></div>
                    </div>
                    <div style={{ marginTop: '6px', fontSize: '0.82rem', color: '#64748b' }}>{reworkTasks} tasks currently marked for rework</div>
                  </div>
                </div>
              </section>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
              <section style={{ backgroundColor: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '24px 28px', borderBottom: '1px solid #e2e8f0' }}>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#1e293b' }}>Workforce Utilization</h2>
                  <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '0.9rem' }}>Active assignment counts per worker from the current workload.</p>
                </div>
                <div style={{ display: 'grid' }}>
                  {workforceUtilization.length === 0 && (
                    <div style={{ padding: '28px', color: '#94a3b8' }}>No worker data available.</div>
                  )}
                  {workforceUtilization.map((worker, index) => {
                    const utilizationWidth = workforceUtilization[0]?.activeTasks
                      ? Math.max((worker.activeTasks / workforceUtilization[0].activeTasks) * 100, worker.activeTasks > 0 ? 12 : 0)
                      : 0;

                    return (
                      <div key={worker.id} style={{ padding: '18px 28px', borderTop: index === 0 ? 'none' : '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                          <div style={{ fontWeight: '600', color: '#1e293b' }}>{worker.name}</div>
                          <div style={{ fontSize: '0.84rem', color: worker.activeTasks === 0 ? '#16a34a' : '#475569', fontWeight: '600' }}>
                            {worker.activeTasks === 0 ? 'Available' : `${worker.activeTasks} active tasks`}
                          </div>
                        </div>
                        <div style={{ height: '10px', borderRadius: '999px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${utilizationWidth}%`, backgroundColor: worker.activeTasks === 0 ? '#cbd5e1' : '#3b82f6' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section style={{ backgroundColor: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '24px 28px' }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#1e293b' }}>Priority Summary</h2>
                <p style={{ margin: '6px 0 20px', color: '#64748b', fontSize: '0.9rem' }}>High-level task counts across the current system.</p>

                <div style={{ display: 'grid', gap: '12px' }}>
                  {['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((priority) => {
                    const chipStyle = priorityColors[priority];
                    return (
                      <div key={priority} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderRadius: '14px', backgroundColor: chipStyle.bg, border: `1px solid ${chipStyle.border}` }}>
                        <span style={{ color: chipStyle.text, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: chipStyle.dot }}></span>
                          {priority}
                        </span>
                        <span style={{ color: '#1e293b', fontSize: '1.05rem', fontWeight: '800' }}>{prioritySummary[priority]}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'assignments' && canViewAssignments && (
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.875rem', fontWeight: '700', color: '#1e293b' }}>Workforce Overview</h1>
                <p style={{ margin: '4px 0 0', color: '#64748b' }}>Track active assignments and personnel workload</p>
              </div>
              <button
                onClick={fetchAssignments}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'white',
                  color: '#3b82f6',
                  border: '1px solid #dbeafe',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                Refresh Data
              </button>
            </div>

            <div style={{ display: 'grid', gap: '18px' }}>
              {loadingAssignments && (
                <div style={{ backgroundColor: 'white', borderRadius: '20px', border: '1px solid #f1f5f9', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  Loading assignments...
                </div>
              )}

              {!loadingAssignments && assignmentsByWorker.length === 0 && (
                <div style={{ backgroundColor: 'white', borderRadius: '20px', border: '1px solid #f1f5f9', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  No worker records available.
                </div>
              )}

              {!loadingAssignments && assignmentsByWorker.map((worker) => {
                const isExpanded = expandedWorkers.includes(worker.id);

                return (
                  <section
                    key={worker.id}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '20px',
                      border: '1px solid #e2e8f0',
                      overflow: 'hidden',
                      boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)'
                    }}
                  >
                    <button
                      onClick={() => toggleWorkerSection(worker.id)}
                      style={{
                        width: '100%',
                        padding: '22px 26px',
                        border: 'none',
                        backgroundColor: '#f8fafc',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '20px',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', fontWeight: '800', color: '#475569' }}>
                          {worker.name?.charAt(0) || "?"}
                        </div>
                        <div style={{ display: 'grid', gap: '4px' }}>
                          <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '1rem' }}>{worker.name}</div>
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '0.84rem', color: '#64748b' }}>
                            <span>{worker.assignments.length} assignments</span>
                            <span>{worker.activeTasks} active tasks</span>
                            {worker.assignments.length === 0 && <span style={{ color: '#16a34a', fontWeight: '600' }}>Available</span>}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {Object.entries(worker.statusCounts).map(([status, count]) => {
                          const chipStyle = statusColors[status] || statusColors.CREATED;
                          return (
                            <span
                              key={status}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '999px',
                                fontSize: '0.72rem',
                                fontWeight: '700',
                                backgroundColor: chipStyle.bg,
                                color: chipStyle.text,
                                border: `1px solid ${chipStyle.border || '#e2e8f0'}`
                              }}
                            >
                              {status} {count}
                            </span>
                          );
                        })}
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#64748b"
                          strokeWidth="2"
                          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}
                        >
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </div>
                    </button>

                    {isExpanded && (
                      <div style={{ padding: worker.assignments.length === 0 ? '0 26px 22px' : '0' }}>
                        {worker.assignments.length === 0 ? (
                          <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '14px', color: '#94a3b8', fontSize: '0.9rem' }}>
                            No assignments currently mapped to this worker.
                          </div>
                        ) : (
                          worker.assignments.map((assignment: any, index: number) => {
                            const chipStyle = statusColors[assignment.taskStatus] || statusColors.CREATED;
                            const assignmentEvents = getAssignmentEventsForWorker(assignment);
                            const isHistoryExpanded = expandedAssignmentHistory.includes(assignment.id);

                            return (
                              <div
                                key={assignment.id}
                                style={{
                                  padding: '18px 26px',
                                  borderTop: index === 0 ? '1px solid #e2e8f0' : '1px solid #f1f5f9',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  flexWrap: 'wrap',
                                  gap: '16px',
                                  alignItems: 'center'
                                }}
                              >
                                <div style={{ minWidth: '180px' }}>
                                  <div style={{ fontWeight: '700', color: '#1e293b' }}>Loco {assignment.locoNumber || 'Unknown'}</div>
                                  <div style={{ marginTop: '4px', color: '#64748b', fontSize: '0.84rem' }}>{assignment.inspectionType}</div>
                                </div>

                                <div style={{ color: '#64748b', fontSize: '0.84rem', flex: '1 1 220px' }}>
                                  <div>Assigned at: <span style={{ color: '#334155', fontWeight: '700' }}>{formatDateTime(assignment.createdAt || assignment.taskCreatedAt)}</span></div>
                                  <div style={{ marginTop: '4px' }}>Task created: <span style={{ color: '#334155', fontWeight: '600' }}>{formatDateTime(assignment.taskCreatedAt)}</span></div>
                                  <button
                                    onClick={() => toggleAssignmentHistory(assignment.id)}
                                    style={{
                                      marginTop: '8px',
                                      padding: 0,
                                      border: 'none',
                                      background: 'transparent',
                                      color: '#3b82f6',
                                      cursor: 'pointer',
                                      fontWeight: '700',
                                      fontSize: '0.82rem'
                                    }}
                                  >
                                    {isHistoryExpanded ? 'Hide history' : `History (${assignmentEvents.length})`}
                                  </button>
                                </div>

                                <div style={{ marginLeft: 'auto' }}>
                                  <span
                                    style={{
                                      padding: '6px 12px',
                                      borderRadius: '8px',
                                      fontSize: '0.75rem',
                                      fontWeight: '700',
                                      backgroundColor: chipStyle.bg,
                                      color: chipStyle.text,
                                      border: `1px solid ${chipStyle.border || '#e2e8f0'}`
                                    }}
                                  >
                                    {assignment.taskStatus}
                                  </span>
                                </div>

                                {isHistoryExpanded && (
                                  <div style={{ flexBasis: '100%', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '12px 14px' }}>
                                    {assignmentEvents.length === 0 && (
                                      <div style={{ color: '#94a3b8', fontSize: '0.84rem' }}>No assignment history recorded.</div>
                                    )}
                                    {assignmentEvents.map((event: any) => (
                                      <div key={event.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '6px 0', color: '#475569', fontSize: '0.84rem' }}>
                                        <span style={{ fontWeight: '700', color: event.eventType === 'ASSIGNED' ? '#065f46' : '#9f1239' }}>
                                          {event.eventType === 'ASSIGNED' ? 'Assigned' : 'Unassigned'}
                                        </span>
                                        <span>{formatDateTime(event.createdAt)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'loco-history' && canViewLocoHistory && (
          <div style={{ maxWidth: '1300px', margin: '0 auto', display: 'grid', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '24px', flexWrap: 'wrap' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.875rem', fontWeight: '700', color: '#1e293b' }}>Loco History</h1>
                <p style={{ margin: '6px 0 0', color: '#64748b' }}>Timeline of status changes, assignments, and inspection activity for one locomotive.</p>
              </div>
              <select
                value={selectedHistoryLocoId}
                onChange={(e) => setSelectedHistoryLocoId(e.target.value)}
                style={{ minWidth: '260px', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: 'white', fontWeight: '600', color: '#334155' }}
              >
                <option value="">Select locomotive</option>
                {locos.map((loco) => (
                  <option key={loco.id} value={loco.id}>Loco {loco.locoNumber}</option>
                ))}
              </select>
            </div>

            {!selectedHistoryLocoId && (
              <div style={{ backgroundColor: 'white', borderRadius: '18px', border: '1px dashed #cbd5e1', padding: '50px', textAlign: 'center', color: '#94a3b8' }}>
                Select a locomotive to review its full activity timeline.
              </div>
            )}

            {loadingHistory && (
              <div style={{ backgroundColor: 'white', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '28px', color: '#64748b' }}>Loading history...</div>
            )}

            {!loadingHistory && locoHistory && (
              <div style={{ display: 'grid', gap: '18px' }}>
                <section style={{ backgroundColor: 'white', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '24px 28px' }}>
                  <h2 style={{ margin: 0, color: '#1e293b' }}>Loco {locoHistory.loco?.locoNumber}</h2>
                  <p style={{ margin: '6px 0 0', color: '#64748b' }}>{locoHistory.tasks?.length || 0} task records · {locoHistory.timeline?.length || 0} timeline events</p>
                </section>

                <section style={{ backgroundColor: 'white', borderRadius: '18px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  {(locoHistory.timeline || []).length === 0 && (
                    <div style={{ padding: '28px', color: '#94a3b8' }}>No history events recorded for this locomotive.</div>
                  )}
                  {(locoHistory.timeline || []).map((event: any, index: number) => {
                    const chipColor = event.type === "STATUS" ? '#eff6ff' : event.type === "ASSIGNMENT" ? '#fefce8' : '#ecfdf5';
                    const textColor = event.type === "STATUS" ? '#1e40af' : event.type === "ASSIGNMENT" ? '#854d0e' : '#065f46';
                    return (
                      <div key={`${event.type}-${event.id}`} style={{ padding: '18px 28px', borderTop: index === 0 ? 'none' : '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', gap: '18px', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <span style={{ padding: '5px 10px', borderRadius: '999px', backgroundColor: chipColor, color: textColor, fontSize: '0.72rem', fontWeight: '800' }}>{event.type}</span>
                            <strong style={{ color: '#1e293b' }}>{event.title}</strong>
                          </div>
                          <div style={{ marginTop: '6px', color: '#64748b', fontSize: '0.9rem' }}>{event.description}</div>
                          {event.actorName && <div style={{ marginTop: '4px', color: '#94a3b8', fontSize: '0.82rem' }}>Actor: {event.actorName}</div>}
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.84rem', fontWeight: '700' }}>{formatDateTime(event.createdAt)}</div>
                      </div>
                    );
                  })}
                </section>
              </div>
            )}
          </div>
        )}

        {activeTab === 'schedules' && canManageSchedules && (
          <div style={{ maxWidth: '1300px', margin: '0 auto', display: 'grid', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '24px', flexWrap: 'wrap' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.875rem', fontWeight: '700', color: '#1e293b' }}>Recurring Schedules</h1>
                <p style={{ margin: '6px 0 0', color: '#64748b' }}>Create daily, weekly, or monthly inspection schedules and manually generate due tasks.</p>
              </div>
              <button
                onClick={generateDueSchedules}
                disabled={scheduleAction === "generate-due"}
                style={{ padding: '11px 18px', borderRadius: '10px', border: 'none', backgroundColor: scheduleAction === "generate-due" ? '#94a3b8' : '#10b981', color: 'white', cursor: scheduleAction === "generate-due" ? 'not-allowed' : 'pointer', fontWeight: '800' }}
              >
                {scheduleAction === "generate-due" ? "Generating..." : "Generate Due Tasks"}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '380px minmax(0, 1fr)', gap: '24px', alignItems: 'start' }}>
              <section style={{ backgroundColor: 'white', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '24px' }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>New Schedule</h2>
                <div style={{ display: 'grid', gap: '14px', marginTop: '18px' }}>
                  <select value={newSchedule.locoId} onChange={(e) => setNewSchedule((current) => ({ ...current, locoId: e.target.value }))} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: 'white' }}>
                    <option value="">Select loco</option>
                    {locos.map((loco) => <option key={loco.id} value={loco.id}>Loco {loco.locoNumber}</option>)}
                  </select>
                  <select value={newSchedule.templateId} onChange={(e) => setNewSchedule((current) => ({ ...current, templateId: e.target.value }))} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: 'white' }}>
                    <option value="">Select published template</option>
                    {publishedTemplates.map((template) => <option key={template.id} value={template.id}>{template.name} v{template.version || 1}</option>)}
                  </select>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <select value={newSchedule.frequency} onChange={(e) => setNewSchedule((current) => ({ ...current, frequency: e.target.value }))} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: 'white' }}>
                      <option value="DAILY">Daily</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                    </select>
                    <select value={newSchedule.priority} onChange={(e) => setNewSchedule((current) => ({ ...current, priority: e.target.value }))} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: 'white' }}>
                      {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                    </select>
                  </div>
                  <input
                    type="datetime-local"
                    value={newSchedule.nextRunAt}
                    onChange={(e) => setNewSchedule((current) => ({ ...current, nextRunAt: e.target.value }))}
                    style={{ padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                  />
                  <div style={{ padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'grid', gap: '8px', maxHeight: '170px', overflowY: 'auto' }}>
                    {workers.map((worker) => (
                      <label key={worker.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155', fontWeight: '600' }}>
                        <input type="checkbox" checked={newSchedule.workerIds.includes(worker.id)} onChange={() => toggleScheduleWorker(worker.id)} />
                        {worker.name}
                      </label>
                    ))}
                  </div>
                  <button onClick={createSchedule} disabled={scheduleAction === "create-schedule"} style={{ padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: scheduleAction === "create-schedule" ? '#94a3b8' : '#3b82f6', color: 'white', cursor: scheduleAction === "create-schedule" ? 'not-allowed' : 'pointer', fontWeight: '800' }}>
                    {scheduleAction === "create-schedule" ? "Creating..." : "Create Schedule"}
                  </button>
                </div>
              </section>

              <section style={{ backgroundColor: 'white', borderRadius: '18px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '22px 26px', borderBottom: '1px solid #e2e8f0' }}>
                  <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.1rem' }}>Schedule Library</h2>
                  <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: '0.88rem' }}>{schedules.length} schedules configured</p>
                </div>
                {loadingSchedules && <div style={{ padding: '28px', color: '#64748b' }}>Loading schedules...</div>}
                {!loadingSchedules && schedules.length === 0 && <div style={{ padding: '28px', color: '#94a3b8' }}>No recurring schedules created yet.</div>}
                {!loadingSchedules && schedules.map((schedule, index) => (
                  <div key={schedule.id} style={{ padding: '18px 26px', borderTop: index === 0 ? 'none' : '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', gap: '18px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ color: '#1e293b', fontWeight: '800' }}>Loco {schedule.loco?.locoNumber} · {schedule.template?.name}</div>
                      <div style={{ marginTop: '5px', color: '#64748b', fontSize: '0.86rem' }}>{schedule.frequency} · {schedule.priority} · Next: {formatDateTime(schedule.nextRunAt)}</div>
                      <div style={{ marginTop: '5px', color: '#94a3b8', fontSize: '0.82rem' }}>{(schedule.workers || []).map((entry: any) => entry.worker?.name).join(", ")}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ padding: '5px 10px', borderRadius: '999px', backgroundColor: schedule.active ? '#ecfdf5' : '#f8fafc', color: schedule.active ? '#065f46' : '#64748b', border: `1px solid ${schedule.active ? '#d1fae5' : '#e2e8f0'}`, fontWeight: '800', fontSize: '0.72rem' }}>{schedule.active ? 'ACTIVE' : 'INACTIVE'}</span>
                      {schedule.active && (
                        <button onClick={() => deactivateSchedule(schedule.id)} disabled={scheduleAction === `deactivate-${schedule.id}`} style={{ padding: '8px 12px', borderRadius: '9px', border: '1px solid #fecaca', backgroundColor: '#fff1f2', color: '#9f1239', cursor: 'pointer', fontWeight: '700' }}>
                          Deactivate
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </section>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && canViewNotifications && (
          <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'grid', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '24px', flexWrap: 'wrap' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.875rem', fontWeight: '700', color: '#1e293b' }}>Notifications</h1>
                <p style={{ margin: '6px 0 0', color: '#64748b' }}>{unreadNotifications} unread workflow alerts.</p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={fetchNotifications} style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #dbeafe', backgroundColor: 'white', color: '#3b82f6', cursor: 'pointer', fontWeight: '700' }}>Refresh</button>
                <button onClick={markAllNotificationsRead} style={{ padding: '10px 16px', borderRadius: '10px', border: 'none', backgroundColor: '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: '700' }}>Mark all read</button>
              </div>
            </div>

            <section style={{ backgroundColor: 'white', borderRadius: '18px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              {loadingNotifications && <div style={{ padding: '28px', color: '#64748b' }}>Loading notifications...</div>}
              {!loadingNotifications && notifications.length === 0 && <div style={{ padding: '28px', color: '#94a3b8' }}>No notifications yet.</div>}
              {!loadingNotifications && notifications.map((notification, index) => (
                <div key={notification.id} style={{ padding: '18px 26px', borderTop: index === 0 ? 'none' : '1px solid #f1f5f9', backgroundColor: notification.read ? 'white' : '#eff6ff', display: 'flex', justifyContent: 'space-between', gap: '18px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ color: '#1e293b', fontWeight: '800' }}>{notification.title}</div>
                    <div style={{ marginTop: '5px', color: '#64748b', fontSize: '0.9rem' }}>{notification.message}</div>
                    <div style={{ marginTop: '5px', color: '#94a3b8', fontSize: '0.8rem' }}>{notification.type} · {formatDateTime(notification.createdAt)}</div>
                  </div>
                  {!notification.read && (
                    <button onClick={() => markNotificationRead(notification.id)} style={{ alignSelf: 'center', padding: '8px 12px', borderRadius: '9px', border: '1px solid #dbeafe', backgroundColor: 'white', color: '#1e40af', cursor: 'pointer', fontWeight: '700' }}>
                      Mark read
                    </button>
                  )}
                </div>
              ))}
            </section>
          </div>
        )}

        {activeTab === 'exports' && canExportData && (
          <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'grid', gap: '24px' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.875rem', fontWeight: '700', color: '#1e293b' }}>CSV Exports</h1>
              <p style={{ margin: '6px 0 0', color: '#64748b' }}>Download backend-generated CSV files that open cleanly in Excel.</p>
            </div>

            <section style={{ backgroundColor: 'white', borderRadius: '18px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              {[
                { title: "Tasks", text: "All tasks with loco, status, priority, and assigned workers.", path: "/exports/tasks.csv", file: "tasks.csv" },
                { title: "Assignments", text: "Current assignment rows with worker, task, loco, and assignment time.", path: "/exports/assignments.csv", file: "assignments.csv" },
                { title: "Schedules", text: "Recurring schedules, assigned workers, next run dates, and active state.", path: "/exports/schedules.csv", file: "schedules.csv" },
                { title: "Loco History", text: "Status, assignment, and inspection timeline rows across locomotives.", path: "/exports/loco-history.csv", file: "loco-history.csv" }
              ].map((exportItem, index) => (
                <div key={exportItem.path} style={{ padding: '20px 26px', borderTop: index === 0 ? 'none' : '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', gap: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ color: '#1e293b', fontWeight: '800' }}>{exportItem.title}</div>
                    <div style={{ marginTop: '5px', color: '#64748b', fontSize: '0.9rem' }}>{exportItem.text}</div>
                  </div>
                  <button onClick={() => downloadExport(exportItem.path, exportItem.file)} style={{ padding: '10px 16px', borderRadius: '10px', border: 'none', backgroundColor: '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: '800' }}>
                    Download CSV
                  </button>
                </div>
              ))}
            </section>
          </div>
        )}

        {activeTab === 'user-master' && canManageUserMaster && (
          <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '24px', flexWrap: 'wrap' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.875rem', fontWeight: '700', color: '#1e293b' }}>User Master</h1>
                <p style={{ margin: '6px 0 0', color: '#64748b' }}>Create users and maintain department assignments. Admin access only.</p>
              </div>
              <button
                onClick={fetchUserMasterUsers}
                style={{
                  padding: '10px 18px',
                  backgroundColor: 'white',
                  color: '#3b82f6',
                  border: '1px solid #dbeafe',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: '700'
                }}
              >
                Refresh Users
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '360px minmax(0, 1fr)', gap: '24px', alignItems: 'start' }}>
              <section style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px' }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>Add User</h2>
                <p style={{ margin: '6px 0 20px', color: '#64748b', fontSize: '0.9rem' }}>Department is stored separately from role and can be changed later.</p>

                <div style={{ display: 'grid', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', color: '#475569', fontWeight: '700', fontSize: '0.88rem' }}>Full Name</label>
                    <input
                      value={newUserMasterName}
                      onChange={(e) => setNewUserMasterName(e.target.value)}
                      placeholder="e.g. Inspector One"
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        boxSizing: 'border-box',
                        fontSize: '0.95rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', color: '#475569', fontWeight: '700', fontSize: '0.88rem' }}>Role</label>
                    <select
                      value={newUserMasterRole}
                      onChange={(e) => setNewUserMasterRole(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        boxSizing: 'border-box',
                        backgroundColor: 'white',
                        fontSize: '0.95rem'
                      }}
                    >
                      <option value="WORKER">Worker</option>
                      <option value="SUPERVISOR">Supervisor</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', color: '#475569', fontWeight: '700', fontSize: '0.88rem' }}>Department</label>
                    <input
                      value={newUserMasterDepartment}
                      onChange={(e) => setNewUserMasterDepartment(e.target.value)}
                      placeholder="e.g. Mechanical"
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        boxSizing: 'border-box',
                        fontSize: '0.95rem'
                      }}
                    />
                  </div>

                  <button
                    onClick={createUserMasterUser}
                    disabled={userMasterAction === "create-user" || !newUserMasterName.trim()}
                    style={{
                      padding: '13px 16px',
                      border: 'none',
                      borderRadius: '10px',
                      backgroundColor: userMasterAction === "create-user" || !newUserMasterName.trim() ? '#94a3b8' : '#3b82f6',
                      color: 'white',
                      cursor: userMasterAction === "create-user" || !newUserMasterName.trim() ? 'not-allowed' : 'pointer',
                      fontWeight: '800'
                    }}
                  >
                    {userMasterAction === "create-user" ? "Creating..." : "Create User"}
                  </button>
                </div>
              </section>

              <section style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '22px 26px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>Users</h2>
                    <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: '0.88rem' }}>{userMasterCounts.ADMIN || 0} admins · {userMasterCounts.SUPERVISOR || 0} supervisors · {userMasterCounts.WORKER || 0} workers</p>
                  </div>
                  <span style={{ padding: '6px 12px', borderRadius: '999px', backgroundColor: '#eff6ff', color: '#1e40af', border: '1px solid #dbeafe', fontWeight: '800', fontSize: '0.75rem' }}>
                    Admin only
                  </span>
                </div>

                {loadingUserMaster && (
                  <div style={{ padding: '28px', color: '#64748b' }}>Loading users...</div>
                )}

                {!loadingUserMaster && userMasterUsers.length === 0 && (
                  <div style={{ padding: '28px', color: '#94a3b8' }}>No users found.</div>
                )}

                {!loadingUserMaster && userMasterUsers.map((masterUser, index) => {
                  const roleTone = masterUser.role === "ADMIN"
                    ? { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' }
                    : masterUser.role === "SUPERVISOR"
                      ? { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' }
                      : { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' };
                  const draftDepartment = userDepartmentDrafts[masterUser.id] ?? masterUser.department ?? "";
                  const unchanged = draftDepartment.trim() === (masterUser.department || "");
                  const isSaving = userMasterAction === `department-${masterUser.id}`;

                  return (
                    <div
                      key={masterUser.id}
                      style={{
                        padding: '18px 26px',
                        borderTop: index === 0 ? 'none' : '1px solid #f1f5f9',
                        display: 'grid',
                        gridTemplateColumns: 'minmax(220px, 1.2fr) 130px minmax(220px, 1fr) auto',
                        gap: '16px',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '12px',
                          backgroundColor: roleTone.bg,
                          color: roleTone.text,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '900',
                          flex: '0 0 auto'
                        }}>
                          {masterUser.name?.charAt(0) || 'U'}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: '800', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{masterUser.name}</div>
                          <div style={{ marginTop: '3px', color: '#64748b', fontSize: '0.84rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{masterUser.email || 'No email recorded'}</div>
                        </div>
                      </div>

                      <span style={{
                        justifySelf: 'start',
                        padding: '6px 12px',
                        borderRadius: '999px',
                        backgroundColor: roleTone.bg,
                        color: roleTone.text,
                        border: `1px solid ${roleTone.border}`,
                        fontWeight: '800',
                        fontSize: '0.72rem'
                      }}>
                        {masterUser.role}
                      </span>

                      <input
                        value={draftDepartment}
                        onChange={(e) => setUserDepartmentDrafts((prev) => ({ ...prev, [masterUser.id]: e.target.value }))}
                        placeholder="Unassigned"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: '1px solid #cbd5e1',
                          boxSizing: 'border-box',
                          minWidth: 0
                        }}
                      />

                      <button
                        onClick={() => updateUserDepartment(masterUser)}
                        disabled={isSaving || unchanged}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: '1px solid #dbeafe',
                          backgroundColor: isSaving || unchanged ? '#f8fafc' : '#eff6ff',
                          color: isSaving || unchanged ? '#94a3b8' : '#1e40af',
                          cursor: isSaving || unchanged ? 'not-allowed' : 'pointer',
                          fontWeight: '800',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </button>
                    </div>
                  );
                })}
              </section>
            </div>
          </div>
        )}

        {activeTab === 'staff' && canManageStaff && (
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '24px', flexWrap: 'wrap' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.875rem', fontWeight: '700', color: '#1e293b' }}>Staff Management</h1>
                <p style={{ margin: '6px 0 0', color: '#64748b' }}>Create supervisor and worker accounts for the inspection system.</p>
              </div>
              <button
                onClick={fetchStaffUsers}
                style={{
                  padding: '10px 18px',
                  backgroundColor: 'white',
                  color: '#3b82f6',
                  border: '1px solid #dbeafe',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Refresh Staff
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '360px minmax(0, 1fr)', gap: '24px', alignItems: 'start' }}>
              <section style={{ backgroundColor: 'white', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '24px' }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>Add Staff User</h2>
                <p style={{ margin: '6px 0 20px', color: '#64748b', fontSize: '0.9rem' }}>Admin-only account creation for operational staff.</p>

                <div style={{ display: 'grid', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', color: '#475569', fontWeight: '700', fontSize: '0.88rem' }}>Full Name</label>
                    <input
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                      placeholder="e.g. Supervisor One"
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        boxSizing: 'border-box',
                        fontSize: '0.95rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', color: '#475569', fontWeight: '700', fontSize: '0.88rem' }}>Role</label>
                    <select
                      value={newStaffRole}
                      onChange={(e) => setNewStaffRole(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        boxSizing: 'border-box',
                        backgroundColor: 'white',
                        fontSize: '0.95rem'
                      }}
                    >
                      <option value="WORKER">Worker</option>
                      <option value="SUPERVISOR">Supervisor</option>
                    </select>
                  </div>

                  <button
                    onClick={createStaffUser}
                    disabled={staffAction === "create-staff" || !newStaffName.trim()}
                    style={{
                      padding: '13px 16px',
                      border: 'none',
                      borderRadius: '10px',
                      backgroundColor: staffAction === "create-staff" || !newStaffName.trim() ? '#94a3b8' : '#3b82f6',
                      color: 'white',
                      cursor: staffAction === "create-staff" || !newStaffName.trim() ? 'not-allowed' : 'pointer',
                      fontWeight: '800'
                    }}
                  >
                    {staffAction === "create-staff" ? "Creating..." : "Create Staff User"}
                  </button>
                </div>
              </section>

              <section style={{ backgroundColor: 'white', borderRadius: '18px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '22px 26px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>Current Staff</h2>
                    <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: '0.88rem' }}>{supervisorCount} supervisors · {workerCount} workers</p>
                  </div>
                  <span style={{ padding: '6px 12px', borderRadius: '999px', backgroundColor: '#eff6ff', color: '#1e40af', border: '1px solid #dbeafe', fontWeight: '800', fontSize: '0.75rem' }}>
                    Admin only
                  </span>
                </div>

                {loadingStaff && (
                  <div style={{ padding: '28px', color: '#64748b' }}>Loading staff users...</div>
                )}

                {!loadingStaff && staffUsers.length === 0 && (
                  <div style={{ padding: '28px', color: '#94a3b8' }}>No supervisor or worker accounts found.</div>
                )}

                {!loadingStaff && staffUsers.map((staffUser, index) => {
                  const isSupervisor = staffUser.role === "SUPERVISOR";
                  return (
                    <div
                      key={staffUser.id}
                      style={{
                        padding: '18px 26px',
                        borderTop: index === 0 ? 'none' : '1px solid #f1f5f9',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '18px',
                        flexWrap: 'wrap'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '12px',
                          backgroundColor: isSupervisor ? '#eff6ff' : '#f0fdf4',
                          color: isSupervisor ? '#1e40af' : '#166534',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '900'
                        }}>
                          {staffUser.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div style={{ fontWeight: '800', color: '#1e293b' }}>{staffUser.name}</div>
                          <div style={{ marginTop: '3px', color: '#64748b', fontSize: '0.84rem' }}>{staffUser.email || 'No email recorded'}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                        <span style={{
                          padding: '6px 12px',
                          borderRadius: '999px',
                          backgroundColor: isSupervisor ? '#eff6ff' : '#f0fdf4',
                          color: isSupervisor ? '#1e40af' : '#166534',
                          border: `1px solid ${isSupervisor ? '#bfdbfe' : '#bbf7d0'}`,
                          fontWeight: '800',
                          fontSize: '0.72rem'
                        }}>
                          {staffUser.role}
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                          Created {formatDateTime(staffUser.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </section>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: 'white', padding: '40px', borderRadius: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ width: '100px', height: '100px', backgroundColor: '#3b82f6', borderRadius: '30px', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', color: 'white', fontWeight: 'bold' }}>
                {user?.name?.charAt(0)}
              </div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b' }}>{user?.name}</h2>
              <p style={{ color: '#64748b', margin: '4px 0 0' }}>{role}</p>
            </div>
            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700', marginBottom: '4px' }}>Email Address</div>
                <div style={{ color: '#1e293b', fontWeight: '500' }}>{user?.email || 'Not provided'}</div>
              </div>
              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700', marginBottom: '4px' }}>Employee ID</div>
                <div style={{ color: '#1e293b', fontWeight: '500' }}>{userId}</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: 'white', padding: '40px', borderRadius: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            <h2 style={{ marginTop: 0, color: '#1e293b' }}>Settings</h2>
            <div style={{ color: '#64748b' }}>Configuration options and system preferences will be available soon.</div>
          </div>
        )}

        {activeTab === 'templates-view' && canViewTemplates && (
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ marginBottom: '32px' }}>
              <h1 style={{ margin: 0, fontSize: '1.875rem', fontWeight: '700', color: '#1e293b' }}>Inspection Template Builder</h1>
              <p style={{ margin: '4px 0 0', color: '#64748b' }}>Create draft templates, publish stable versions, and duplicate published templates before editing.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '360px minmax(0, 1fr)', gap: '24px', alignItems: 'start' }}>
              <aside style={{ display: 'grid', gap: '18px' }}>
                <div style={{ backgroundColor: 'white', borderRadius: '18px', padding: '22px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', marginBottom: '10px', fontWeight: '700', color: '#334155', fontSize: '0.9rem' }}>New Template Draft</label>
                  <input
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="e.g. WAP7 Brake Inspection"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      boxSizing: 'border-box',
                      fontSize: '0.95rem',
                      marginBottom: '12px'
                    }}
                  />
                  <button
                    onClick={createTemplateDraft}
                    disabled={!canManageTemplates || templateAction === "create-template"}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: 'none',
                      borderRadius: '10px',
                      backgroundColor: canManageTemplates ? '#3b82f6' : '#94a3b8',
                      color: 'white',
                      cursor: canManageTemplates ? 'pointer' : 'not-allowed',
                      fontWeight: '700'
                    }}
                  >
                    {!canManageTemplates ? "Access restricted" : templateAction === "create-template" ? "Creating..." : "Create Draft"}
                  </button>
                </div>

                <div style={{ backgroundColor: 'white', borderRadius: '18px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div style={{ padding: '18px 22px', borderBottom: '1px solid #e2e8f0' }}>
                    <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1rem' }}>Template Library</h2>
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.82rem' }}>
                      {loadingTemplates ? "Loading templates..." : `${templates.length} template versions`}
                    </p>
                  </div>

                  <div style={{ display: 'grid' }}>
                    {templateLoadError && (
                      <div style={{ padding: '22px', color: '#9f1239', backgroundColor: '#fff1f2', borderBottom: '1px solid #fecdd3', fontSize: '0.9rem' }}>
                        {templateLoadError}
                      </div>
                    )}
                    {!loadingTemplates && !templateLoadError && templates.length === 0 && (
                      <div style={{ padding: '22px', color: '#94a3b8', fontSize: '0.9rem' }}>No templates created yet.</div>
                    )}
                    {templates.map((template) => {
                      const status = template.status || "PUBLISHED";
                      const chipStyle = templateStatusStyle[status] || templateStatusStyle.PUBLISHED;
                      const isSelected = viewTemplateId === template.id;

                      return (
                        <button
                          key={template.id}
                          onClick={() => {
                            setViewTemplateId(template.id);
                            setExpandedSections((template.sections || []).map((section: any) => section.id));
                          }}
                          style={{
                            border: 'none',
                            borderTop: '1px solid #f1f5f9',
                            backgroundColor: isSelected ? '#eff6ff' : 'white',
                            padding: '16px 22px',
                            cursor: 'pointer',
                            textAlign: 'left'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ color: '#1e293b', fontWeight: '700', fontSize: '0.95rem' }}>{template.name}</div>
                              <div style={{ marginTop: '4px', color: '#64748b', fontSize: '0.8rem' }}>
                                v{template.version || 1} • {template.sections?.length || 0} sections
                              </div>
                            </div>
                            <span style={{ padding: '4px 8px', borderRadius: '999px', backgroundColor: chipStyle.bg, color: chipStyle.text, border: `1px solid ${chipStyle.border}`, fontSize: '0.68rem', fontWeight: '800' }}>
                              {status}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </aside>

              <main>
                {!selectedTemplateForBuilder && (
                  <div style={{ backgroundColor: 'white', border: '1px dashed #cbd5e1', borderRadius: '18px', padding: '70px 40px', textAlign: 'center', color: '#64748b' }}>
                    Select a template version or create a new draft to start building.
                  </div>
                )}

                {selectedTemplateForBuilder && (() => {
                  const status = selectedTemplateForBuilder.status || "PUBLISHED";
                  const isDraft = status === "DRAFT";
                  const statusStyle = templateStatusStyle[status] || templateStatusStyle.PUBLISHED;

                  return (
                    <div style={{ display: 'grid', gap: '20px' }}>
                      <div style={{ backgroundColor: 'white', borderRadius: '18px', padding: '26px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' }}>
                          <div style={{ flex: '1 1 360px' }}>
                            {isDraft ? (
                              <input
                                value={templateNameDrafts[selectedTemplateForBuilder.id] ?? selectedTemplateForBuilder.name}
                                onChange={(e) => setTemplateNameDrafts((prev) => ({ ...prev, [selectedTemplateForBuilder.id]: e.target.value }))}
                                style={{
                                  width: '100%',
                                  padding: '12px 14px',
                                  borderRadius: '10px',
                                  border: '1px solid #cbd5e1',
                                  boxSizing: 'border-box',
                                  fontSize: '1.2rem',
                                  fontWeight: '700',
                                  color: '#1e293b'
                                }}
                              />
                            ) : (
                              <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.35rem' }}>{selectedTemplateForBuilder.name}</h2>
                            )}
                            <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                              <span style={{ padding: '5px 10px', borderRadius: '999px', backgroundColor: statusStyle.bg, color: statusStyle.text, border: `1px solid ${statusStyle.border}`, fontSize: '0.72rem', fontWeight: '800' }}>
                                {status}
                              </span>
                              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Version {selectedTemplateForBuilder.version || 1}</span>
                              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{selectedTemplateForBuilder.sections?.length || 0} sections</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {isDraft && (
                              <>
                                <button
                                  onClick={() => updateTemplateName(selectedTemplateForBuilder.id, selectedTemplateForBuilder.name)}
                                  disabled={!canManageTemplates || templateAction === `template-name-${selectedTemplateForBuilder.id}`}
                                  style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #dbeafe', backgroundColor: canManageTemplates ? '#eff6ff' : '#f1f5f9', color: canManageTemplates ? '#1e40af' : '#94a3b8', cursor: canManageTemplates ? 'pointer' : 'not-allowed', fontWeight: '700' }}
                                >
                                  {canManageTemplates ? "Save Name" : "Access restricted"}
                                </button>
                                <button
                                  onClick={() => publishTemplate(selectedTemplateForBuilder.id)}
                                  disabled={!canManageTemplates || templateAction === `publish-${selectedTemplateForBuilder.id}`}
                                  style={{ padding: '10px 14px', borderRadius: '10px', border: 'none', backgroundColor: canManageTemplates ? '#10b981' : '#94a3b8', color: 'white', cursor: canManageTemplates ? 'pointer' : 'not-allowed', fontWeight: '700' }}
                                >
                                  {!canManageTemplates ? "Access restricted" : templateAction === `publish-${selectedTemplateForBuilder.id}` ? "Publishing..." : "Publish"}
                                </button>
                              </>
                            )}
                            {!isDraft && (
                              <button
                                onClick={() => duplicateTemplateDraft(selectedTemplateForBuilder.id)}
                                disabled={!canManageTemplates || templateAction === `duplicate-${selectedTemplateForBuilder.id}`}
                                style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #dbeafe', backgroundColor: canManageTemplates ? '#eff6ff' : '#f1f5f9', color: canManageTemplates ? '#1e40af' : '#94a3b8', cursor: canManageTemplates ? 'pointer' : 'not-allowed', fontWeight: '700' }}
                              >
                                {!canManageTemplates ? "Access restricted" : templateAction === `duplicate-${selectedTemplateForBuilder.id}` ? "Duplicating..." : "Duplicate Draft"}
                              </button>
                            )}
                            <button
                              onClick={() => archiveTemplate(selectedTemplateForBuilder.id)}
                              disabled={!canPerformDestructiveTemplateActions || templateAction === `archive-${selectedTemplateForBuilder.id}`}
                              style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #fecaca', backgroundColor: canPerformDestructiveTemplateActions ? '#fff1f2' : '#f8fafc', color: canPerformDestructiveTemplateActions ? '#9f1239' : '#94a3b8', cursor: canPerformDestructiveTemplateActions ? 'pointer' : 'not-allowed', fontWeight: '700' }}
                            >
                              {canPerformDestructiveTemplateActions ? "Archive" : "Admin only"}
                            </button>
                          </div>
                        </div>
                      </div>

                      {isDraft && (
                        <div style={{ backgroundColor: 'white', borderRadius: '18px', padding: '20px 22px', border: '1px solid #e2e8f0', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <input
                            value={sectionNameDrafts[selectedTemplateForBuilder.id] || ""}
                            onChange={(e) => setSectionNameDrafts((prev) => ({ ...prev, [selectedTemplateForBuilder.id]: e.target.value }))}
                            placeholder="New section name"
                            style={{ flex: '1 1 260px', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                          />
                          <button
                            onClick={() => addSectionToTemplate(selectedTemplateForBuilder.id)}
                            disabled={!canManageTemplates || templateAction === `section-create-${selectedTemplateForBuilder.id}`}
                            style={{ padding: '12px 16px', borderRadius: '10px', border: 'none', backgroundColor: canManageTemplates ? '#3b82f6' : '#94a3b8', color: 'white', cursor: canManageTemplates ? 'pointer' : 'not-allowed', fontWeight: '700' }}
                          >
                            {canManageTemplates ? "Add Section" : "Access restricted"}
                          </button>
                        </div>
                      )}

                      <div style={{ display: 'grid', gap: '16px' }}>
                        {(selectedTemplateForBuilder.sections || []).length === 0 && (
                          <div style={{ backgroundColor: 'white', borderRadius: '18px', border: '1px dashed #cbd5e1', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                            Draft has no sections yet.
                          </div>
                        )}

                        {(selectedTemplateForBuilder.sections || []).map((section: any) => {
                          const isExpanded = expandedSections.includes(section.id);
                          const canRemoveSection = isDraft || status === "PUBLISHED";

                          return (
                            <section key={section.id} style={{ backgroundColor: 'white', borderRadius: '18px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                              <div style={{ padding: '18px 22px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <button
                                  onClick={() => toggleSection(section.id)}
                                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#334155', fontWeight: '800' }}
                                >
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                  </svg>
                                  {isDraft ? (
                                    <input
                                      value={sectionNameDrafts[section.id] ?? section.name}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => setSectionNameDrafts((prev) => ({ ...prev, [section.id]: e.target.value }))}
                                      style={{ minWidth: '280px', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: '700', color: '#1e293b' }}
                                    />
                                  ) : (
                                    <span>{section.name}</span>
                                  )}
                                  <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: '700' }}>{section.items?.length || 0} items</span>
                                </button>

                                {canRemoveSection && (
                                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {isDraft && (
                                      <button
                                        onClick={() => updateSectionName(section.id, selectedTemplateForBuilder.id, section.name)}
                                        disabled={!canManageTemplates}
                                        style={{ padding: '9px 12px', borderRadius: '9px', border: '1px solid #dbeafe', backgroundColor: canManageTemplates ? '#eff6ff' : '#f1f5f9', color: canManageTemplates ? '#1e40af' : '#94a3b8', cursor: canManageTemplates ? 'pointer' : 'not-allowed', fontWeight: '700' }}
                                      >
                                        {canManageTemplates ? "Save" : "Access restricted"}
                                      </button>
                                    )}
                                    <button
                                      onClick={() => removeSection(section.id, selectedTemplateForBuilder.id, status === "PUBLISHED")}
                                      disabled={!canPerformDestructiveTemplateActions}
                                      style={{ padding: '9px 12px', borderRadius: '9px', border: '1px solid #fecaca', backgroundColor: canPerformDestructiveTemplateActions ? '#fff1f2' : '#f8fafc', color: canPerformDestructiveTemplateActions ? '#9f1239' : '#94a3b8', cursor: canPerformDestructiveTemplateActions ? 'pointer' : 'not-allowed', fontWeight: '700' }}
                                    >
                                      {canPerformDestructiveTemplateActions ? (status === "PUBLISHED" ? "Delete Section" : "Remove") : "Admin only"}
                                    </button>
                                  </div>
                                )}
                              </div>

                              {isExpanded && (
                                <div style={{ padding: '18px 22px', display: 'grid', gap: '12px' }}>
                                  {(section.items || []).map((item: any) => {
                                    const draft = itemDrafts[item.id] || {};

                                    return (
                                      <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px', display: 'grid', gap: '12px' }}>
                                        {isDraft ? (
                                          <>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 2fr) 140px 120px', gap: '12px', alignItems: 'center' }}>
                                              <input
                                                value={draft.label ?? item.label}
                                                onChange={(e) => setItemDraftValue(item.id, "label", e.target.value)}
                                                style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                                              />
                                              <select
                                                value={draft.type ?? item.type}
                                                onChange={(e) => setItemDraftValue(item.id, "type", e.target.value)}
                                                style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: 'white' }}
                                              >
                                                <option value="text">Text</option>
                                                <option value="number">Number</option>
                                                <option value="range">Range</option>
                                                <option value="boolean">Boolean</option>
                                                <option value="mcq">MCQ</option>
                                              </select>
                                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: '600', fontSize: '0.85rem' }}>
                                                <input
                                                  type="checkbox"
                                                  checked={draft.required ?? item.required ?? true}
                                                  onChange={(e) => setItemDraftValue(item.id, "required", e.target.checked)}
                                                />
                                                Required
                                              </label>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px auto auto', gap: '12px', alignItems: 'center' }}>
                                              <input
                                                value={draft.placeholder ?? item.placeholder ?? ""}
                                                onChange={(e) => setItemDraftValue(item.id, "placeholder", e.target.value)}
                                                placeholder="Placeholder or helper text"
                                                style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                                              />
                                              <input
                                                value={draft.unit ?? item.unit ?? ""}
                                                onChange={(e) => setItemDraftValue(item.id, "unit", e.target.value)}
                                                placeholder="Unit"
                                                style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                                              />
                                              <button
                                                onClick={() => updateItem(item, selectedTemplateForBuilder.id)}
                                                disabled={!canManageTemplates}
                                                style={{ padding: '10px 12px', borderRadius: '9px', border: '1px solid #dbeafe', backgroundColor: canManageTemplates ? '#eff6ff' : '#f1f5f9', color: canManageTemplates ? '#1e40af' : '#94a3b8', cursor: canManageTemplates ? 'pointer' : 'not-allowed', fontWeight: '700' }}
                                              >
                                                {canManageTemplates ? "Save" : "Access restricted"}
                                              </button>
                                              <button
                                                onClick={() => removeItem(item.id, selectedTemplateForBuilder.id)}
                                                disabled={!canPerformDestructiveTemplateActions}
                                                style={{ padding: '10px 12px', borderRadius: '9px', border: '1px solid #fecaca', backgroundColor: canPerformDestructiveTemplateActions ? '#fff1f2' : '#f8fafc', color: canPerformDestructiveTemplateActions ? '#9f1239' : '#94a3b8', cursor: canPerformDestructiveTemplateActions ? 'pointer' : 'not-allowed', fontWeight: '700' }}
                                              >
                                                {canPerformDestructiveTemplateActions ? "Remove" : "Admin only"}
                                              </button>
                                            </div>
                                            {(draft.type ?? item.type) === "mcq" && renderChoiceEditor(item.id, item.choices)}
                                            {(draft.type ?? item.type) === "range" && renderRangeEditor(item.id, item)}
                                          </>
                                        ) : (
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                                            <div>
                                              <div style={{ color: '#334155', fontWeight: '700' }}>{item.label}</div>
                                              {(item.placeholder || item.unit) && (
                                                <div style={{ marginTop: '4px', color: '#94a3b8', fontSize: '0.82rem' }}>{item.placeholder || ""}{item.unit ? ` • ${item.unit}` : ""}</div>
                                              )}
                                              {item.type === "mcq" && Array.isArray(item.choices) && (
                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                                                  {item.choices.map((choice: any, index: number) => {
                                                    const color = choicePalette[choice.color] || choicePalette.gray;
                                                    return (
                                                      <span key={choice.id || index} style={{ padding: '4px 8px', borderRadius: '999px', backgroundColor: color.bg, color: color.text, border: `1px solid ${color.border}`, fontSize: '0.72rem', fontWeight: '800' }}>
                                                        {choice.label}
                                                      </span>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                              {item.type === "range" && item.rangeMin != null && item.rangeMax != null && (
                                                <div style={{ marginTop: '6px', color: '#64748b', fontSize: '0.78rem', fontWeight: '700' }}>
                                                  Range: {item.rangeMin} - {item.rangeMax}{item.unit ? ` ${item.unit}` : ""}
                                                </div>
                                              )}
                                            </div>
                                            <span style={{ padding: '5px 10px', borderRadius: '999px', backgroundColor: '#f1f5f9', color: '#64748b', fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase' }}>
                                              {item.type}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}

                                  {isDraft && (
                                    <div style={{ border: '1px dashed #cbd5e1', borderRadius: '14px', padding: '14px', display: 'grid', gap: '12px' }}>
                                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 2fr) 140px 120px', gap: '12px', alignItems: 'center' }}>
                                        <input
                                          value={itemDrafts[`new-${section.id}`]?.label || ""}
                                          onChange={(e) => setItemDraftValue(`new-${section.id}`, "label", e.target.value)}
                                          placeholder="New item label"
                                          style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                                        />
                                        <select
                                          value={itemDrafts[`new-${section.id}`]?.type || "text"}
                                          onChange={(e) => setItemDraftValue(`new-${section.id}`, "type", e.target.value)}
                                          style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: 'white' }}
                                        >
                                          <option value="text">Text</option>
                                          <option value="number">Number</option>
                                          <option value="range">Range</option>
                                          <option value="boolean">Boolean</option>
                                          <option value="mcq">MCQ</option>
                                        </select>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: '600', fontSize: '0.85rem' }}>
                                          <input
                                            type="checkbox"
                                            checked={itemDrafts[`new-${section.id}`]?.required !== false}
                                            onChange={(e) => setItemDraftValue(`new-${section.id}`, "required", e.target.checked)}
                                          />
                                          Required
                                        </label>
                                      </div>
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px auto', gap: '12px', alignItems: 'center' }}>
                                        <input
                                          value={itemDrafts[`new-${section.id}`]?.placeholder || ""}
                                          onChange={(e) => setItemDraftValue(`new-${section.id}`, "placeholder", e.target.value)}
                                          placeholder="Placeholder or helper text"
                                          style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                                        />
                                        <input
                                          value={itemDrafts[`new-${section.id}`]?.unit || ""}
                                          onChange={(e) => setItemDraftValue(`new-${section.id}`, "unit", e.target.value)}
                                          placeholder="Unit"
                                          style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                                        />
                                        {!["mcq", "range"].includes(itemDrafts[`new-${section.id}`]?.type || "text") && (
                                          <button
                                            onClick={() => addItemToSection(section.id, selectedTemplateForBuilder.id)}
                                            disabled={!canManageTemplates}
                                            style={{ padding: '10px 14px', borderRadius: '10px', border: 'none', backgroundColor: canManageTemplates ? '#3b82f6' : '#94a3b8', color: 'white', cursor: canManageTemplates ? 'pointer' : 'not-allowed', fontWeight: '700' }}
                                          >
                                            {canManageTemplates ? "Add Item" : "Access restricted"}
                                          </button>
                                        )}
                                      </div>
                                      {(itemDrafts[`new-${section.id}`]?.type || "text") === "mcq" && (
                                        <>
                                          {renderChoiceEditor(`new-${section.id}`)}
                                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <button
                                              onClick={() => addItemToSection(section.id, selectedTemplateForBuilder.id)}
                                              disabled={!canManageTemplates}
                                              style={{ padding: '11px 18px', borderRadius: '10px', border: 'none', backgroundColor: canManageTemplates ? '#3b82f6' : '#94a3b8', color: 'white', cursor: canManageTemplates ? 'pointer' : 'not-allowed', fontWeight: '800' }}
                                            >
                                              {canManageTemplates ? "Add MCQ Item" : "Access restricted"}
                                            </button>
                                          </div>
                                        </>
                                      )}
                                      {(itemDrafts[`new-${section.id}`]?.type || "text") === "range" && (
                                        <>
                                          {renderRangeEditor(`new-${section.id}`)}
                                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <button
                                              onClick={() => addItemToSection(section.id, selectedTemplateForBuilder.id)}
                                              disabled={!canManageTemplates}
                                              style={{ padding: '11px 18px', borderRadius: '10px', border: 'none', backgroundColor: canManageTemplates ? '#3b82f6' : '#94a3b8', color: 'white', cursor: canManageTemplates ? 'pointer' : 'not-allowed', fontWeight: '800' }}
                                            >
                                              {canManageTemplates ? "Add Range Item" : "Access restricted"}
                                            </button>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </section>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </main>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
