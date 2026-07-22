import axios from "axios";
import { useAuthStore } from "@/stores/auth";

export const apiClient = axios.create({
  baseURL: "/api/v1",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

let isRedirecting = false;

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!axios.isAxiosError(error) || !error.response) {
      return Promise.reject(error);
    }

    const { status } = error.response;

    if (status === 401 && window.location.pathname !== "/login") {
      if (!isRedirecting) {
        isRedirecting = true;
        useAuthStore.getState().logout();
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);