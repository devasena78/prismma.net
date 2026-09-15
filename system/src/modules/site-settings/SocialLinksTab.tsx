import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { api } from "../../lib/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import { useToast } from "../../context/ToastContext";
import ConfirmDialog from "../../components/ConfirmDialog";

const FIELD_CLASS = "rounded-md border border-border/10 px-3 py-2 text-sm bg-surface text-body";

function LinkGroup({ type, title, hint }: { type: "social" | "footer" | "phone"; title: string; hint: string }) {
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const toast = useToast();

  async function load() {
    setLoading(true);
    setLinks(await api.getSiteLinks(type));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !url.trim()) return;
    try {
      await api.createSiteLink({ type, label: label.trim(), url: url.trim(), order: links.length });
      setLabel("");
      setUrl("");
      toast.success("Link added");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add link");
    }
  }

  function startEdit(l: any) {
    setEditingId(l.id);
    setEditLabel(l.label);
    setEditUrl(l.url);
  }

  async function saveEdit() {
    if (!editingId) return;
    try {
      await api.updateSiteLink(editingId, { label: editLabel, url: editUrl });
      setEditingId(null);
      toast.success("Link updated");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update link");
    }
  }

  async function confirmDelete() {
    if (!deletingId) return;
    try {
      await api.deleteSiteLink(deletingId);
      toast.success("Link removed");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove link");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mb-8">
      <p className="text-sm font-semibold text-heading">{title}</p>
      <p className="text-xs text-muted mb-3">{hint}</p>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-2 mb-3">
          {links.map((l) => (
            <div key={l.id} className="flex items-center gap-2 rounded-md border border-border/10 px-3 py-2">
              {editingId === l.id ? (
                <>
                  <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className={`${FIELD_CLASS} flex-1`} />
                  <input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} className={`${FIELD_CLASS} flex-[2]`} />
                  <button onClick={saveEdit} className="text-xs font-medium text-brand-orange hover:underline shrink-0">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-body hover:underline shrink-0">Cancel</button>
                </>
              ) : (
                <>
                  <span className="text-sm text-heading w-32 shrink-0 truncate">{l.label}</span>
                  <span className="text-sm text-muted flex-1 truncate">{l.url}</span>
                  <button onClick={() => startEdit(l)} className="text-muted hover:text-heading shrink-0">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setDeletingId(l.id)} className="text-muted hover:text-red-600 shrink-0">
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
          {links.length === 0 && <p className="text-sm text-muted">None added yet</p>}
        </div>
      )}

      <form onSubmit={add} className="flex gap-2">
        <input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} className={`${FIELD_CLASS} w-32`} />
        <input placeholder="URL" value={url} onChange={(e) => setUrl(e.target.value)} className={`${FIELD_CLASS} flex-[2]`} />
        <button className="flex items-center gap-1 rounded-md bg-brand-orange text-white px-3 py-2 text-sm font-medium hover:opacity-90 shrink-0">
          <Plus size={14} /> Add
        </button>
      </form>

      {deletingId !== null && (
        <ConfirmDialog
          title="Remove this link?"
          message="This removes it from the live site immediately."
          confirmLabel="Remove"
          onConfirm={confirmDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
}

export default function SocialLinksTab() {
  return (
    <div className="max-w-2xl">
      <LinkGroup type="social" title="Social Links" hint="Shown in the homepage footer, Facebook, Instagram, LinkedIn, and so on" />
      <LinkGroup type="phone" title="Phone Numbers" hint="Shown in the homepage footer, one per row, e.g. label 'Sales', number '+6 010 660 6600'" />
    </div>
  );
}
