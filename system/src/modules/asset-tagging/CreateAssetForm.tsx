import { useState, useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";
import { api } from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import { useEscapeKey } from "../../lib/useEscapeKey";
import ConfirmDialog from "../../components/ConfirmDialog";
import PhotoManager from "./PhotoManager";
import { DIRECT_STATUS_OPTIONS } from "./statusMeta";

const EMPTY_FORM = {
  name: "",
  description: "",
  photos: [] as string[],
  category_id: "",
  serial_code: "",
  status: "in_storage",
  location: "",
  year_manufactured: "",
};

interface Props {
  onClose: () => void;
  onCreated: (newAssetId?: number) => void;
  onNavigateToAsset: (id: number) => void;
}

export default function CreateAssetForm({ onClose, onCreated, onNavigateToAsset }: Props) {
  const [categories, setCategories] = useState<any[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ id: number; tagId: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const toast = useToast();

  const hasChanges = JSON.stringify(form) !== JSON.stringify(EMPTY_FORM);

  function attemptClose() {
    if (hasChanges) setConfirmDiscard(true);
    else onClose();
  }

  useEscapeKey(() => {
    if (!confirmDiscard) attemptClose();
  });

  useEffect(() => {
    api.getAssetCategories().then((cats) => {
      setCategories(cats);
      if (cats.length > 0) setForm((f) => ({ ...f, category_id: cats[0].id }));
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setConflict(null);
    setSaving(true);
    try {
      const created = await api.createAsset({
        name: form.name,
        description: form.description || undefined,
        photo_urls: form.photos,
        category_id: Number(form.category_id),
        serial_code: form.serial_code,
        status: form.status,
        location: form.location || undefined,
        year_manufactured: form.year_manufactured ? Number(form.year_manufactured) : undefined,
      });
      toast.success("Asset created, assign it to a person or department whenever you're ready");
      onCreated(created.id);
      onClose();
    } catch (err: any) {
      if (err?.detail?.conflicting_asset_id) {
        setError(err.detail.message);
        setConflict({ id: err.detail.conflicting_asset_id, tagId: err.detail.conflicting_asset_tag_id });
      } else {
        setError(err instanceof Error ? err.message : "Could not create asset");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-surface rounded-xl border border-border/10 max-w-md w-full shadow-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/10">
          <h3 className="font-display text-lg font-semibold text-heading">Add Asset</h3>
          <button onClick={attemptClose} className="text-body hover:text-heading">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3">
          <PhotoManager photos={form.photos} onChange={(photos) => setForm({ ...form, photos })} />

          <input
            required
            placeholder="Name (e.g. MacBook Pro 14)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-md border border-border/10 px-3 py-2.5 text-sm bg-surface text-body"
          />
          <textarea
            placeholder="Description (e.g. usage notes, care instructions)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full rounded-md border border-border/10 px-3 py-2.5 text-sm bg-surface text-body resize-y"
          />
          <select
            required
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            className="w-full rounded-md border border-border/10 px-3 py-2.5 text-sm bg-surface text-body"
          >
            <option value="" disabled>Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input
            required
            placeholder="Serial code (from the manufacturer)"
            value={form.serial_code}
            onChange={(e) => setForm({ ...form, serial_code: e.target.value })}
            className="w-full rounded-md border border-border/10 px-3 py-2.5 text-sm bg-surface text-body"
          />
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full rounded-md border border-border/10 px-3 py-2.5 text-sm bg-surface text-body"
          >
            {DIRECT_STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <input
            placeholder="Location (optional)"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="w-full rounded-md border border-border/10 px-3 py-2.5 text-sm bg-surface text-body"
          />
          <input
            type="number"
            placeholder="Year manufactured (optional)"
            min={1900}
            max={2100}
            value={form.year_manufactured}
            onChange={(e) => setForm({ ...form, year_manufactured: e.target.value })}
            className="w-full rounded-md border border-border/10 px-3 py-2.5 text-sm bg-surface text-body"
          />

          <p className="text-xs text-muted">
            You can assign this to a person or department from the Assign section once it's created.
          </p>

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <div>
                <span>{error}</span>
                {conflict && (
                  <button
                    type="button"
                    onClick={() => onNavigateToAsset(conflict.id)}
                    className="block underline font-medium mt-1"
                  >
                    Open {conflict.tagId} to fix it there
                  </button>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-md bg-brand-orange px-6 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Creating..." : "Create Asset"}
          </button>
        </form>
      </div>

      {confirmDiscard && (
        <ConfirmDialog
          title="Discard changes?"
          message="You have unsaved information in this form. Closing now will discard it."
          confirmLabel="Discard"
          onConfirm={() => {
            setConfirmDiscard(false);
            onClose();
          }}
          onCancel={() => setConfirmDiscard(false)}
        />
      )}
    </div>
  );
}
