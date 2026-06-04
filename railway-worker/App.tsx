import { useState, useEffect } from "react";
import LoginScreen from "./src/screens/LoginScreen";
import TasksScreen from "./src/screens/TasksScreen";
import TaskDetailScreen from "./src/screens/TaskDetailScreen";
import WorkerDashboardScreen from "./src/screens/WorkerDashboardScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [showWorkerDashboard, setShowWorkerDashboard] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // ✅ Auto-load user from storage
  useEffect(() => {
    const loadUser = async () => {
      const stored = await AsyncStorage.getItem("user");
      if (stored) {
        setUser(JSON.parse(stored));
      }
    };

    loadUser();
  }, []);

  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }

  if (selectedTask) {
    return (
      <TaskDetailScreen
        task={selectedTask}
        user={user}
        goBack={() => setSelectedTask(null)}
      />
    );
  }

  if (showWorkerDashboard) {
    return (
      <WorkerDashboardScreen
        user={user}
        goBack={() => setShowWorkerDashboard(false)}
      />
    );
  }

  if (showNotifications) {
    return (
      <NotificationsScreen
        user={user}
        goBack={() => setShowNotifications(false)}
      />
    );
  }

  return (
    <TasksScreen
      user={user}
      openTask={(task: any) => setSelectedTask(task)}
      openDashboard={() => setShowWorkerDashboard(true)}
      openNotifications={() => setShowNotifications(true)}
      onLogout={() => {
        setShowWorkerDashboard(false);
        setShowNotifications(false);
        setUser(null);
      }}
    />
  );
}
