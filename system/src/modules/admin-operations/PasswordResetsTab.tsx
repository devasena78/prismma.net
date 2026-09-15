import { useState, useEffect } from "react";
import { Lock, KeyRound, X } from "lucide-react";
import { api } from "../../lib/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import { useToast } from "../../context/ToastContext";

export default function PasswordResetsTab({ onCountChange }: { onCountChange?: () => void }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  async function load() {
    setLoading(true);
    setRequests(await api.getPendingPasswordResets());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(id: number) {
    try {
      await api.approvePasswordReset(id);
      toast.success("Password reset approved");
      load();
      onCountChange?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not approve reset");
    }
  }

  async function reject(id: number) {
    try {
      await api.rejectPasswordReset(id);
      toast.success("Password reset request rejected");
      load();
      onCountChange?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reject request");
    }
  }

  if (loading) return <LoadingSpinner />;
  if (requests.length === 0) return <EmptyState icon={KeyRound} message="No pending password reset requests" />;

  return (
    <div className="space-y-3">
      {requests.map((r: any) => (
        <div key={r.id} className="bg-surface rounded-xl border border-border/10 p-5 flex items-center justify-between">
          <div>
            <p className="font-medium text-heading">{r.user_name}</p>
            <p className="text-sm text-body">{r.user_email} &middot; Requested {new Date(r.requested_at).toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => approve(r.id)} className="flex items-center gap-1.5 rounded-md bg-green-600 text-white px-4 py-2 text-sm font-medium hover:opacity-90">
              <Lock size={14} /> Approve Reset
            </button>
            <button onClick={() => reject(r.id)} className="flex items-center gap-1.5 rounded-md bg-red-50 text-red-600 border border-red-200 px-4 py-2 text-sm font-medium hover:bg-red-100">
              <X size={14} /> Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
