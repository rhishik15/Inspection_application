import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { api } from "../api/api";
import { BorderRadius, Colors, Shadow, Spacing } from "../../constants/theme";

export default function WorkerDashboardScreen({ user, goBack }: any) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/workers/${user.id}/analytics`);
      setAnalytics(res.data);
    } catch (err) {
      console.log("Worker analytics error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  const formatDateTime = (value?: string) => {
    if (!value) return "Not recorded";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not recorded";

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  };

  const formatAge = (hours?: number | null) => {
    if (hours === null || hours === undefined) return "No active tasks";
    if (hours < 1) return "Under 1 hour";
    if (hours < 24) return `${Math.round(hours)} hr`;
    return `${Math.round(hours / 24)} days`;
  };

  const statusCounts = analytics?.statusCounts || {};
  const priorityCounts = analytics?.priorityCounts || {};
  const summary = analytics?.summary || {};

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerLabel}>Worker Analytics</Text>
          <Text style={styles.headerName} numberOfLines={1}>{user?.name}</Text>
        </View>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {loading && !refreshing && (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading analytics...</Text>
          </View>
        )}

        {!loading && !analytics && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Analytics Available</Text>
            <Text style={styles.emptySubtitle}>Pull down to refresh once tasks are assigned.</Text>
          </View>
        )}

        {!!analytics && (
          <>
            <View style={styles.overviewGrid}>
              <MetricCard label="Historical" value={summary.totalHistoricalTasks || 0} tone="primary" />
              <MetricCard label="Active" value={summary.currentActiveTasks || 0} tone="warning" />
              <MetricCard label="Submitted" value={summary.submittedTasks || 0} tone="primary" />
              <MetricCard label="Done" value={summary.doneTasks || 0} tone="success" />
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Assignment Age</Text>
                <Text style={styles.sectionMeta}>Active work only</Text>
              </View>
              <View style={styles.agePanel}>
                <View style={styles.ageColumn}>
                  <Text style={styles.ageLabel}>Average age</Text>
                  <Text style={styles.ageValue}>{formatAge(analytics.assignmentAge?.averageActiveAssignmentAgeHours)}</Text>
                </View>
                <View style={styles.ageColumn}>
                  <Text style={styles.ageLabel}>Newest</Text>
                  <Text style={styles.ageDate}>{formatDateTime(analytics.assignmentAge?.newestActiveAssignedAt)}</Text>
                </View>
                <View style={styles.ageColumn}>
                  <Text style={styles.ageLabel}>Oldest</Text>
                  <Text style={styles.ageDate}>{formatDateTime(analytics.assignmentAge?.oldestActiveAssignedAt)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Status Breakdown</Text>
                <Text style={styles.sectionMeta}>{summary.reworkRate || 0}% rework</Text>
              </View>
              {["ASSIGNED", "REWORK", "SUBMITTED", "DONE", "CREATED"].map((status) => (
                <CountRow
                  key={status}
                  label={status}
                  value={statusCounts[status] || 0}
                  color={getStatusColor(status)}
                />
              ))}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Priority Summary</Text>
                <Text style={styles.sectionMeta}>Full history</Text>
              </View>
              {["URGENT", "HIGH", "MEDIUM", "LOW"].map((priority) => {
                const priorityStyle = Colors.priority[priority as keyof typeof Colors.priority];
                return (
                  <CountRow
                    key={priority}
                    label={priority}
                    value={priorityCounts[priority] || 0}
                    color={priorityStyle.dot}
                  />
                );
              })}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Current Workload</Text>
                <Text style={styles.sectionMeta}>{analytics.currentTasks?.length || 0} tasks</Text>
              </View>
              {(!analytics.currentTasks || analytics.currentTasks.length === 0) && (
                <Text style={styles.mutedText}>No active assignments right now.</Text>
              )}
              {(analytics.currentTasks || []).map((task: any) => {
                const priorityStyle = Colors.priority[task.priority as keyof typeof Colors.priority] || Colors.priority.MEDIUM;
                return (
                  <View key={task.id} style={styles.taskRow}>
                    <View style={styles.taskMain}>
                      <Text style={styles.taskLoco}>Loco {task.locoNumber || "N/A"}</Text>
                      <Text style={styles.taskType}>{task.inspectionType}</Text>
                      <Text style={styles.taskAssigned}>Assigned {formatDateTime(task.assignedAt)}</Text>
                    </View>
                    <View style={styles.taskBadges}>
                      <Text style={[styles.smallBadge, { backgroundColor: getStatusBg(task.status), color: getStatusColor(task.status) }]}>
                        {task.status}
                      </Text>
                      <Text style={[styles.smallBadge, { backgroundColor: priorityStyle.bg, color: priorityStyle.text }]}>
                        {task.priority}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                <Text style={styles.sectionMeta}>Latest events</Text>
              </View>
              {(!analytics.recentEvents || analytics.recentEvents.length === 0) && (
                <Text style={styles.mutedText}>No assignment events recorded.</Text>
              )}
              {(analytics.recentEvents || []).map((event: any) => (
                <View key={event.id} style={styles.eventRow}>
                  <View>
                    <Text style={[
                      styles.eventType,
                      { color: event.eventType === "ASSIGNED" ? Colors.success : Colors.danger }
                    ]}>
                      {event.eventType === "ASSIGNED" ? "Assigned" : "Unassigned"}
                    </Text>
                    <Text style={styles.eventTask}>Loco {event.locoNumber || "N/A"} · {event.inspectionType}</Text>
                  </View>
                  <Text style={styles.eventTime}>{formatDateTime(event.createdAt)}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ label, value, tone }: any) {
  const colors: Record<string, string> = {
    primary: Colors.primary,
    success: Colors.success,
    warning: Colors.warning
  };

  return (
    <View style={styles.metricCard}>
      <Text style={[styles.metricValue, { color: colors[tone] || Colors.text }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function CountRow({ label, value, color }: any) {
  return (
    <View style={styles.countRow}>
      <View style={styles.countLabelGroup}>
        <View style={[styles.countDot, { backgroundColor: color }]} />
        <Text style={styles.countLabel}>{label}</Text>
      </View>
      <Text style={styles.countValue}>{value}</Text>
    </View>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case "DONE": return "#065f46";
    case "REWORK": return "#9f1239";
    case "SUBMITTED": return "#075985";
    case "ASSIGNED": return "#854d0e";
    default: return "#475569";
  }
}

function getStatusBg(status: string) {
  switch (status) {
    case "DONE": return "#ecfdf5";
    case "REWORK": return "#fff1f2";
    case "SUBMITTED": return "#f0f9ff";
    case "ASSIGNED": return "#fefce8";
    default: return "#f8fafc";
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 64,
  },
  backText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: "700",
  },
  headerTitleGroup: {
    flex: 1,
    alignItems: "center",
  },
  headerLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "700",
  },
  headerName: {
    fontSize: 18,
    color: Colors.text,
    fontWeight: "900",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  centerContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 80,
  },
  loadingText: {
    marginTop: Spacing.md,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 80,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  overviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  metricCard: {
    width: "47.5%",
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    ...Shadow.light,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: "900",
  },
  metricLabel: {
    marginTop: 2,
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.light,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: Colors.text,
  },
  sectionMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "700",
  },
  agePanel: {
    gap: Spacing.sm,
  },
  ageColumn: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  ageLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "700",
  },
  ageValue: {
    fontSize: 24,
    fontWeight: "900",
    color: Colors.warning,
    marginTop: 2,
  },
  ageDate: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    marginTop: 2,
  },
  countRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  countLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  countDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  countLabel: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: "800",
  },
  countValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: "900",
  },
  mutedText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    paddingVertical: Spacing.sm,
  },
  taskRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  taskMain: {
    flex: 1,
  },
  taskLoco: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  taskType: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  taskAssigned: {
    color: Colors.muted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  taskBadges: {
    alignItems: "flex-end",
    gap: Spacing.xs,
  },
  smallBadge: {
    overflow: "hidden",
    borderRadius: BorderRadius.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: "900",
  },
  eventRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  eventType: {
    fontSize: 13,
    fontWeight: "900",
  },
  eventTask: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  eventTime: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    maxWidth: 108,
  },
});
