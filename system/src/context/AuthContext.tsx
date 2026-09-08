import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api, setAccessToken, setSessionExpiredHandler } from "../lib/api";

interface User {
  id: number;
  name: string;
  email: string;
  employee_id: string | null;
  phone_number: string | null;
  department_id: number | null;
  job_title: string | null;
  profile_picture_url: string | null;
  role: "staff" | "admin" | "superadmin";
  account_status: string;
  is_blocked: boolean;
  account_locked: boolean;
  last_login_at: string | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    try {
      const profile = await api.getMyProfile();
      setUser(profile);
    } catch (err) {
      if (err instanceof TypeError) {
        return;
      }
      setUser(null);
    }
  }

  useEffect(() => {
    async function bootstrap() {
      const refreshed = await api.refresh();
      if (refreshed) {
        await refreshUser();
      }
      setLoading(false);
    }
    bootstrap();

    setSessionExpiredHandler(() => {
      setUser(null);
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    });

    return () => setSessionExpiredHandler(null);
  }, []);

  async function login(identifier: string, password: string) {
    const data = await api.login(identifier, password);
    setAccessToken(data.access_token);
    await refreshUser();
  }

  async function logout() {
    await api.logout().catch(() => {});
    setAccessToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
