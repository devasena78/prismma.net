import { useState, useEffect } from "react";
import { UserCheck, ShieldCheck, Users, Building2, KeyRound, BarChart3, History as HistoryIcon } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import DashboardLayout from "../../components/DashboardLayout";
import RegistrationsTab from "./RegistrationsTab";
import ModuleRequestsTab from "./ModuleRequestsTab";
import UsersTab from "./UsersTab";
import DepartmentsTab from "./DepartmentsTab";
import PasswordResetsTab from "./PasswordResetsTab";
import AnalyticsTab from "./AnalyticsTab";
import HistoryTab from "./HistoryTab";

type Tab =
  | "registrations"
  | "module-requests"
  | "users"
  | "analytics"
  | "departments"
  | "password-resets"
  | "history";

const STORAGE_KEY = "prismma-admin-ops-tab";

const TAB_DEFS: { key: Tab; label: string; icon: typeof UserCheck; superadminOnly?: boolean }[] = [
  { key: "registrations", label: "Registrations", icon: UserCheck },
  { key: "module-requests", label: "Module Requests", icon: ShieldCheck, superadminOnly: true },
  { key: "users", label: "Users", icon: Users },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "departments", label: "Departments", icon: Building2, superadminOnly: true },
  { key: "password-resets", label: "Password Resets", icon: KeyRound },
  { key: "history", label: "History", icon: HistoryIcon, superadminOnly: true },
];

function initialTab(isSuperadmin: boolean): Tab {
  const stored = window.localStorage.getItem(STORAGE_KEY) as Tab | null;
  const match = TAB_DEFS.find((t) => t.key === stored);
  if (match && (!match.superadminOnly || isSuperadmin)) return match.key;
  return "registrations";
}

export default function AdminOperations() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin";
  const [tab, setTabState] = useState<Tab>(() => initialTab(isSuperadmin));
  const [counts, setCounts] = useState<Partial<Record<Tab, number>>>({});

  async function loadCounts() {
    const [registrations, resets] = await Promise.all([
      api.getPendingRegistrations(),
      api.getPendingPasswordResets(),
    ]);
    const next: Partial<Record<Tab, number>> = {
      registrations: registrations.length,
      "password-resets": resets.length,
    };
    if (isSuperadmin) {
      const requests = await api.getPendingModuleRequests();
      next["module-requests"] = requests.length;
    }
    setCounts(next);
  }

  useEffect(() => {
    loadCounts();
  }, [isSuperadmin]);

  function setTab(key: Tab) {
    setTabState(key);
    window.localStorage.setItem(STORAGE_KEY, key);
  }

  const tabs = TAB_DEFS;

  return (
    <DashboardLayout>
      <h1 className="font-display text-2xl font-semibold text-heading mb-1">Admin Operations</h1>
      <p className="text-body mb-6">Manage accounts, requests, and system configuration</p>

      <div className="flex flex-wrap gap-1 mb-6">
        {tabs.map((t) => {
          if (t.superadminOnly && !isSuperadmin) return null;
          const Icon = t.icon;
          const count = counts[t.key];
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? "border-brand-orange text-heading" : "border-border/10 text-body hover:text-heading"
              }`}
            >
              <Icon size={16} />
              {t.label}
              {!!count && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] font-medium">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "registrations" && <RegistrationsTab onCountChange={loadCounts} />}
      {tab === "module-requests" && isSuperadmin && <ModuleRequestsTab />}
      {tab === "users" && <UsersTab isSuperadmin={isSuperadmin} />}
      {tab === "analytics" && <AnalyticsTab isSuperadmin={isSuperadmin} />}
      {tab === "departments" && isSuperadmin && <DepartmentsTab />}
      {tab === "password-resets" && <PasswordResetsTab onCountChange={loadCounts} />}
      {tab === "history" && isSuperadmin && <HistoryTab />}
    </DashboardLayout>
  );
}
