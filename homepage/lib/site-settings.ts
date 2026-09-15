const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface NavPage {
  slug: string;
  label: string;
}

export interface SiteInfo {
  company_name: string;
  email: string;
  phone: string;
  address: string;
}

export interface SiteLink {
  id: number;
  type: string;
  label: string;
  url: string;
  order: number;
}

export interface MaintenanceStatus {
  enabled: boolean;
  message: string;
}

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export function getPublicNav(): Promise<NavPage[]> {
  return safeFetch<NavPage[]>("/site-settings/public/nav", []);
}

export function getPublicSiteInfo(): Promise<SiteInfo> {
  return safeFetch<SiteInfo>("/site-settings/public/site-info", {
    company_name: "Prismma Express Sdn Bhd",
    email: "",
    phone: "",
    address: "",
  });
}

export function getPublicLinks(type: "social" | "footer" | "phone"): Promise<SiteLink[]> {
  return safeFetch<SiteLink[]>(`/site-settings/public/links?type=${type}`, []);
}

export function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  return safeFetch<MaintenanceStatus>("/site-settings/public/maintenance", {
    enabled: false,
    message: "",
  });
}

export interface Announcement {
  enabled: boolean;
  message: string;
}

export function getAnnouncement(): Promise<Announcement> {
  return safeFetch<Announcement>("/news/announcement/current", { enabled: false, message: "" });
}
