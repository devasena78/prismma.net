import { useState, useEffect, useMemo } from "react";
import { Check, X, Search, UserCheck } from "lucide-react";
import { api } from "../../lib/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import { useToast } from "../../context/ToastContext";

export default function RegistrationsTab({ onCountChange }: { onCountChange?: () => void }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const toast = useToast();

  async function load() {
    setLoading(true);
    setUsers(await api.getPendingRegistrations());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(id: number) {
    try {
      await api.approveRegistration(id);
      toast.success("Registration approved");
      load();
      onCountChange?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not approve registration");
    }
  }

  async function reject(id: number) {
    try {
      await api.rejectRegistration(id, reason || "No reason given");
      toast.success("Registration rejected");
      setRejectingId(null);
      setReason("");
      load();
      onCountChange?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reject registration");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.employee_id?.toLowerCase().includes(q)
    );
  }, [users, search]);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-body" />
        <input
          placeholder="Search by name, email, or employee ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-border/10 pl-9 pr-3 py-2.5 text-sm bg-surface text-body"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          message={users.length === 0 ? "No pending registrations" : "No matches for your search"}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((u) => (
            <div key={u.id} className="bg-surface rounded-xl border border-border/10 p-5 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-medium text-heading">{u.name}</p>
                <p className="text-sm text-body">{u.email} &middot; ID {u.employee_id}</p>
              </div>
              {rejectingId === u.id ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    placeholder="Reason for rejection"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="rounded-md border border-border/10 px-3 py-2 text-sm bg-surface text-body"
                  />
                  <button onClick={() => reject(u.id)} className="text-sm text-red-600 font-medium">Confirm</button>
                  <button onClick={() => setRejectingId(null)} className="text-sm text-body">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => approve(u.id)} className="flex items-center gap-1.5 rounded-md bg-green-600 text-white px-4 py-2 text-sm font-medium hover:opacity-90">
                    <Check size={14} /> Approve
                  </button>
                  <button onClick={() => setRejectingId(u.id)} className="flex items-center gap-1.5 rounded-md bg-red-50 text-red-600 border border-red-200 px-4 py-2 text-sm font-medium hover:bg-red-100">
                    <X size={14} /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
