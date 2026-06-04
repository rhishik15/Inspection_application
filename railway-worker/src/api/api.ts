import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const getApiBaseUrl = () => {
  const configuredUrl = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000";

  if (Platform.OS === "android") {
    return configuredUrl.replace("localhost", "10.0.2.2").replace("127.0.0.1", "10.0.2.2");
  }

  return configuredUrl;
};

export const api = axios.create({
  baseURL: getApiBaseUrl()
});

api.interceptors.request.use(async (config) => {
  try {
    const userStr = await AsyncStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.role) {
        config.headers["role"] = user.role;
      }
      if (user.id) {
        config.headers["user-id"] = user.id;
      }
    }
  } catch (err) {
    console.error("Error reading user from storage", err);
  }
  return config;
});
