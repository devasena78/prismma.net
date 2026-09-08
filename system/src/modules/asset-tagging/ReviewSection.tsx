import { useState, useEffect } from "react";
import { ClipboardCheck } from "lucide-react";
import { api } from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import Lightbox from "../../components/Lightbox";
import { STATUS_META, DIRECT_STATUS_OPTIONS } from "./statusMeta";

export default function ReviewSection() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [finalStatusDrafts, setFinalStatusDrafts] = useState<Record<number, string>>({});
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const toast = useToast();

  async function load() {
    setLoading(true);
    const pending = await api.getSubmissions("pending");
    setSubmissions(pending);
    const drafts: Record<number, string> = {};
    pending.forEach((s: any) => { drafts[s.id] = s.proposed_status; });
    setFinalStatusDrafts(drafts);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function finalize(submissionId: number) {
    setReviewing(submissionId);
    try {
      await api.reviewSubmission(submissionId, finalStatusDrafts[submissionId]);
      toast.success("Submission finalized");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not finalize submission");
    } finally {
      setReviewing(null);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-heading mb-1">Review</h1>
      <p className="text-body mb-6">Decide the actual outcome for every reported return, the asset's status only changes once you finalize it here</p>

      {loading ? (
        <LoadingSpinner />
      ) : submissions.length === 0 ? (
        <EmptyState icon={ClipboardCheck} message="Nothing waiting for review" />
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => {
            const proposedInfo = STATUS_META[s.proposed_status];
            return (
              <div key={s.id} className="bg-surface rounded-xl border border-border/10 p-4">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <p className="font-medium text-heading">{s.asset_name} <span className="text-muted text-xs font-normal">{s.asset_tag_id}</span></p>
                  <span className="text-xs text-muted">{new Date(s.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-body">
                  Returned by {s.returned_by_person_name || s.returned_by_department_name || "Unknown"}, submitted by {s.submitted_by_name}
                </p>
                <p className="text-sm text-body mt-1">
                  Proposed: <span className={`text-xs px-1.5 py-0.5 rounded ${proposedInfo?.className ?? ""}`}>{proposedInfo?.label ?? s.proposed_status}</span>
                </p>
                {s.detail && <p className="text-sm text-body mt-1 bg-surface-alt rounded-md px-3 py-2">{s.detail}</p>}
                {s.photos?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {s.photos.map((url: string, i: number) => (
                      <img
                        key={i}
                        src={url}
                        alt=""
                        onClick={() => setLightboxSrc(url)}
                        className="w-16 h-16 rounded-md object-cover cursor-pointer"
                      />
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-4">
                  <select
                    value={finalStatusDrafts[s.id] ?? s.proposed_status}
                    onChange={(e) => setFinalStatusDrafts({ ...finalStatusDrafts, [s.id]: e.target.value })}
                    className="rounded-md border border-border/10 px-3 py-2 text-sm bg-surface text-body"
                  >
                    {DIRECT_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => finalize(s.id)}
                    disabled={reviewing === s.id}
                    className="text-sm font-medium text-white bg-brand-orange px-4 py-2 rounded-md hover:opacity-90 disabled:opacity-60"
                  >
                    {reviewing === s.id ? "Finalizing..." : "Finalize"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}
