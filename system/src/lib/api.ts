const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

let accessToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

async function request(path: string, options: RequestOptions = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (!options.skipAuth && accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && !options.skipAuth && path !== "/auth/refresh") {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request(path, options);
    }
    accessToken = null;
    if (onSessionExpired) onSessionExpired();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Something went wrong" }));
    const detail = body.detail;
    const message = typeof detail === "string" ? detail : detail?.message || "Request failed";
    const error = new Error(message) as Error & { detail?: unknown };
    error.detail = detail;
    throw error;
  }

  if (res.status === 204) return null;
  return res.json();
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return false;
    const data = await res.json();
    accessToken = data.access_token;
    return true;
  } catch {
    return false;
  }
}

async function uploadFile(path: string, file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = {};
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: formData,
    credentials: "include",
  });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return uploadFile(path, file);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(body.detail || "Upload failed");
  }

  return res.json();
}

export const api = {
  register: (payload: {
    name: string;
    email: string;
    password: string;
    employee_id: string;
    phone_number?: string;
    department_id?: number;
    job_title?: string;
  }) => request("/auth/register", { method: "POST", body: JSON.stringify(payload), skipAuth: true }),

  login: (identifier: string, password: string) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
      skipAuth: true,
    }),

  logout: () => request("/auth/logout", { method: "POST" }),

  refresh: tryRefresh,

  changePassword: (current_password: string, new_password: string) =>
    request("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
    }),

  requestPasswordReset: (email: string) =>
    request("/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email }),
      skipAuth: true,
    }),

  getMyProfile: () => request("/users/me"),
  updateMyProfile: (payload: Record<string, unknown>) =>
    request("/users/me", { method: "PATCH", body: JSON.stringify(payload) }),

  getModules: () => request("/modules"),
  createModule: (payload: {
    name: string;
    description?: string;
    status: string;
  }) => request("/modules", { method: "POST", body: JSON.stringify(payload) }),
  updateModuleStatus: (id: number, status: string) =>
    request(`/modules/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  deleteModule: (id: number) => request(`/modules/${id}`, { method: "DELETE" }),

  getDepartments: () => request("/departments", { skipAuth: true }),
  createDepartment: (name: string) =>
    request("/departments", { method: "POST", body: JSON.stringify({ name }) }),
  deleteDepartment: (id: number) => request(`/departments/${id}`, { method: "DELETE" }),

  getMyModuleAccess: () => request("/module-access/mine"),
  requestModuleAccess: (moduleId: number) =>
    request(`/module-access/request/${moduleId}`, { method: "POST" }),
  grantModuleAccess: (userId: number, moduleId: number) =>
    request("/module-access/grant", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, module_id: moduleId }),
    }),
  getPendingModuleRequests: () => request("/module-access/pending"),
  approveModuleRequest: (id: number) => request(`/module-access/${id}/approve`, { method: "POST" }),
  rejectModuleRequest: (id: number, reason: string) =>
    request(`/module-access/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ rejection_reason: reason }),
    }),

  getUsers: () => request("/users"),
  getUserDetail: (id: number) => request(`/users/${id}`),
  getUserAnalytics: () => request("/users/analytics"),
  getPendingRegistrations: () => request("/users/pending-registrations"),
  createUser: (payload: Record<string, unknown>) =>
    request("/users", { method: "POST", body: JSON.stringify(payload) }),
  approveRegistration: (id: number) => request(`/users/${id}/approve`, { method: "POST" }),
  rejectRegistration: (id: number, reason: string) =>
    request(`/users/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  updateUser: (id: number, payload: Record<string, unknown>) =>
    request(`/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  disableUser: (id: number) => request(`/users/${id}/disable`, { method: "POST" }),
  enableUser: (id: number) => request(`/users/${id}/enable`, { method: "POST" }),
  unlockUser: (id: number) => request(`/users/${id}/unlock`, { method: "POST" }),
  setBlockStatus: (id: number, isBlocked: boolean) =>
    request(`/users/${id}/block`, { method: "POST", body: JSON.stringify({ is_blocked: isBlocked }) }),
  changeRole: (id: number, newRole: string) =>
    request(`/users/${id}/role`, { method: "POST", body: JSON.stringify({ new_role: newRole }) }),

  revokeModuleAccess: (id: number) => request(`/module-access/${id}/revoke`, { method: "POST" }),

  getHistory: () => request("/history"),
  getMyActivity: () => request("/history/mine"),

  getPendingPasswordResets: () => request("/auth/password-reset/pending"),
  approvePasswordReset: (id: number) =>
    request(`/auth/password-reset/${id}/approve`, { method: "POST" }),

  getAllNews: () => request("/news?published_only=false"),
  createNews: (payload: Record<string, unknown>) =>
    request("/news", { method: "POST", body: JSON.stringify(payload) }),
  updateNews: (id: number, payload: Record<string, unknown>) =>
    request(`/news/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteNews: (id: number) => request(`/news/${id}`, { method: "DELETE" }),

  uploadNewsMedia: (file: File) => uploadFile("/uploads/news-media", file),
  uploadProfilePicture: (file: File) => uploadFile("/uploads/profile-picture", file),

  getAssetCategories: () => request("/assets/categories"),
  createAssetCategory: (name: string) =>
    request("/assets/categories", { method: "POST", body: JSON.stringify({ name }) }),
  deleteAssetCategory: (id: number) => request(`/assets/categories/${id}`, { method: "DELETE" }),

  getAssets: () => request("/assets"),
  getAsset: (id: number) => request(`/assets/${id}`),
  getAssetHistory: (id: number) => request(`/assets/${id}/history`),
  createAsset: (payload: Record<string, unknown>) =>
    request("/assets", { method: "POST", body: JSON.stringify(payload) }),
  updateAsset: (id: number, payload: Record<string, unknown>) =>
    request(`/assets/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  assignAsset: (id: number, payload: Record<string, unknown>) =>
    request(`/assets/${id}/assign`, { method: "POST", body: JSON.stringify(payload) }),
  getUsersSummary: () => request("/assets/users-summary"),
  createSubmission: (assetId: number, payload: Record<string, unknown>) =>
    request(`/assets/${assetId}/submissions`, { method: "POST", body: JSON.stringify(payload) }),
  getSubmissions: (status?: string) =>
    request(`/assets/submissions/list${status ? `?status=${status}` : ""}`),
  reviewSubmission: (id: number, finalStatus: string) =>
    request(`/assets/submissions/${id}/review`, { method: "POST", body: JSON.stringify({ final_status: finalStatus }) }),
  uploadAssetPhoto: (file: File) => uploadFile("/uploads/asset-photo", file),
  addAssetNote: (assetId: number, content: string) =>
    request(`/assets/${assetId}/notes`, { method: "POST", body: JSON.stringify({ content }) }),
  editAssetNote: (noteId: number, content: string) =>
    request(`/assets/notes/${noteId}`, { method: "PATCH", body: JSON.stringify({ content }) }),
  deleteAssetNote: (noteId: number) => request(`/assets/notes/${noteId}`, { method: "DELETE" }),

  getModuleLog: (moduleSlug: string) => request(`/module-log/${moduleSlug}`),

  getSitePages: () => request("/site-settings/pages"),
  updateSitePage: (id: number, visible: boolean) =>
    request(`/site-settings/pages/${id}`, { method: "PATCH", body: JSON.stringify({ visible }) }),
  getSiteLinks: (type?: string) => request(`/site-settings/links${type ? `?type=${type}` : ""}`),
  createSiteLink: (payload: Record<string, unknown>) =>
    request("/site-settings/links", { method: "POST", body: JSON.stringify(payload) }),
  updateSiteLink: (id: number, payload: Record<string, unknown>) =>
    request(`/site-settings/links/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteSiteLink: (id: number) => request(`/site-settings/links/${id}`, { method: "DELETE" }),
  getSiteConfig: () => request("/site-settings/config"),
  updateSiteConfig: (settings: Record<string, string>) =>
    request("/site-settings/config", { method: "PATCH", body: JSON.stringify({ settings }) }),
  getSessionConfig: () => request("/site-settings/session-config"),
  getPublicRegistrationEnabled: () => request("/site-settings/public/registration-enabled"),

  getAnnouncement: () => request("/news/announcement/current"),
  updateAnnouncement: (payload: { enabled: boolean; message: string }) =>
    request("/news/announcement/current", { method: "PATCH", body: JSON.stringify(payload) }),
};
