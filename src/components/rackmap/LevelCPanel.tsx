import React, { useState } from 'react';
import { Plus, Trash2, X, Loader2 } from 'lucide-react';
import { useAuth } from '../../services/authContext';
import { makeT, localizeMessage } from '../../services/translations';
import { supabase } from '../../services/supabase';
import { formatDateTime } from '../../utils/dateTime';
import { getMachineLabel } from '../../utils/machineName';
import { RackConfig } from '../../services/rackMapService';
import { SelectedColumnCoord } from './RackDetail';
import { CSlot, slotState, LEVEL_C_COLORS } from './levelC';

interface Props {
  rack: RackConfig;
  coord: SelectedColumnCoord;
  slots: CSlot[];
  onChanged: () => Promise<void>;
  onClose: () => void;
  onNotify: (type: 'success' | 'error' | 'warning', text: string) => void;
}

export const LevelCPanel: React.FC<Props> = ({ rack, coord, slots, onChanged, onClose, onNotify }) => {
  const { language } = useAuth();
  const t = makeT(language);
  const position = `${rack.id}-C${coord.column}`;
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});

  const rpc = async (fn: string, args: Record<string, unknown>): Promise<boolean> => {
    const { data, error } = await supabase.rpc(fn, args);
    const r = (data ?? {}) as { success?: boolean; message?: string };
    if (error || r.success === false) {
      onNotify('error', localizeMessage(error?.message || r.message || '', language));
      return false;
    }
    if (r.message) onNotify('success', localizeMessage(r.message, language));
    return true;
  };

  const run = async (job: () => Promise<boolean>) => {
    if (busy) return;
    setBusy(true);
    try {
      if (await job()) await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const addSlot = () => run(() => rpc('add_rack_slot', { p_rack: rack.id, p_column: coord.column }));
  const removeSlot = (loc: string) => run(() => rpc('remove_rack_slot', { p_location_id: loc }));
  const addNote = (loc: string) =>
    run(async () => {
      const text = (texts[loc] ?? '').trim();
      if (!text) return false;
      const ok = await rpc('add_rack_note', { p_location_id: loc, p_note: text });
      if (ok) setTexts((p) => ({ ...p, [loc]: '' }));
      return ok;
    });
  const delNote = (id: number) => run(() => rpc('delete_rack_note', { p_id: id }));

  const addMachine = (loc: string) =>
    run(async () => {
      const code = (codes[loc] ?? '').trim();
      if (!code) return false;
      const safe = code.replace(/[,()"\\]/g, '');
      const { data } = await supabase
        .from('machines')
        .select('asset_code, site_id')
        .or(`barcode.eq.${safe},asset_code.eq.${safe.toUpperCase()},serial.eq.${safe}`)
        .limit(1);
      const row = ((data ?? []) as { asset_code: string; site_id: string }[])[0];
      if (!row) {
        onNotify('error', t('lc_not_found', { code }));
        return false;
      }
      if (row.site_id !== 'WH2') {
        onNotify('error', t('sp_ns_not_wh2', { code: row.asset_code, site: row.site_id }));
        return false;
      }
      const ok = await rpc('move_machine', { p_asset_code: row.asset_code, p_location_id: loc, p_request_id: crypto.randomUUID() });
      if (ok) setCodes((p) => ({ ...p, [loc]: '' }));
      return ok;
    });

  const removeMachine = (assetCode: string, category: string) =>
    run(() =>
      rpc('move_machine', {
        p_asset_code: assetCode,
        p_location_id: category === 'NON_SEWING' ? 'WH2-NS-UNASSIGNED' : 'WH2-UNASSIGNED',
        p_request_id: crypto.randomUUID(),
      })
    );

  const inputCls =
    'flex-1 min-w-0 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs';
  const btnCls = 'px-2.5 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50 shrink-0';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">{position}</h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
            {t('lc_n_slots', { n: slots.length })}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label={t('sp_close_aria')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('lc_hint')}</p>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {slots.map((s) => {
          const st = slotState(s);
          const removable = s.slotNo > 3 && s.machines.length === 0 && s.notes.length === 0;
          return (
            <div key={s.locationId} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${LEVEL_C_COLORS[st]}`} />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{t('sp_slot_n', { n: s.slotNo })}</span>
                  <span className="text-[10px] text-slate-400">
                    {t('lc_counts', { m: s.machines.length, n: s.notes.length })}
                  </span>
                </div>
                {removable && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => removeSlot(s.locationId)}
                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 disabled:opacity-50"
                    title={t('lc_remove_slot')}
                    aria-label={t('lc_remove_slot')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {s.machines.map((m) => {
                const lab = getMachineLabel({ localName: m.localName, standardMachineName: m.standardName, item: m.item });
                return (
                  <div key={m.assetCode} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 text-[11px]">
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-slate-800 dark:text-slate-100">{m.assetCode}</div>
                      <div className="text-slate-500 dark:text-slate-400 truncate">{lab.primary}</div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => removeMachine(m.assetCode, m.category)}
                      className="px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 shrink-0"
                    >
                      {t('sp_ns_remove')}
                    </button>
                  </div>
                );
              })}

              {s.notes.map((n) => (
                <div key={n.id} className="flex items-start justify-between gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 text-[11px]">
                  <div className="min-w-0">
                    <div className="text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words">{n.text}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {n.nik} · {formatDateTime(n.createdAt, { lang: language })}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => delNote(n.id)}
                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 disabled:opacity-50 shrink-0"
                    title={t('lc_del_note')}
                    aria-label={t('lc_del_note')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <div className="flex items-center gap-2">
                <input
                  value={codes[s.locationId] ?? ''}
                  onChange={(e) => setCodes((p) => ({ ...p, [s.locationId]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addMachine(s.locationId); } }}
                  placeholder={t('lc_machine_ph')}
                  className={`${inputCls} font-mono`}
                />
                <button type="button" disabled={busy || !(codes[s.locationId] ?? '').trim()} onClick={() => addMachine(s.locationId)} className={`${btnCls} bg-indigo-600 hover:bg-indigo-500`}>
                  {t('lc_add_machine')}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={texts[s.locationId] ?? ''}
                  maxLength={500}
                  onChange={(e) => setTexts((p) => ({ ...p, [s.locationId]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addNote(s.locationId); } }}
                  placeholder={t('lc_note_ph')}
                  className={inputCls}
                />
                <button type="button" disabled={busy || !(texts[s.locationId] ?? '').trim()} onClick={() => addNote(s.locationId)} className={`${btnCls} bg-amber-600 hover:bg-amber-500`}>
                  {t('lc_add_note')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={addSlot}
        className="w-full py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        {t('lc_add_slot')}
      </button>
    </div>
  );
};
