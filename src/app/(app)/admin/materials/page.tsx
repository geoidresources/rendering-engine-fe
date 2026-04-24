'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import PageShell from '@/components/ui/PageShell';
import Panel from '@/components/ui/Panel';
import {
  useMaterialDensities,
  useUpsertMaterialDensity,
  useDeleteMaterialDensity,
  type MaterialDensity,
} from '@/hooks/useMaterialDensities';

function SourceBadge({ source }: { source: MaterialDensity['source'] }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${
        source === 'client'
          ? 'bg-accent/10 text-accent border-accent/30'
          : 'bg-bg-elevated text-text-muted border-border-subtle'
      }`}
    >
      {source === 'client' ? 'override' : 'default'}
    </span>
  );
}

interface RowFormState {
  material: string;
  bulk_density_t_m3: string;
  swell_factor: string;
}

const EMPTY_FORM: RowFormState = { material: '', bulk_density_t_m3: '', swell_factor: '' };

function parseForm(f: RowFormState): { material: string; bulk_density_t_m3: number; swell_factor: number } | null {
  const density = parseFloat(f.bulk_density_t_m3);
  const swell = parseFloat(f.swell_factor);
  if (!f.material.trim() || !Number.isFinite(density) || density <= 0) return null;
  return { material: f.material.trim(), bulk_density_t_m3: density, swell_factor: Number.isFinite(swell) ? swell : 0 };
}

export default function MaterialsAdminPage() {
  const { data: rows = [], isLoading, error } = useMaterialDensities();
  const upsert = useUpsertMaterialDensity();
  const del = useDeleteMaterialDensity();

  const [editingMaterial, setEditingMaterial] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RowFormState>(EMPTY_FORM);
  const [addForm, setAddForm] = useState<RowFormState>(EMPTY_FORM);
  const [showAdd, setShowAdd] = useState(false);

  const startEdit = (row: MaterialDensity) => {
    setEditingMaterial(row.material);
    setEditForm({
      material: row.material,
      bulk_density_t_m3: String(row.bulk_density_t_m3),
      swell_factor: String(row.swell_factor),
    });
  };

  const cancelEdit = () => setEditingMaterial(null);

  const commitEdit = async () => {
    const parsed = parseForm(editForm);
    if (!parsed) { toast.error('Check the values — density must be a positive number.'); return; }
    await upsert.mutateAsync(parsed);
    setEditingMaterial(null);
    toast.success(`Updated ${parsed.material}`);
  };

  const commitAdd = async () => {
    const parsed = parseForm(addForm);
    if (!parsed) { toast.error('Check the values — material and density are required.'); return; }
    await upsert.mutateAsync(parsed);
    setAddForm(EMPTY_FORM);
    setShowAdd(false);
    toast.success(`Added ${parsed.material}`);
  };

  const handleDelete = async (material: string) => {
    if (!confirm(`Delete override for "${material}"? The default LUT value will be used instead.`)) return;
    await del.mutateAsync(material);
    toast.success(`Removed override for ${material}`);
  };

  return (
    <PageShell
      title="Material Densities"
      description="Override per-tenant bulk density (t/m³) and swell factor. Default rows are seeded from the system LUT; tenant overrides take precedence."
    >
      {isLoading && (
        <div className="flex items-center gap-2 text-text-muted text-sm">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      )}
      {error && (
        <p className="text-red-400 text-sm">Could not load densities: {error.message}</p>
      )}
      {!isLoading && !error && (
        <Panel className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-elevated">
                <th className="text-left px-4 py-2 text-[10px] uppercase tracking-[0.15em] text-text-muted font-medium">Material</th>
                <th className="text-right px-4 py-2 text-[10px] uppercase tracking-[0.15em] text-text-muted font-medium">Density (t/m³)</th>
                <th className="text-right px-4 py-2 text-[10px] uppercase tracking-[0.15em] text-text-muted font-medium">Swell</th>
                <th className="text-center px-4 py-2 text-[10px] uppercase tracking-[0.15em] text-text-muted font-medium">Source</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map((row) => (
                <tr key={row.material} className="hover:bg-bg-elevated/50 group">
                  {editingMaterial === row.material ? (
                    <>
                      <td className="px-4 py-2">
                        <span className="text-text-primary font-medium">{row.material}</span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editForm.bulk_density_t_m3}
                          onChange={(e) => setEditForm((f) => ({ ...f, bulk_density_t_m3: e.target.value }))}
                          className="w-24 rounded-sm border border-border-subtle bg-bg-surface px-2 py-1 text-right text-[12px] text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/60"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={editForm.swell_factor}
                          onChange={(e) => setEditForm((f) => ({ ...f, swell_factor: e.target.value }))}
                          className="w-20 rounded-sm border border-border-subtle bg-bg-surface px-2 py-1 text-right text-[12px] text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/60"
                        />
                      </td>
                      <td className="px-4 py-2 text-center" />
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            type="button"
                            onClick={commitEdit}
                            disabled={upsert.isPending}
                            className="size-6 grid place-items-center rounded-sm text-green-400 hover:bg-green-500/15 disabled:opacity-50"
                          >
                            {upsert.isPending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="size-6 grid place-items-center rounded-sm text-text-muted hover:bg-bg-surface"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2 font-medium text-text-primary">{row.material}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-text-primary">{row.bulk_density_t_m3.toFixed(3)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-text-muted">{(row.swell_factor * 100).toFixed(0)}%</td>
                      <td className="px-4 py-2 text-center"><SourceBadge source={row.source} /></td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            title="Edit"
                            className="size-6 grid place-items-center rounded-sm text-text-muted hover:text-text-primary hover:bg-bg-surface"
                          >
                            <Pencil className="size-3" />
                          </button>
                          {row.source === 'client' && (
                            <button
                              type="button"
                              onClick={() => handleDelete(row.material)}
                              disabled={del.isPending}
                              title="Remove override"
                              className="size-6 grid place-items-center rounded-sm text-text-muted hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}

              {showAdd && (
                <tr className="bg-bg-elevated/30">
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      placeholder="Material name"
                      value={addForm.material}
                      onChange={(e) => setAddForm((f) => ({ ...f, material: e.target.value }))}
                      className="w-full rounded-sm border border-border-subtle bg-bg-surface px-2 py-1 text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/60"
                      autoFocus
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 1.65"
                      value={addForm.bulk_density_t_m3}
                      onChange={(e) => setAddForm((f) => ({ ...f, bulk_density_t_m3: e.target.value }))}
                      className="w-24 rounded-sm border border-border-subtle bg-bg-surface px-2 py-1 text-right text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/60"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      placeholder="0.12"
                      value={addForm.swell_factor}
                      onChange={(e) => setAddForm((f) => ({ ...f, swell_factor: e.target.value }))}
                      className="w-20 rounded-sm border border-border-subtle bg-bg-surface px-2 py-1 text-right text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/60"
                    />
                  </td>
                  <td className="px-4 py-2" />
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        type="button"
                        onClick={commitAdd}
                        disabled={upsert.isPending}
                        className="size-6 grid place-items-center rounded-sm text-green-400 hover:bg-green-500/15 disabled:opacity-50"
                      >
                        {upsert.isPending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowAdd(false); setAddForm(EMPTY_FORM); }}
                        className="size-6 grid place-items-center rounded-sm text-text-muted hover:bg-bg-surface"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="px-4 py-2 border-t border-border-subtle">
            <button
              type="button"
              onClick={() => { setShowAdd(true); setEditingMaterial(null); }}
              disabled={showAdd}
              className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-text-muted hover:text-accent disabled:opacity-40 transition-colors"
            >
              <Plus className="size-3" /> Add material override
            </button>
          </div>
        </Panel>
      )}
    </PageShell>
  );
}
