import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api"
});

// 👇 read user from localStorage
export const getUser = () => {
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
};

api.interceptors.request.use((config) => {
  const user = getUser();

  if (user) {
    config.headers["role"] = user.role;
    if (user.id) {
      config.headers["user-id"] = user.id;
    }
  }

  return config;
});
