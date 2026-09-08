import { useState, useEffect } from "react";
import { ClipboardList, Plus, X } from "lucide-react";
import { api } from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import Lightbox from "../../components/Lightbox";
import SearchableSelect from "./SearchableSelect";
import PhotoManager from "./PhotoManager";
import { STATUS_META, DIRECT_STATUS_OPTIONS } from "./statusMeta";

function SubmissionCard({ s, onPhotoClick }: { s: any; onPhotoClick: (url: string) => void }) {
  const proposedInfo = STATUS_META[s.proposed_status];
  return (
    <div className="bg-surface rounded-xl border border-border/10 p-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="font-medium text-heading">{s.asset_name} <span className="text-muted text-xs font-normal">{s.asset_tag_id}</span></p>
          <p className="text-xs text-muted mt-0.5">
            Returned by {s.returned_by_person_name || s.returned_by_department_name || "Unknown"} · Submitted by {s.submitted_by_name} · {new Date(s.created_at).toLocaleString()}
          </p>
        </div>
        {s.status === "pending" ? (
          <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            Pending review
          </span>
        ) : (
          <span className={`text-xs px-2 py-1 rounded-full ${STATUS_META[s.final_status]?.className ?? ""}`}>
            Finalized: {STATUS_META[s.final_status]?.label ?? s.final_status}
          </span>
        )}
      </div>
      <p className="text-sm text-body mt-2">
        Proposed: <span className={`text-xs px-1.5 py-0.5 rounded ${proposedInfo?.className ?? ""}`}>{proposedInfo?.label ?? s.proposed_status}</span>
      </p>
      {s.detail && <p className="text-sm text-body mt-1">{s.detail}</p>}
      {s.photos?.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {s.photos.map((url: string, i: number) => (
            <img
              key={i}
              src={url}
              alt=""
              onClick={() => onPhotoClick(url)}
              className="w-16 h-16 rounded-md object-cover cursor-pointer"
            />
          ))}
        </div>
      )}
      {s.status === "reviewed" && (
        <p className="text-xs text-muted mt-2">
          Reviewed by {s.reviewed_by_name} · {new Date(s.reviewed_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}

export default function SubmissionsSection() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"" | "reviewed">("");
  const [showCreate, setShowCreate] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await api.getSubmissions(filter || undefined);
    setSubmissions(r);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [filter]);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <div>
          <h1 className="font-display text-2xl font-semibold text-heading">Submissions</h1>
          <p className="text-body">Report a return, or see what's still waiting on review</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-md bg-brand-orange text-white px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          <Plus size={14} /> New Submission
        </button>
      </div>

      <div className="flex items-center gap-2 my-5">
        {(["", "reviewed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${
              filter === f ? "bg-brand-orange text-white" : "text-body hover:bg-surface-alt"
            }`}
          >
            {f === "" ? "All" : "Reviewed"}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : submissions.length === 0 ? (
        <EmptyState icon={ClipboardList} message="No submissions yet" />
      ) : (
        <div className="space-y-2">
          {submissions.map((s) => (
            <SubmissionCard key={s.id} s={s} onPhotoClick={setLightboxSrc} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateSubmissionForm
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            load();
            setShowCreate(false);
          }}
        />
      )}

      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}

function CreateSubmissionForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [assets, setAssets] = useState<any[]>([]);
  const [assetId, setAssetId] = useState("");
  const [proposedStatus, setProposedStatus] = useState("under_repair");
  const [detail, setDetail] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    api.getAssets().then((all) => {
      const inUse = all.filter((a: any) => a.assigned_person_id || a.assigned_department_id);
      setAssets(inUse);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!assetId) return;
    setError(null);
    setSaving(true);
    try {
      await api.createSubmission(Number(assetId), {
        proposed_status: proposedStatus,
        detail: detail || undefined,
        photo_urls: photos,
      });
      toast.success("Submission created, waiting on superadmin review");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create submission");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-surface rounded-xl border border-border/10 max-w-md w-full shadow-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/10">
          <h3 className="font-display text-lg font-semibold text-heading">New Submission</h3>
          <button onClick={onClose} className="text-body hover:text-heading">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3">
          {assets.length === 0 ? (
            <p className="text-sm text-muted">No assets are currently in use, so there's nothing to report a return for right now.</p>
          ) : (
            <>
              <SearchableSelect
                value={assetId}
                onChange={setAssetId}
                options={assets.map((a: any) => ({
                  id: a.id,
                  label: `${a.name} (${a.tag_id})`,
                  sublabel: `with ${a.assigned_person_name || a.assigned_department_name}`,
                }))}
                placeholder="Select the asset being returned"
              />
              <select
                value={proposedStatus}
                onChange={(e) => setProposedStatus(e.target.value)}
                className="w-full rounded-md border border-border/10 px-3 py-2.5 text-sm bg-surface text-body"
              >
                {DIRECT_STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="What condition did it come back in?"
                rows={2}
                className="w-full rounded-md border border-border/10 px-3 py-2.5 text-sm bg-surface text-body resize-y"
              />
              <PhotoManager photos={photos} onChange={setPhotos} />

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={saving || !assetId}
                className="w-full text-sm font-medium text-white bg-brand-orange px-4 py-2.5 rounded-md hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Submitting..." : "Submit"}
              </button>
              <p className="text-xs text-muted text-center">This goes to Review before the status actually changes.</p>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
