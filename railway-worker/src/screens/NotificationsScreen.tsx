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

export default function NotificationsScreen({ user, goBack }: any) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get("/notifications");
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (err) {
      console.log("Notifications error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const markRead = async (notificationId: string) => {
    try {
      await api.post(`/notifications/${notificationId}/read`);
      fetchNotifications();
    } catch (err) {
      console.log("Mark notification read error:", err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.post("/notifications/read-all");
      fetchNotifications();
    } catch (err) {
      console.log("Mark all notifications read error:", err);
    }
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerLabel}>Workflow Alerts</Text>
          <Text style={styles.headerName} numberOfLines={1}>{user?.name}</Text>
        </View>
        <View style={{ width: 64 }} />
      </View>

      <View style={styles.summaryBar}>
        <View>
          <Text style={styles.summaryValue}>{unreadCount}</Text>
          <Text style={styles.summaryLabel}>Unread</Text>
        </View>
        <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
          <Text style={styles.markAllText}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {loading && !refreshing && (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        )}

        {!loading && notifications.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Alerts</Text>
            <Text style={styles.emptySubtitle}>Assignment and rework updates will appear here.</Text>
          </View>
        )}

        {!loading && notifications.map((notification) => (
          <View key={notification.id} style={[styles.notificationCard, !notification.read && styles.unreadCard]}>
            <View style={styles.notificationHeader}>
              <Text style={styles.notificationTitle}>{notification.title}</Text>
              {!notification.read && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.notificationMessage}>{notification.message}</Text>
            <Text style={styles.notificationMeta}>{notification.type} · {formatDateTime(notification.createdAt)}</Text>
            {!notification.read && (
              <TouchableOpacity style={styles.readBtn} onPress={() => markRead(notification.id)}>
                <Text style={styles.readText}>Mark read</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
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
  summaryBar: {
    margin: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    ...Shadow.light,
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: "900",
    color: Colors.primary,
  },
  summaryLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  markAllBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: BorderRadius.md,
  },
  markAllText: {
    color: Colors.white,
    fontWeight: "800",
    fontSize: 13,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
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
  notificationCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.light,
  },
  unreadCard: {
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  notificationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.sm,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
    color: Colors.text,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  notificationMessage: {
    marginTop: Spacing.sm,
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  notificationMeta: {
    marginTop: Spacing.sm,
    color: Colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  readBtn: {
    marginTop: Spacing.md,
    alignSelf: "flex-start",
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  readText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
});
