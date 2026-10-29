import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { makeT, localizeMessage } from '../services/translations';
import { useAuth } from '../services/authContext';
import { storageService } from '../services/storage';
import { supabase } from '../services/supabase';

interface Props {
  assetCode: string;
  standardName: string;
  localName: string;
  koreanName: string;
  manufacturer: string;
  onClose: () => void;
  /** Dipanggil setelah berhasil disimpan dan data sudah diminta sinkron ulang. */
  onSaved: () => void;
}

interface TypeRow { standard_name: string; local_name: string | null }

const inputCls =
  'w-full px-3 py-2 rounded-xl text-sm border border-slate-300 bg-white text-slate-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-emerald-600';

export const EditMachineNamesModal: React.FC<Props> = ({
  assetCode, standardName, localName, koreanName, manufacturer, onClose, onSaved,
}) => {
  const { language } = useAuth();
  const t = makeT(language);

  const [types, setTypes] = useState<TypeRow[]>([]);
  const [std, setStd] = useState(standardName);
  const [local, setLocal] = useState(localName);
  const [kr, setKr] = useState(koreanName);
  const [brand, setBrand] = useState(manufacturer);
  const [brandScope, setBrandScope] = useState<'ONE' | 'TYPE' | 'ALL'>('ONE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('machine_types')
        .select('standard_name, local_name')
        .eq('category', 'SEWING')
        .order('standard_name');
      if (alive) setTypes((data ?? []) as unknown as TypeRow[]);
    })();
    return () => { alive = false; };
  }, []);

  const existing = useMemo(
    () => types.find((x) => x.standard_name === std.trim()) ?? null,
    [types, std]
  );

  const onStdChange = (v: string) => {
    setStd(v);
    const hit = types.find((x) => x.standard_name === v.trim());
    if (hit) setLocal(hit.local_name ?? '');
  };

  const localWillChange =
    !!existing && local.trim() !== '' && local.trim() !== (existing.local_name ?? '');
  const affected = useMemo(
    () => (existing ? storageService.getAllMachines().filter((m) => m.standardMachineName === existing.standard_name).length : 0),
    [existing]
  );

  const brandChanged = brand.trim() !== '' && manufacturer.trim() !== '' && brand.trim() !== manufacturer.trim();
  const brandCountAll = useMemo(
    () => storageService.getAllMachines().filter((m) => (m.manufacturer || '') === manufacturer).length,
    [manufacturer]
  );
  const brandCountType = useMemo(
    () =>
      storageService
        .getAllMachines()
        .filter((m) => (m.manufacturer || '') === manufacturer && (m.standardMachineName || '') === standardName).length,
    [manufacturer, standardName]
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { data, error: err } = await supabase.rpc('admin_edit_machine_names', {
      p_asset_code: assetCode,
      p_standard_name: std,
      p_local_name: local || null,
      p_item: kr || null,
      p_manufacturer: brand || null,
      p_manufacturer_scope: brandChanged ? brandScope : 'ONE',
    });
    setBusy(false);
    if (err) return setError(localizeMessage(err.message, language));
    const r = (data ?? {}) as { success?: boolean; message?: string };
    if (r.success === false) return setError(localizeMessage(r.message ?? '', language));
    void storageService.triggerAutoBackgroundSync(true);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <h3 className="text-sm font-extrabold text-slate-900">
            {t('en_title')} <span className="font-mono">{assetCode}</span>
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-3">
          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">{t('en_std')}</span>
            <input className={inputCls} list="en-types" required value={std} onChange={(e) => onStdChange(e.target.value)} />
            <datalist id="en-types">
              {types.map((x) => <option key={x.standard_name} value={x.standard_name}>{x.local_name ?? ''}</option>)}
            </datalist>
            <span className="block mt-1 text-[11px] text-slate-500">
              {existing ? t('en_std_existing') : t('en_std_new')}
            </span>
          </label>

          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">{t('en_local')}</span>
            <input className={inputCls} value={local} onChange={(e) => setLocal(e.target.value)} />
          </label>

          {localWillChange && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs px-3 py-2">
              {t('en_local_warn', { type: existing!.standard_name, n: affected })}
            </div>
          )}

          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">{t('en_korean')}</span>
            <input className={inputCls} value={kr} onChange={(e) => setKr(e.target.value)} />
          </label>

          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">{t('en_brand')}</span>
            <input className={inputCls} value={brand} onChange={(e) => setBrand(e.target.value)} />
          </label>

          {brandChanged && brandCountAll > 1 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs px-3 py-2 space-y-1.5">
              <div className="font-bold">{t('en_brand_scope')}</div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="radio" name="brand-scope" className="mt-0.5" checked={brandScope === 'ONE'} onChange={() => setBrandScope('ONE')} />
                <span>{t('en_scope_one')}</span>
              </label>
              {brandCountType > 1 && (
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name="brand-scope" className="mt-0.5" checked={brandScope === 'TYPE'} onChange={() => setBrandScope('TYPE')} />
                  <span>{t('en_scope_type', { old: manufacturer, type: standardName, n: brandCountType })}</span>
                </label>
              )}
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="radio" name="brand-scope" className="mt-0.5" checked={brandScope === 'ALL'} onChange={() => setBrandScope('ALL')} />
                <span>{t('en_scope_all', { old: manufacturer, n: brandCountAll })}</span>
              </label>
            </div>
          )}

          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs px-3 py-2">{error}</div>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              {t('ns_cancel')}
            </button>
            <button
              type="submit"
              disabled={busy || !std.trim()}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-50 cursor-pointer"
            >
              {busy ? t('ns_saving') : t('ns_save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
