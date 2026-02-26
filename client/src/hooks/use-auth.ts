import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface AuthUser {
  id: number;
  email: string;
  role: string;
  maintenanceMode?: boolean;
}

async function apiRequest(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Request failed");
  return json;
}

export function useAuth() {
  const queryClient = useQueryClient();

  const userQuery = useQuery<AuthUser>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("Not authenticated");
      return res.json();
    },
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      apiRequest("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: { email: string; password: string; confirmPassword: string }) =>
      apiRequest("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      apiRequest("/api/auth/change-password", { method: "POST", body: JSON.stringify(data) }),
  });

  return {
    user: userQuery.data,
    isLoading: userQuery.isLoading,
    isAuthenticated: !!userQuery.data,
    isAdmin: userQuery.data?.role === "admin",
    maintenanceMode: userQuery.data?.maintenanceMode,
    login: loginMutation,
    register: registerMutation,
    logout: logoutMutation,
    changePassword: changePasswordMutation,
  };
}
