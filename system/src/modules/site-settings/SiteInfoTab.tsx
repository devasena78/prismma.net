import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import { useToast } from "../../context/ToastContext";

const FIELD_CLASS = "w-full rounded-md border border-border/10 px-3 py-2.5 text-sm bg-surface text-body";

export default function SiteInfoTab() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function load() {
    setLoading(true);
    const r = await api.getSiteConfig();
    setSettings(r.settings);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function set(key: string, value: string) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      await api.updateSiteConfig({
        "site_info.company_name": settings["site_info.company_name"] || "",
        "site_info.email": settings["site_info.email"] || "",
        "site_info.address": settings["site_info.address"] || "",
      });
      toast.success("Site info updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-lg space-y-3">
      <div>
        <label className="text-xs text-muted block mb-1">Company Name</label>
        <input
          value={settings["site_info.company_name"] || ""}
          onChange={(e) => set("site_info.company_name", e.target.value)}
          className={FIELD_CLASS}
        />
      </div>
      <div>
        <label className="text-xs text-muted block mb-1">Contact Email</label>
        <input
          type="email"
          value={settings["site_info.email"] || ""}
          onChange={(e) => set("site_info.email", e.target.value)}
          className={FIELD_CLASS}
        />
      </div>
      <div>
        <label className="text-xs text-muted block mb-1">Address</label>
        <textarea
          value={settings["site_info.address"] || ""}
          onChange={(e) => set("site_info.address", e.target.value)}
          rows={3}
          className={`${FIELD_CLASS} resize-y`}
        />
      </div>
      <p className="text-xs text-muted">Phone numbers are managed under Social Links &rarr; Phone Numbers</p>
      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-md bg-brand-orange px-6 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}
