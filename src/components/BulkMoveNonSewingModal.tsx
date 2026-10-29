import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { makeT, localizeMessage } from '../services/translations';
import { useAuth } from '../services/authContext';
import { supabase } from '../services/supabase';
import { sortSites } from '../services/siteOrder';

export interface BulkMachine { asset_code: string; site_id: string; location_id: string | null; status: string }
export interface BulkLoc { location_id: string; site_id: string; type: string; display_name: string }

interface Props {
  machines: BulkMachine[];
  locs: BulkLoc[];
  onClose: () => void;
  onDone: (message: string) => void;
}

const STATUSES = ['ACTIVE', 'BROKEN', 'IN_REPAIR'];

const inputCls =
  'w-full px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 ' +
  'text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500';
const btnPrimary =
  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 ' +
  'text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const btnGhost =
  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 ' +
  'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50';

export const BulkMoveNonSewingModal: React.FC<Props> = ({ machines, locs, onClose, onDone }) => {
  const { language } = useAuth();
  const t = makeT(language);

  // kelompokkan per site: satu pemindahan = satu site = satu lokasi tujuan
  const groups = useMemo(() => {
    const m = new Map<string, BulkMachine[]>();
    machines.forEach((x) => m.set(x.site_id, [...(m.get(x.site_id) ?? []), x]));
    return sortSites([...m.keys()].map((siteId) => ({ siteId }))).map(({ siteId }) => ({
      site: siteId,
      items: m.get(siteId) ?? [],
    }));
  }, [machines]);

  const [target, setTarget] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [doneLines, setDoneLines] = useState<string[]>([]);

  const optionsFor = (site: string) => {
    const list = locs.filter((l) => l.site_id === site);
    return {
      area: list.filter((l) => l.type === 'NS_AREA'),
      general: list.filter((l) => l.type !== 'NS_AREA'),
    };
  };

  const allChosen = groups.every((g) => !!target[g.site]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const lines: string[] = [];
    let moved = 0;
    for (const g of groups) {
      if (doneLines.some((l) => l.startsWith(`${g.site}:`))) continue; // sudah berhasil sebelumnya
      const { data, error: err } = await supabase.rpc('move_non_sewing_machines', {
        p_asset_codes: g.items.map((x) => x.asset_code),
        p_location_id: target[g.site],
        p_status: status || null,
        p_reason: reason || null,
        p_request_id: crypto.randomUUID(),
      });
      const r = (data ?? {}) as { success?: boolean; message?: string; moved?: number };
      if (err || r.success === false) {
        const msg = localizeMessage(err?.message ?? r.message ?? '', language);
        setDoneLines((prev) => [...prev, ...lines]);
        setError(`${g.site}: ${msg}`);
        setBusy(false);
        return;
      }
      moved += r.moved ?? 0;
      lines.push(`${g.site}: ${localizeMessage(r.message ?? '', language)}`);
    }
    setBusy(false);
    onDone(t('bm_done', { n: moved }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs" onMouseDown={onClose}>
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('bm_title', { n: machines.length })}</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {groups.map((g) => {
            const { area, general } = optionsFor(g.site);
            const finished = doneLines.some((l) => l.startsWith(`${g.site}:`));
            const sample = g.items.slice(0, 4).map((x) => x.asset_code).join(', ');
            return (
              <div key={g.site} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {t('bm_site_group', { site: g.site, n: g.items.length })}
                  </span>
                  {finished && <span className="text-emerald-700 font-bold">{t('bm_site_done')}</span>}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                  {sample}{g.items.length > 4 ? ` +${g.items.length - 4}` : ''}
                </div>
                <label className="block">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                    {t('bm_target')}
                  </span>
                  <select
                    className={inputCls}
                    required
                    disabled={finished}
                    value={target[g.site] ?? ''}
                    onChange={(e) => setTarget({ ...target, [g.site]: e.target.value })}
                  >
                    <option value="">{t('ns_pick_location')}</option>
                    {area.length > 0 && (
                      <optgroup label={t('ns_group_area')}>
                        {area.map((l) => (
                          <option key={l.location_id} value={l.location_id}>{l.display_name} ({l.location_id})</option>
                        ))}
                      </optgroup>
                    )}
                    {general.length > 0 && (
                      <optgroup label={t('ns_group_general')}>
                        {general.map((l) => (
                          <option key={l.location_id} value={l.location_id}>{l.display_name} ({l.location_id})</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </label>
                {g.items.some((x) => x.location_id) && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t('bm_from')}{' '}
                    {[...new Set(g.items.map((x) => (x.location_id || '-')))]
                      .slice(0, 4)
                      .join(', ')}
                  </div>
                )}
              </div>
            );
          })}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                {t('ns_f_status')}
              </span>
              <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">{t('bm_status_keep')}</option>
                {STATUSES.map((s) => <option key={s} value={s}>{t(`ns_st_${s}`)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                {t('ns_f_reason')}
              </span>
              <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400">{t('bm_hint')}</div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs px-3 py-2">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className={btnGhost} onClick={onClose}>{t('ns_cancel')}</button>
            <button type="submit" className={btnPrimary} disabled={busy || !allChosen}>
              {busy ? t('bm_moving') : t('bm_confirm', { n: machines.length })}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
