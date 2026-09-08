import { useState, useEffect } from "react";
import { X, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useEscapeKey } from "../../lib/useEscapeKey";
import ConfirmDialog from "../../components/ConfirmDialog";
import Lightbox from "../../components/Lightbox";
import PhotoManager from "./PhotoManager";
import { STATUS_META, STATUS_OPTIONS, DIRECT_STATUS_OPTIONS } from "./statusMeta";

interface Props {
  assetId: number;
  isAssetAdmin: boolean;
  isSuperadmin: boolean;
  onClose: () => void;
  onChanged: () => void;
  onNavigateToAsset: (id: number) => void;
}

type Tab = "overview" | "history" | "identity";

export default function AssetDetailPanel({ assetId, isAssetAdmin, isSuperadmin, onClose, onChanged }: Props) {
  const { user } = useAuth();
  const toast = useToast();

  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const [locationDraft, setLocationDraft] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);

  const [identityForm, setIdentityForm] = useState<any>({});
  const [categories, setCategories] = useState<any[]>([]);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [savingIdentity, setSavingIdentity] = useState(false);

  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editNoteContent, setEditNoteContent] = useState("");
  const [pendingNoteAction, setPendingNoteAction] = useState<{ type: "edit" | "delete"; noteId: number } | null>(null);

  useEscapeKey(() => {
    if (!pendingNoteAction) onClose();
  });

  async function load() {
    setLoading(true);
    const [a, cats] = await Promise.all([api.getAsset(assetId), api.getAssetCategories()]);
    setAsset(a);
    setCategories(cats);
    setLocationDraft(a.location || "");
    setIdentityForm({
      name: a.name,
      description: a.description || "",
      category_id: a.category_id,
      serial_code: a.serial_code,
      year_manufactured: a.year_manufactured ?? "",
      status: a.status,
      photos: a.photos || [],
    });
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [assetId]);

  useEffect(() => {
    if (tab === "history" && isAssetAdmin) {
      setHistoryLoading(true);
      api.getAssetHistory(assetId).then((h) => {
        setHistory(h);
        setHistoryLoading(false);
      });
    }
  }, [tab, assetId, isAssetAdmin]);

  async function saveLocation() {
    setSavingLocation(true);
    try {
      await api.updateAsset(assetId, { location: locationDraft || null });
      toast.success("Location updated");
      load();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update location");
    } finally {
      setSavingLocation(false);
    }
  }

  async function saveIdentity() {
    setSavingIdentity(true);
    setIdentityError(null);
    try {
      const payload: Record<string, unknown> = {
        name: identityForm.name,
        description: identityForm.description || null,
        category_id: Number(identityForm.category_id),
        photo_urls: identityForm.photos,
      };
      payload.year_manufactured = identityForm.year_manufactured
        ? Number(identityForm.year_manufactured)
        : null;
      if (isSuperadmin) {
        payload.serial_code = identityForm.serial_code;
        if (identityForm.status !== asset.status) {
          payload.status = identityForm.status;
        }
      }
      await api.updateAsset(assetId, payload);
      toast.success("Details updated");
      load();
      onChanged();
    } catch (err: any) {
      setIdentityError(err?.detail?.message || (err instanceof Error ? err.message : "Could not save changes"));
    } finally {
      setSavingIdentity(false);
    }
  }

  async function submitNewNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      await api.addAssetNote(assetId, newNote.trim());
      setNewNote("");
      toast.success("Note added");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add note");
    } finally {
      setAddingNote(false);
    }
  }

  function startEditNote(note: any) {
    setEditingNoteId(note.id);
    setEditNoteContent(note.content);
  }

  function requestSaveNoteEdit() {
    if (!editingNoteId) return;
    setPendingNoteAction({ type: "edit", noteId: editingNoteId });
  }

  function requestDeleteNote(noteId: number) {
    setPendingNoteAction({ type: "delete", noteId });
  }

  async function confirmNoteAction() {
    if (!pendingNoteAction) return;
    const { type, noteId } = pendingNoteAction;
    setPendingNoteAction(null);
    try {
      if (type === "edit") {
        await api.editAssetNote(noteId, editNoteContent);
        toast.success("Note updated");
        setEditingNoteId(null);
      } else {
        await api.deleteAssetNote(noteId);
        toast.success("Note deleted");
      }
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update note");
    }
  }

  const statusInfo = asset ? STATUS_META[asset.status] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-surface rounded-xl border border-border/10 max-w-lg w-full shadow-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/10">
          <h3 className="font-display text-lg font-semibold text-heading">Asset Details</h3>
          <button onClick={onClose} className="text-body hover:text-heading">
            <X size={18} />
          </button>
        </div>

        {loading || !asset ? (
          <p className="text-sm text-body py-10 text-center">Loading...</p>
        ) : (
          <>
            <div className="px-6 pt-5 flex items-center gap-3">
              {asset.photos?.[0] ? (
                <img src={asset.photos[0]} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-surface-alt shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-heading text-lg truncate">{asset.name}</p>
                <p className="text-sm text-muted">{asset.tag_id}</p>
              </div>
              {statusInfo && (
                <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${statusInfo.className}`}>{statusInfo.label}</span>
              )}
            </div>

            {isAssetAdmin && (
              <div className="flex gap-1 px-6 mt-4 border-b border-border/10">
                {(["overview", "history", "identity"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-3 py-2 text-sm font-medium capitalize border-b-2 ${
                      tab === t ? "border-brand-orange text-heading" : "border-transparent text-body hover:text-heading"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            <div className="p-6 space-y-6">
              {tab === "overview" && (
                <>
                  {asset.photos?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {asset.photos.map((url: string, i: number) => (
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

                  {asset.description && (
                    <p className="text-sm text-body bg-surface-alt rounded-md px-3 py-2.5">{asset.description}</p>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted text-xs">Category</p>
                      <p className="text-heading">{asset.category_name}</p>
                    </div>
                    <div>
                      <p className="text-muted text-xs">Serial Code</p>
                      <p className="text-heading">{asset.serial_code}</p>
                    </div>
                    <div>
                      <p className="text-muted text-xs">Year Manufactured</p>
                      <p className="text-heading">{asset.year_manufactured || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted text-xs">Assigned To</p>
                      <p className="text-heading">
                        {asset.assigned_person_name && asset.assigned_department_name
                          ? `${asset.assigned_person_name} (${asset.assigned_department_name})`
                          : asset.assigned_person_name || asset.assigned_department_name || "Unassigned"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-muted text-xs mb-1">Location</p>
                    {isAssetAdmin ? (
                      <div className="flex gap-2">
                        <input
                          value={locationDraft}
                          onChange={(e) => setLocationDraft(e.target.value)}
                          placeholder="Not set"
                          className="flex-1 rounded-md border border-border/10 px-3 py-2 text-sm bg-surface text-body"
                        />
                        <button
                          onClick={saveLocation}
                          disabled={savingLocation || locationDraft === (asset.location || "")}
                          className="text-sm font-medium text-white bg-brand-orange px-3 py-2 rounded-md hover:opacity-90 disabled:opacity-40"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <p className="text-heading text-sm">{asset.location || "—"}</p>
                    )}
                  </div>

                  <div className="border-t border-border/10 pt-4">
                    <p className="text-sm font-medium text-heading mb-3">Notes</p>
                    <form onSubmit={submitNewNote} className="space-y-2 mb-4">
                      <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Add a note"
                        rows={2}
                        className="w-full rounded-md border border-border/10 px-3 py-2 text-sm bg-surface text-body resize-y"
                      />
                      <button disabled={addingNote} className="rounded-md bg-brand-orange text-white px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60">
                        {addingNote ? "Adding..." : "Add"}
                      </button>
                    </form>

                    {asset.notes.length === 0 ? (
                      <p className="text-xs text-muted">No notes yet</p>
                    ) : (
                      <div className="space-y-2">
                        {asset.notes.map((n: any) => {
                          const isOwner = n.author_id === user?.id;
                          const canEdit = isOwner || isAssetAdmin;
                          return (
                            <div key={n.id} className="rounded-md border border-border/10 px-3 py-2.5 text-sm">
                              {editingNoteId === n.id ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={editNoteContent}
                                    onChange={(e) => setEditNoteContent(e.target.value)}
                                    rows={3}
                                    className="w-full rounded-md border border-border/10 px-3 py-2 text-sm bg-surface text-body"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button onClick={() => setEditingNoteId(null)} className="text-xs text-body hover:underline">Cancel</button>
                                    <button onClick={requestSaveNoteEdit} className="text-xs font-medium text-brand-orange hover:underline">Save</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="text-body whitespace-pre-wrap">{n.content}</p>
                                  <div className="flex items-center justify-between mt-1.5">
                                    <p className="text-xs text-muted">
                                      {n.author_name} · {new Date(n.created_at).toLocaleString()}
                                      {n.edited ? " · edited" : ""}
                                    </p>
                                    {canEdit && (
                                      <div className="flex items-center gap-2">
                                        <button onClick={() => startEditNote(n)} className="text-muted hover:text-heading">
                                          <Pencil size={12} />
                                        </button>
                                        {isAssetAdmin && (
                                          <button onClick={() => requestDeleteNote(n.id)} className="text-muted hover:text-red-600">
                                            <Trash2 size={12} />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}

              {tab === "history" && isAssetAdmin && (
                <div>
                  {historyLoading ? (
                    <p className="text-sm text-body">Loading...</p>
                  ) : history.length === 0 ? (
                    <p className="text-sm text-muted">No history recorded yet</p>
                  ) : (
                    <div className="space-y-2">
                      {history.map((h: any) => (
                        <div key={h.id} className="rounded-md border border-border/10 px-3 py-2.5 text-sm">
                          <p className="text-heading font-medium">{h.action.replace(/_/g, " ")}</p>
                          <p className="text-xs text-muted mt-0.5">
                            {h.actor_name ? `By ${h.actor_name}` : "System"} · {new Date(h.created_at).toLocaleString()}
                          </p>
                          {h.detail && <p className="text-xs text-body mt-1 whitespace-pre-wrap">{h.detail}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === "identity" && isAssetAdmin && (
                <div className="space-y-3">
                  <PhotoManager photos={identityForm.photos} onChange={(photos) => setIdentityForm({ ...identityForm, photos })} />

                  <input
                    value={identityForm.name}
                    onChange={(e) => setIdentityForm({ ...identityForm, name: e.target.value })}
                    placeholder="Name"
                    className="w-full rounded-md border border-border/10 px-3 py-2.5 text-sm bg-surface text-body"
                  />
                  <textarea
                    value={identityForm.description}
                    onChange={(e) => setIdentityForm({ ...identityForm, description: e.target.value })}
                    placeholder="Description (usage notes, care instructions)"
                    rows={2}
                    className="w-full rounded-md border border-border/10 px-3 py-2.5 text-sm bg-surface text-body resize-y"
                  />
                  <select
                    value={identityForm.category_id}
                    onChange={(e) => setIdentityForm({ ...identityForm, category_id: e.target.value })}
                    className="w-full rounded-md border border-border/10 px-3 py-2.5 text-sm bg-surface text-body"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <div>
                    <select
                      value={identityForm.status}
                      onChange={(e) => setIdentityForm({ ...identityForm, status: e.target.value })}
                      disabled={!isSuperadmin || asset.status === "in_use"}
                      className="w-full rounded-md border border-border/10 px-3 py-2.5 text-sm bg-surface text-body disabled:opacity-50"
                    >
                      {asset.status === "in_use" && (
                        <option value="in_use">In Use</option>
                      )}
                      {DIRECT_STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                    {!isSuperadmin ? (
                      <p className="text-xs text-muted mt-1">Only a superadmin can change status directly here</p>
                    ) : asset.status === "in_use" ? (
                      <p className="text-xs text-muted mt-1">Currently in use, report a return through Submissions to change this</p>
                    ) : null}
                  </div>
                  <div>
                    <input
                      value={identityForm.serial_code}
                      onChange={(e) => setIdentityForm({ ...identityForm, serial_code: e.target.value })}
                      placeholder="Serial code"
                      disabled={!isSuperadmin}
                      className="w-full rounded-md border border-border/10 px-3 py-2.5 text-sm bg-surface text-body disabled:opacity-50"
                    />
                    {!isSuperadmin && <p className="text-xs text-muted mt-1">Only a superadmin can change the serial code</p>}
                  </div>
                  <div>
                    <input
                      type="number"
                      min={1900}
                      max={2100}
                      value={identityForm.year_manufactured}
                      onChange={(e) => setIdentityForm({ ...identityForm, year_manufactured: e.target.value })}
                      placeholder="Year manufactured"
                      className="w-full rounded-md border border-border/10 px-3 py-2.5 text-sm bg-surface text-body"
                    />
                  </div>

                  {identityError && (
                    <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span>{identityError}</span>
                    </div>
                  )}

                  <button
                    onClick={saveIdentity}
                    disabled={savingIdentity}
                    className="w-full text-sm font-medium text-white bg-brand-orange px-4 py-2.5 rounded-md hover:opacity-90 disabled:opacity-60"
                  >
                    {savingIdentity ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {pendingNoteAction && (
        <ConfirmDialog
          title={pendingNoteAction.type === "edit" ? "Save changes to this note?" : "Delete this note?"}
          message="You're changing information on this asset that others may currently be relying on. If this note contains login details or similar, double-check accuracy before continuing, an incorrect change here could lock the next person out."
          confirmLabel={pendingNoteAction.type === "edit" ? "Save" : "Delete"}
          onConfirm={confirmNoteAction}
          onCancel={() => setPendingNoteAction(null)}
        />
      )}

      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}
