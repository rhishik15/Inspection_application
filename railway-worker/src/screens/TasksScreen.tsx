import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
  Platform
} from "react-native";
import { api } from "../api/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors, Spacing, BorderRadius, Shadow } from "../../constants/theme";

export default function TasksScreen({ user, openTask, openDashboard, openNotifications, onLogout }: any) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchNotifications();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await api.get("/tasks");

      const myTasks = res.data.filter((t: any) => {
        const isAssigned = t.assignments?.some(
          (a: any) => a.workerId === user?.id
        );
        return isAssigned;
      });

      myTasks.sort((a: any, b: any) => {
        const bAssignedAt = getMyAssignment(b)?.createdAt || b.createdAt;
        const aAssignedAt = getMyAssignment(a)?.createdAt || a.createdAt;
        return new Date(bAssignedAt).getTime() - new Date(aAssignedAt).getTime();
      });

      setTasks(myTasks);
    } catch (err) {
      console.log("Fetch tasks error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await api.get("/notifications");
      setUnreadNotifications(res.data.unreadCount || 0);
    } catch (err) {
      console.log("Fetch notification count error:", err);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
    fetchNotifications();
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem("user");
      onLogout();
    } catch (err) {
      console.log("Logout error:", err);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'DONE': return { bg: '#ecfdf5', text: '#065f46' };
      case 'REWORK': return { bg: '#fff1f2', text: '#9f1239' };
      case 'SUBMITTED': return { bg: '#f0f9ff', text: '#075985' };
      case 'ASSIGNED': return { bg: '#fefce8', text: '#854d0e' };
      default: return { bg: '#f8fafc', text: '#475569' };
    }
  };

  const getMyAssignment = (task: any) => {
    return task.assignments?.find((assignment: any) => assignment.workerId === user?.id);
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.name}</Text>
        </View>
        <TouchableOpacity style={styles.logoutActionBtn} onPress={logout}>
           <Text style={styles.logoutActionText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <View style={styles.tabTitleGroup}>
          <Text style={styles.tabTitle}>Inspection Tasks</Text>
          <View style={styles.badgeCount}>
            <Text style={styles.badgeCountText}>{tasks.length}</Text>
          </View>
        </View>
        <View style={styles.tabActions}>
          <TouchableOpacity style={styles.alertsBtn} onPress={openNotifications}>
            <Text style={styles.alertsBtnText}>Alerts</Text>
            {unreadNotifications > 0 && (
              <View style={styles.alertBadge}>
                <Text style={styles.alertBadgeText}>{unreadNotifications}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.analyticsBtn} onPress={openDashboard}>
            <Text style={styles.analyticsBtnText}>Analytics</Text>
          </TouchableOpacity>
        </View>
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
            <Text style={styles.loadingText}>Fetching updates...</Text>
          </View>
        )}

        {!loading && tasks.length === 0 && (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
               <Text style={styles.emptyIcon}>✅</Text>
            </View>
            <Text style={styles.emptyTitle}>No Pending Tasks</Text>
            <Text style={styles.emptySubtitle}>You have completed all assigned inspections. Refresh to check for new ones.</Text>
          </View>
        )}

        {tasks.map((t) => {
          const pStyle = Colors.priority[t.priority as keyof typeof Colors.priority] || Colors.priority.MEDIUM;
          const sStyle = getStatusStyle(t.status);
          const assignment = getMyAssignment(t);

          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => openTask(t)}
              style={[
                styles.card,
                t.priority === 'URGENT' && styles.urgentCard
              ]}
              activeOpacity={0.9}
            >
              <View style={styles.cardHeader}>
                <View>
                   <View style={styles.locoRow}>
                      <Text style={styles.locoLabel}>LOCO</Text>
                      <Text style={styles.locoNumber}>{t.loco?.locoNumber || "N/A"}</Text>
                   </View>
                   <View style={[styles.priorityBadge, { backgroundColor: pStyle.bg }]}>
                      <View style={[styles.priorityDot, { backgroundColor: pStyle.dot }]} />
                      <Text style={[styles.priorityText, { color: pStyle.text }]}>{t.priority}</Text>
                   </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: sStyle.bg }]}>
                  <Text style={[styles.statusText, { color: sStyle.text }]}>{t.status}</Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                 <Text style={styles.inspectionTypeLabel}>Inspection Schedule</Text>
                 <Text style={styles.inspectionTypeName}>{t.inspectionType}</Text>
                 <Text style={styles.assignedAtText}>Assigned: {formatDateTime(assignment?.createdAt)}</Text>
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.footerAction}>
                   <Text style={styles.actionText}>View Details</Text>
                   <Text style={styles.actionArrow}>→</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    // Add extra padding for Android devices where SafeAreaView doesn't cover Status Bar
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  greeting: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  logoutActionBtn: {
    backgroundColor: '#fee2e2', // Light red background
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutActionText: {
    color: '#ef4444', // Red text
    fontSize: 14,
    fontWeight: '700',
  },
  tabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  tabTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tabTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  badgeCount: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 10,
  },
  badgeCountText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  analyticsBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  tabActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertsBtn: {
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertsBtnText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  alertBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  alertBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
  analyticsBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  loadingText: {
    marginTop: Spacing.md,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    ...Shadow.medium,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  urgentCard: {
    borderColor: '#fecaca',
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  locoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  locoLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  locoNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardBody: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
    marginBottom: 12,
  },
  inspectionTypeLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  inspectionTypeName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  assignedAtText: {
    marginTop: 8,
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  footerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  actionArrow: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
  },
});
