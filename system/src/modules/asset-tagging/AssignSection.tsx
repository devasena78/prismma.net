import { useState, useEffect, useMemo } from "react";
import { Search, UserPlus2, X } from "lucide-react";
import { api } from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import SearchableSelect from "./SearchableSelect";
import { STATUS_META } from "./statusMeta";

type SortKey = "name" | "category_name" | "status";
type FilterKey = "" | "unassigned" | "assigned";

export default function AssignSection() {
  const [assets, setAssets] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [assignFilter, setAssignFilter] = useState<FilterKey>("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDesc, setSortDesc] = useState(false);
  const [openRowId, setOpenRowId] = useState<number | null>(null);
  const [detailRowId, setDetailRowId] = useState<number | null>(null);
  const [draftPerson, setDraftPerson] = useState("");
  const [draftDept, setDraftDept] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function load() {
    setLoading(true);
    const [a, u, d] = await Promise.all([api.getAssets(), api.getUsers(), api.getDepartments()]);
    setAssets(a);
    setUsers(u);
    setDepartments(d);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function sortBy(key: SortKey) {
    if (key === sortKey) setSortDesc(!sortDesc);
    else {
      setSortKey(key);
      setSortDesc(false);
    }
  }

  function openAssign(a: any) {
    setOpenRowId(a.id);
    setDraftPerson(a.assigned_person_id ? String(a.assigned_person_id) : "");
    setDraftDept(a.assigned_department_id ? String(a.assigned_department_id) : "");
  }

  async function saveAssign(assetId: number) {
    if (!draftPerson && !draftDept) {
      toast.error("Pick a person, a department, or both, at least one is required");
      return;
    }
    setSaving(true);
    try {
      await api.assignAsset(assetId, {
        assigned_person_id: draftPerson ? Number(draftPerson) : null,
        assigned_department_id: draftDept ? Number(draftDept) : null,
      });
      toast.success("Assignment updated");
      setOpenRowId(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update assignment");
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = assets.filter((a) => {
      const hasAssignment = !!(a.assigned_person_id || a.assigned_department_id);
      if (assignFilter === "unassigned" && hasAssignment) return false;
      if (assignFilter === "assigned" && !hasAssignment) return false;
      if (!q) return true;
      return a.name.toLowerCase().includes(q) || a.tag_id.toLowerCase().includes(q);
    });
    list = [...list].sort((a, b) => {
      const cmp = String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""));
      return sortDesc ? -cmp : cmp;
    });
    return list;
  }, [assets, search, assignFilter, sortKey, sortDesc]);

  const userOptions = users.map((u: any) => ({ id: u.id, label: u.name, sublabel: u.employee_id || undefined }));

  const columns: { key: SortKey; label: string }[] = [
    { key: "name", label: "Asset" },
    { key: "category_name", label: "Category" },
    { key: "status", label: "Status" },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-heading mb-1">Assign</h1>
      <p className="text-body mb-6">Hand assets out, bring them back, and clear an unassigned backlog in one place</p>

      {loading ? (
        <LoadingSpinner />
      ) : assets.length === 0 ? (
        <EmptyState icon={UserPlus2} message="No assets to assign yet" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                placeholder="Search assets"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-border/10 pl-9 pr-3 py-2.5 text-sm bg-surface text-body"
              />
            </div>
            <select
              value={assignFilter}
              onChange={(e) => setAssignFilter(e.target.value as FilterKey)}
              className="rounded-md border border-border/10 px-3 py-2.5 text-sm bg-surface text-body"
            >
              <option value="">All assets</option>
              <option value="unassigned">Unassigned only</option>
              <option value="assigned">Assigned only</option>
            </select>
          </div>

          <div className="bg-surface rounded-xl border border-border/10 overflow-visible">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-surface-alt text-left text-body">
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} onClick={() => sortBy(c.key)} className="px-4 py-3 cursor-pointer select-none hover:text-heading">
                      {c.label}{sortKey === c.key ? (sortDesc ? " ↓" : " ↑") : ""}
                    </th>
                  ))}
                  <th className="px-4 py-3">Assigned To</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const statusInfo = STATUS_META[a.status];
                  const isOpen = openRowId === a.id;
                  const isDetailOpen = detailRowId === a.id;
                  return (
                    <tr key={a.id} className="border-t border-border/10 relative">
                      <td
                        className="px-4 py-3 cursor-pointer"
                        onClick={() => setDetailRowId(isDetailOpen ? null : a.id)}
                      >
                        <p className="font-medium text-heading hover:underline">{a.name}</p>
                        <p className="text-xs text-muted">{a.tag_id}</p>
                        {isDetailOpen && (
                          <div className="mt-2 text-xs text-body bg-surface-alt rounded-md px-2.5 py-2 space-y-1 max-w-xs">
                            <p><span className="text-muted">Serial: </span>{a.serial_code}</p>
                            <p><span className="text-muted">Location: </span>{a.location || "—"}</p>
                            {a.year_manufactured && (
                              <p><span className="text-muted">Year: </span>{a.year_manufactured}</p>
                            )}
                            {a.description && (
                              <p><span className="text-muted">Notes: </span>{a.description}</p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-body">{a.category_name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${statusInfo?.className ?? ""}`}>
                          {statusInfo?.label ?? a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-body">
                        {a.assigned_person_name && a.assigned_department_name
                          ? `${a.assigned_person_name} (${a.assigned_department_name})`
                          : a.assigned_person_name || a.assigned_department_name || "Unassigned"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {a.status === "in_use" ? (
                          <span className="text-xs text-muted">In use, report a return first</span>
                        ) : a.status === "disposed" ? (
                          <span className="text-xs text-muted">Disposed</span>
                        ) : (
                          <button
                            onClick={() => (isOpen ? setOpenRowId(null) : openAssign(a))}
                            className="text-xs font-medium text-brand-orange hover:underline"
                          >
                            {isOpen ? "Close" : "Assign"}
                          </button>
                        )}
                        {isOpen && (
                          <div className="absolute right-4 mt-2 z-30 w-72 bg-surface border border-border/10 rounded-lg shadow-lg p-4 text-left space-y-2">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-medium text-heading">Assign {a.tag_id}</p>
                              <button onClick={() => setOpenRowId(null)} className="text-muted hover:text-heading">
                                <X size={14} />
                              </button>
                            </div>
                            <SearchableSelect
                              value={draftPerson}
                              onChange={setDraftPerson}
                              options={userOptions}
                              placeholder="Not assigned to a person"
                            />
                            <select
                              value={draftDept}
                              onChange={(e) => setDraftDept(e.target.value)}
                              className="w-full rounded-md border border-border/10 px-3 py-2 text-sm bg-surface text-body"
                            >
                              <option value="">Not part of a department pool</option>
                              {departments.map((d: any) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => saveAssign(a.id)}
                              disabled={saving || (!draftPerson && !draftDept)}
                              className="w-full text-sm font-medium text-white bg-brand-orange px-3 py-2 rounded-md hover:opacity-90 disabled:opacity-60"
                            >
                              {saving ? "Saving..." : "Save"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
