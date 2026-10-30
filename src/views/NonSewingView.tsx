import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, MapPin, X, Layers, Tags, FileSpreadsheet, Eye, CheckSquare, Square, Download, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { NonSewingDetailModal } from '../components/NonSewingDetailModal';
import { EditMachineNamesModal } from '../components/EditMachineNamesModal';
import { ImportNonSewingModal } from '../components/ImportNonSewingModal';
import { BulkMoveNonSewingModal } from '../components/BulkMoveNonSewingModal';
import { makeT, localizeMessage, localeOf } from '../services/translations';
import { useAuth } from '../services/authContext';
import { storageService } from '../services/storage';
import { sortSites } from '../services/siteOrder';
import { supabase } from '../services/supabase';
import { getMachineLabel } from '../utils/machineName';

interface NsMachine {
  id: number;
  asset_code: string;
  barcode: string;
  item: string | null;
  standard_machine_name: string | null;
  serial: string | null;
  manufacturer: string | null;
  model: string | null;
  home_site_id: string | null;
  acq_date: string | null;
  status: string;
  site_id: string;
  location_id: string | null;
  notes: string | null;
}
interface NsType { standard_name: string; local_name: string | null }
interface NsLoc { location_id: string; site_id: string; type: string; display_name: string }

const COLS =
  'id, asset_code, barcode, item, standard_machine_name, serial, manufacturer, model, home_site_id, acq_date, ' +
  'status, site_id, location_id, notes';
const PAGE = 25;
const MOVE_STATUSES = ['ACTIVE', 'BROKEN', 'IN_REPAIR'];

const inputCls =
  'w-full px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 ' +
  'text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500';
const btnPrimary =
  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 ' +
  'text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const btnGhost =
  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 ' +
  'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer';

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs" onMouseDown={onClose}>
    <div
      className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
        <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <label className="block">
    <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
      {label}
      {required && <span className="text-rose-500"> *</span>}
    </span>
    {children}
  </label>
);

export const NonSewingView: React.FC<{ initialSite?: string; focusCode?: string }> = ({ initialSite, focusCode }) => {
  const { currentUser, language, canAccessSite } = useAuth();
  const t = makeT(language);

  const roleKey = String(currentUser?.role || '').toLowerCase().replace(/[\s_-]/g, '');
  const isAdminMaster = roleKey === 'adminmaster' || roleKey === 'admin';

  const [machines, setMachines] = useState<NsMachine[]>([]);
  const [types, setTypes] = useState<NsType[]>([]);
  const [locs, setLocs] = useState<NsLoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const [q, setQ] = useState('');
  const [fSite, setFSite] = useState(initialSite ?? '');
  const [fLoc, setFLoc] = useState('');
  const [fName, setFName] = useState('');
  const [fBrand, setFBrand] = useState('');
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [page, setPage] = useState(1);

  const [modal, setModal] = useState<'add' | 'type' | 'area' | null>(null);
  const [moving, setMoving] = useState<NsMachine | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [detail, setDetail] = useState<NsMachine | null>(null);
  const [editing, setEditing] = useState<NsMachine | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const sites = useMemo(
    () => sortSites(storageService.getSites().filter((s) => s.active && canAccessSite(s.siteId))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser?.username, machines.length]
  );

  const emptyForm = {
    assetCode: '', barcode: '', type: '', item: '', serial: '', manufacturer: '', model: '',
    site: '', location: '', home: '', acqDate: '', notes: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [typeForm, setTypeForm] = useState({ name: '', local: '' });
  const [areaForm, setAreaForm] = useState({ site: '', code: '', name: '' });
  const [moveForm, setMoveForm] = useState({ location: '', status: '', reason: '' });

  const showToast = (ok: boolean, text: string) => {
    setToast({ ok, text });
    window.setTimeout(() => setToast(null), 4500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const rows: NsMachine[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from('machines')
          .select(COLS)
          .eq('category', 'NON_SEWING')
          .order('id')
          .range(from, from + 999);
        if (error) throw error;
        const part = (data ?? []) as unknown as NsMachine[];
        rows.push(...part);
        if (part.length < 1000) break;
      }
      const [tp, lc] = await Promise.all([
        supabase.from('machine_types').select('standard_name, local_name').eq('category', 'NON_SEWING').order('standard_name'),
        supabase
          .from('locations')
          .select('location_id, site_id, type, display_name')
          .eq('active', true)
          .neq('type', 'RACK_SLOT')
          .order('sort_order')
          .order('location_id'),
      ]);
      if (tp.error) throw tp.error;
      if (lc.error) throw lc.error;
      setMachines(rows.filter((m) => canAccessSite(m.site_id)));
      setTypes((tp.data ?? []) as unknown as NsType[]);
      setLocs((lc.data ?? []) as unknown as NsLoc[]);
    } catch (e: any) {
      setLoadError(localizeMessage(String(e?.message ?? ''), language) || t('ns_load_failed'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  useEffect(() => {
    void load();
  }, [load]);

  // Dibuka dari scanner utama: langsung tampilkan detail mesin yang di-scan.
  const focusDone = useRef(false);
  useEffect(() => {
    if (!focusCode || focusDone.current || machines.length === 0) return;
    const up = focusCode.toUpperCase();
    const m = machines.find((x) => x.asset_code === up || x.barcode === focusCode);
    if (m) {
      focusDone.current = true;
      setDetail(m);
    }
  }, [focusCode, machines]);


  const nameOf = useCallback(
    (m: NsMachine) =>
      getMachineLabel({
        localName: types.find((x) => x.standard_name === m.standard_machine_name)?.local_name ?? undefined,
        standardMachineName: m.standard_machine_name ?? undefined,
        item: m.item ?? undefined,
      }).primary,
    [types]
  );

  // Hasil semua filter kecuali Lokasi (dipakai untuk angka di dropdown Lokasi)
  const beforeLocation = useMemo(() => {
    const s = q.trim().toLowerCase();
    return machines.filter((m) => {
      if (fSite && m.site_id !== fSite) return false;
      if (fName && nameOf(m) !== fName) return false;
      if (fBrand && m.manufacturer !== fBrand) return false;
      if (onlyUnassigned && !(m.location_id ?? '').includes('UNASSIGNED')) return false;
      if (!s) return true;
      return [m.asset_code, m.barcode, m.item, m.serial, m.model, m.manufacturer, m.standard_machine_name, nameOf(m), m.location_id]
        .some((v) => (v ?? '').toLowerCase().includes(s));
    });
  }, [machines, q, fSite, fName, fBrand, onlyUnassigned, nameOf]);

  const filtered = useMemo(
    () => (fLoc ? beforeLocation.filter((m) => m.location_id === fLoc) : beforeLocation),
    [beforeLocation, fLoc]
  );

  const locCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const m of beforeLocation) c.set(m.location_id ?? '', (c.get(m.location_id ?? '') ?? 0) + 1);
    return c;
  }, [beforeLocation]);

  const locOptions = useMemo(
    () => (fSite ? locs.filter((l) => l.site_id === fSite && l.type !== 'RACK_SLOT') : []),
    [locs, fSite]
  );

  const nameOptions = useMemo(() => {
    const c = new Map<string, number>();
    for (const m of machines) {
      if (fSite && m.site_id !== fSite) continue;
      const n = nameOf(m);
      c.set(n, (c.get(n) ?? 0) + 1);
    }
    return Array.from(c.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [machines, fSite, nameOf]);

  const brandOptions = useMemo(
    () => Array.from(new Set(machines.map((m) => m.manufacturer).filter(Boolean) as string[])).sort(),
    [machines]
  );

  const handleExport = () => {
    const rows = filtered.map((m) => ({
      'Asset Code': m.asset_code,
      'Barcode (12-Digit)': m.barcode,
      'Standard Machine Name': m.standard_machine_name ?? '',
      [t('ml_x_local_name')]: types.find((x) => x.standard_name === m.standard_machine_name)?.local_name ?? '',
      'Item (Korea)': m.item ?? '',
      Manufacturer: m.manufacturer ?? '',
      Model: m.model ?? '',
      Serial: m.serial ?? '',
      Status: m.status,
      'Current Site': m.site_id,
      'Current Location': m.location_id ?? '',
      'Home Factory': m.home_site_id ?? '',
      'Acquisition Date': m.acq_date ?? '',
      Notes: m.notes ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'NonSewing');
    XLSX.writeFile(wb, `PT_WINNERS_NonSewing_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  useEffect(() => setPage(1), [q, fSite, fLoc, fName, fBrand, onlyUnassigned]);

  const isSelectable = (m: NsMachine) => m.status !== 'SOLD' && m.status !== 'IN_TRANSIT';
  // buang pilihan yang sudah tidak ada setelah data dimuat ulang
  useEffect(() => {
    setSel((prev) => {
      if (prev.size === 0) return prev;
      const present = new Set(machines.filter(isSelectable).map((m) => m.asset_code));
      const next = new Set([...prev].filter((c) => present.has(c)));
      return next.size === prev.size ? prev : next;
    });
  }, [machines]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const shown = filtered.slice((page - 1) * PAGE, page * PAGE);
  const selectableFiltered = filtered.filter(isSelectable);
  const allSelected = selectableFiltered.length > 0 && selectableFiltered.every((m) => sel.has(m.asset_code));
  const toggleAll = () =>
    setSel(allSelected ? new Set() : new Set(selectableFiltered.map((m) => m.asset_code)));
  const toggleOne = (code: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  const selectedMachines = machines.filter((m) => sel.has(m.asset_code));

  const getSiteLocGroups = (site: string) => {
    const list = locs.filter((l) => l.site_id === site);
    return {
      area: list.filter((l) => l.type === 'NS_AREA'),
      general: list.filter((l) => l.type !== 'NS_AREA'),
    };
  };

  const locSelect = (site: string, value: string, onChange: (v: string) => void) => {
    const { area, general } = getSiteLocGroups(site);
    return (
      <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} disabled={!site}>
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
    );
  };

  const call = async (fn: string, args: Record<string, unknown>): Promise<{ ok: boolean; message: string }> => {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) return { ok: false, message: error.message };
    const r = (data ?? {}) as { success?: boolean; message?: string };
    return { ok: r.success !== false, message: String(r.message ?? '') };
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    const res = await call('add_non_sewing_machine', {
      p_asset_code: form.assetCode,
      p_barcode: form.barcode,
      p_standard_machine_name: form.type,
      p_site_id: form.site,
      p_location_id: form.location,
      p_item: form.item || null,
      p_serial: form.serial || null,
      p_manufacturer: form.manufacturer || null,
      p_model: form.model || null,
      p_home_site_id: form.home || null,
      p_acq_date: form.acqDate || null,
      p_notes: form.notes || null,
      p_request_id: crypto.randomUUID(),
    });
    setBusy(false);
    if (!res.ok) return setFormError(localizeMessage(res.message, language));
    setModal(null);
    setForm(emptyForm);
    showToast(true, localizeMessage(res.message, language));
    void load();
  };

  const submitType = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    const res = await call('add_non_sewing_type', { p_standard_name: typeForm.name, p_local_name: typeForm.local || null });
    setBusy(false);
    if (!res.ok) return setFormError(localizeMessage(res.message, language));
    setModal(null);
    setTypeForm({ name: '', local: '' });
    showToast(true, localizeMessage(res.message, language));
    void load();
  };

  const submitArea = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    const res = await call('add_non_sewing_area', {
      p_site_id: areaForm.site,
      p_location_id: areaForm.code,
      p_display_name: areaForm.name || null,
    });
    setBusy(false);
    if (!res.ok) return setFormError(localizeMessage(res.message, language));
    setModal(null);
    setAreaForm({ site: '', code: '', name: '' });
    showToast(true, localizeMessage(res.message, language));
    void load();
  };

  const submitMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moving) return;
    setBusy(true);
    setFormError('');
    const res = await call('move_machine', {
      p_asset_code: moving.asset_code,
      p_location_id: moveForm.location && moveForm.location !== moving.location_id ? moveForm.location : null,
      p_status: moveForm.status && moveForm.status !== moving.status ? moveForm.status : null,
      p_reason: moveForm.reason || null,
      p_request_id: crypto.randomUUID(),
    });
    setBusy(false);
    if (!res.ok) return setFormError(localizeMessage(res.message, language));
    setMoving(null);
    showToast(true, localizeMessage(res.message, language));
    void load();
  };

  const openAdd = () => {
    setFormError('');
    const first = sites.length === 1 ? sites[0].siteId : '';
    setForm({ ...emptyForm, site: first });
    setModal('add');
  };
  const openMove = (m: NsMachine) => {
    setFormError('');
    setMoveForm({ location: m.location_id ?? '', status: m.status, reason: '' });
    setMoving(m);
  };

  const typeLabel = (name: string | null) => {
    if (!name) return '-';
    const tp = types.find((x) => x.standard_name === name);
    return tp?.local_name ? `${name} (${tp.local_name})` : name;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[60] px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg border ${
            toast.ok
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {toast.text}
        </div>
      )}

      {isAdminMaster && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" className={btnGhost} onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {t('ns_btn_import')}
          </button>
          <button type="button" className={btnGhost} onClick={() => { setFormError(''); setModal('type'); }}>
            <Tags className="w-3.5 h-3.5" />
            {t('ns_btn_type')}
          </button>
          <button type="button" className={btnGhost} onClick={() => { setFormError(''); setAreaForm({ site: '', code: '', name: '' }); setModal('area'); }}>
            <MapPin className="w-3.5 h-3.5" />
            {t('ns_btn_area')}
          </button>
          <button type="button" className={btnPrimary} onClick={openAdd}>
            <Plus className="w-3.5 h-3.5" />
            {t('ns_btn_add')}
          </button>
        </div>
      )}

      {/* Pencarian & filter (tata letak sama dengan Mesin Sewing) */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('ml_search_ph3')}
              className="w-full bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 font-mono transition-colors shadow-xs"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleExport}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title={t('ml_export_title')}
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span className="hidden md:inline">{t('export_excel')}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-3 border-t border-slate-100 text-xs">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">{t('ml_site_label')}</label>
            <select
              className="w-full bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-emerald-500"
              value={fSite}
              onChange={(e) => { setFSite(e.target.value); setFLoc(''); }}
            >
              <option value="">{t('ml_all_sites')}</option>
              {sites.map((s) => <option key={s.siteId} value={s.siteId}>{s.siteId} - {s.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">{t('ml_loc_label')}</label>
            <select
              className="w-full bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
              value={fLoc}
              disabled={!fSite}
              onChange={(e) => { setFLoc(e.target.value); if (e.target.value) setOnlyUnassigned(false); }}
              aria-label={t('ml_loc_aria')}
            >
              <option value="">{fSite ? t('ml_all_locs') : t('ml_pick_site')}</option>
              {locOptions.map((l) => (
                <option key={l.location_id} value={l.location_id}>
                  {l.display_name} ({(locCounts.get(l.location_id) ?? 0).toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">{t('ml_name_label')}</label>
            <select className="w-full bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-emerald-500" value={fName} onChange={(e) => setFName(e.target.value)}>
              <option value="">{t('ml_all_names')}</option>
              {nameOptions.map(([name, n]) => <option key={name} value={name}>{name} ({n.toLocaleString()})</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">{t('ml_mfr_label')}</label>
            <select className="w-full bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-emerald-500" value={fBrand} onChange={(e) => setFBrand(e.target.value)}>
              <option value="">{t('ml_all_mfr')}</option>
              {brandOptions.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => { setOnlyUnassigned(!onlyUnassigned); if (!onlyUnassigned) setFLoc(''); }}
              className={`w-full py-1.5 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                onlyUnassigned
                  ? 'bg-amber-100/80 border-amber-300 text-amber-900 font-extrabold'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>{t('ml_only_unassigned')}</span>
            </button>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs px-4 py-3">
          {loadError}
          <div className="mt-1 text-[11px] opacity-80">{t('ns_load_hint')}</div>
        </div>
      )}

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {sel.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-indigo-50 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-900 text-xs">
            <span className="font-bold text-indigo-800 dark:text-indigo-200">{t('bm_selected', { n: sel.size })}</span>
            <div className="flex gap-2">
              <button type="button" className={btnGhost} onClick={() => setSel(new Set())}>{t('bm_clear')}</button>
              <button type="button" className={btnPrimary} onClick={() => setBulkOpen(true)}>
                <Layers className="w-3.5 h-3.5" />
                {t('bm_btn')}
              </button>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50/80 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3.5 w-10 text-center">
                  <button
                    type="button"
                    onClick={toggleAll}
                    title={t('bm_select_all', { n: selectableFiltered.length })}
                    className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {allSelected ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4 text-slate-400" />}
                  </button>
                </th>
                <th className="p-3.5">{t('xfer_col_asset')}</th>
                <th className="p-3.5">{t('std_machine_name')}</th>
                <th className="p-3.5">{t('ml_col_brand')}</th>
                <th className="p-3.5">{t('ml_col_serial')}</th>
                <th className="p-3.5">{t('ml_col_site_loc')}</th>
                <th className="p-3.5">{t('status')}</th>
                <th className="p-3.5 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {shown.map((m) => {
                const nm = getMachineLabel({
                  localName: types.find((x) => x.standard_name === m.standard_machine_name)?.local_name ?? undefined,
                  standardMachineName: m.standard_machine_name ?? undefined,
                  item: m.item ?? undefined,
                });
                const isUnassigned = (m.location_id ?? '').includes('UNASSIGNED');
                return (
                  <tr
                    key={m.id}
                    onClick={() => setDetail(m)}
                    className={`hover:bg-emerald-50/40 cursor-pointer transition-colors ${sel.has(m.asset_code) ? 'bg-emerald-50/60' : ''}`}
                  >
                    <td
                      className="p-3.5 text-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isSelectable(m)) toggleOne(m.asset_code);
                      }}
                    >
                      {isSelectable(m) && (
                        <button type="button" className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                          {sel.has(m.asset_code) ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4 text-slate-400" />}
                        </button>
                      )}
                    </td>

                    <td className="p-3.5">
                      <div className="font-mono font-bold text-emerald-700 hover:text-emerald-800">{m.asset_code}</div>
                      <div className="font-mono text-[11px] text-slate-400">{m.barcode}</div>
                    </td>

                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 text-xs">{nm.primary}</div>
                      <div className="text-[11px] text-slate-500">{[nm.secondary, m.item].filter(Boolean).join(' · ') || '-'}</div>
                    </td>

                    <td className="p-3.5">
                      <div className="font-semibold text-slate-800">{m.manufacturer}</div>
                      <div className="font-mono text-[11px] text-slate-500">{m.model}</div>
                    </td>

                    <td className="p-3.5 font-mono text-slate-700 font-medium">{m.serial}</td>

                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold font-mono text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">
                          {m.site_id}
                        </span>
                        <span
                          className={`font-mono font-bold text-xs ${
                            isUnassigned ? 'text-amber-700 underline decoration-amber-400' : 'text-slate-800'
                          }`}
                        >
                          {m.location_id}
                        </span>
                      </div>
                    </td>

                    <td className="p-3.5">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          m.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : m.status === 'IN_TRANSIT' ? 'bg-sky-50 text-sky-700 border-sky-200'
                          : m.status === 'BROKEN' ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : m.status === 'IN_REPAIR' ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : m.status === 'LOANED' ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>

                    <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setDetail(m)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                        title={t('ml_view_detail')}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && shown.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    {machines.length === 0 ? t(isAdminMaster ? 'ns_empty' : 'ns_empty_user') : t('ns_no_match')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
            <span>{t('ns_page', { p: page, n: pages })}</span>
            <div className="flex gap-2">
              <button type="button" className={btnGhost} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('ns_prev')}</button>
              <button type="button" className={btnGhost} disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>{t('ns_next')}</button>
            </div>
          </div>
        )}
      </div>

      {importOpen && (
        <ImportNonSewingModal
          onClose={() => setImportOpen(false)}
          onDone={(msg) => {
            setImportOpen(false);
            showToast(true, msg);
            void load();
          }}
        />
      )}

      {modal === 'add' && (
        <Modal title={t('ns_add_title')} onClose={() => setModal(null)}>
          {types.length === 0 && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs px-3 py-2">
              {t('ns_no_types_note')}
            </div>
          )}
          <form onSubmit={submitAdd} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t('ns_f_asset')} required>
                <input className={`${inputCls} font-mono uppercase`} required value={form.assetCode}
                  onChange={(e) => setForm({ ...form, assetCode: e.target.value.toUpperCase() })} />
              </Field>
              <Field label={t('ns_f_barcode')} required>
                <input className={`${inputCls} font-mono`} required inputMode="numeric" maxLength={12} pattern="[0-9]{12}"
                  title={t('ns_barcode_hint')} value={form.barcode}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value.replace(/\D/g, '') })} />
              </Field>
              <Field label={t('ns_f_type')} required>
                <select className={inputCls} required value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="">{t('ns_pick_type')}</option>
                  {types.map((x) => <option key={x.standard_name} value={x.standard_name}>{typeLabel(x.standard_name)}</option>)}
                </select>
              </Field>
              <Field label={t('ns_f_item')}>
                <input className={inputCls} value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />
              </Field>
              <Field label={t('ns_f_manufacturer')}>
                <input className={inputCls} value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
              </Field>
              <Field label={t('ns_f_model')}>
                <input className={inputCls} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              </Field>
              <Field label={t('ns_f_serial')}>
                <input className={`${inputCls} font-mono`} value={form.serial} onChange={(e) => setForm({ ...form, serial: e.target.value })} />
              </Field>
              <Field label={t('ns_f_acq')}>
                <input type="date" className={inputCls} value={form.acqDate} onChange={(e) => setForm({ ...form, acqDate: e.target.value })} />
              </Field>
              <Field label={t('ns_f_site')} required>
                <select className={inputCls} required value={form.site}
                  onChange={(e) => setForm({ ...form, site: e.target.value, location: '' })}>
                  <option value="">{t('ns_pick_site')}</option>
                  {sites.map((s) => <option key={s.siteId} value={s.siteId}>{s.siteId} - {s.name}</option>)}
                </select>
              </Field>
              <Field label={t('ns_f_location')} required>
                {locSelect(form.site, form.location, (v) => setForm({ ...form, location: v }))}
              </Field>
              <Field label={t('ns_f_home')}>
                <select className={inputCls} value={form.home} onChange={(e) => setForm({ ...form, home: e.target.value })}>
                  <option value="">{t('ns_home_same')}</option>
                  {sortSites(storageService.getSites().filter((s) => s.active)).map((s) => (
                    <option key={s.siteId} value={s.siteId}>{s.siteId} - {s.name}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label={t('ns_f_notes')}>
              <textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            {formError && <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs px-3 py-2">{formError}</div>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className={btnGhost} onClick={() => setModal(null)}>{t('ns_cancel')}</button>
              <button type="submit" className={btnPrimary} disabled={busy || !form.location}>{busy ? t('ns_saving') : t('ns_save')}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'type' && (
        <Modal title={t('ns_type_title')} onClose={() => setModal(null)}>
          <form onSubmit={submitType} className="space-y-3">
            <Field label={t('ns_f_type_name')} required>
              <input className={inputCls} required value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} />
            </Field>
            <Field label={t('ns_f_type_local')}>
              <input className={inputCls} value={typeForm.local} onChange={(e) => setTypeForm({ ...typeForm, local: e.target.value })} />
            </Field>
            {types.length > 0 && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('ns_type_existing')} {types.map((x) => x.standard_name).join(', ')}
              </div>
            )}
            {formError && <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs px-3 py-2">{formError}</div>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className={btnGhost} onClick={() => setModal(null)}>{t('ns_cancel')}</button>
              <button type="submit" className={btnPrimary} disabled={busy}>{busy ? t('ns_saving') : t('ns_save')}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'area' && (
        <Modal title={t('ns_area_title')} onClose={() => setModal(null)}>
          <form onSubmit={submitArea} className="space-y-3">
            <Field label={t('ns_f_site')} required>
              <select className={inputCls} required value={areaForm.site} onChange={(e) => setAreaForm({ ...areaForm, site: e.target.value })}>
                <option value="">{t('ns_pick_site')}</option>
                {sites.map((s) => <option key={s.siteId} value={s.siteId}>{s.siteId} - {s.name}</option>)}
              </select>
            </Field>
            <Field label={t('ns_f_area_code')} required>
              <input className={`${inputCls} font-mono uppercase`} required value={areaForm.code}
                onChange={(e) => setAreaForm({ ...areaForm, code: e.target.value.toUpperCase() })} />
            </Field>
            <Field label={t('ns_f_area_name')}>
              <input className={inputCls} value={areaForm.name} onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })} />
            </Field>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{t('ns_area_hint')}</div>
            {formError && <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs px-3 py-2">{formError}</div>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className={btnGhost} onClick={() => setModal(null)}>{t('ns_cancel')}</button>
              <button type="submit" className={btnPrimary} disabled={busy}>{busy ? t('ns_saving') : t('ns_save')}</button>
            </div>
          </form>
        </Modal>
      )}

      {detail && (
        <NonSewingDetailModal
          machine={detail}
          localName={types.find((x) => x.standard_name === detail.standard_machine_name)?.local_name ?? null}
          onClose={() => setDetail(null)}
          onEditNames={isAdminMaster ? () => setEditing(detail) : undefined}
          onMove={() => {
            const m = detail;
            setDetail(null);
            openMove(m);
          }}
        />
      )}

      {editing && (
        <EditMachineNamesModal
          assetCode={editing.asset_code}
          standardName={editing.standard_machine_name || ''}
          localName={types.find((x) => x.standard_name === editing.standard_machine_name)?.local_name ?? ''}
          koreanName={editing.item || ''}
          manufacturer={editing.manufacturer || ''}
          category="NON_SEWING"
          pool={machines}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setDetail(null);
            void load();
          }}
        />
      )}

      {bulkOpen && (
        <BulkMoveNonSewingModal
          machines={selectedMachines}
          locs={locs}
          onClose={() => setBulkOpen(false)}
          onDone={(msg) => {
            setBulkOpen(false);
            setSel(new Set());
            showToast(true, msg);
            void load();
          }}
        />
      )}

      {moving && (
        <Modal title={`${t('ns_move_title')} ${moving.asset_code}`} onClose={() => setMoving(null)}>
          <form onSubmit={submitMove} className="space-y-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t('ns_move_now')}: <b className="text-slate-800 dark:text-slate-100">{moving.site_id} / {moving.location_id || '-'}</b>
            </div>
            <Field label={t('ns_f_new_location')}>
              {locSelect(moving.site_id, moveForm.location, (v) => setMoveForm({ ...moveForm, location: v }))}
            </Field>
            <Field label={t('ns_f_status')}>
              <select className={inputCls} value={moveForm.status} onChange={(e) => setMoveForm({ ...moveForm, status: e.target.value })}>
                {(MOVE_STATUSES.includes(moving.status) ? MOVE_STATUSES : [moving.status, ...MOVE_STATUSES]).map((s) => (
                  <option key={s} value={s}>{t(`ns_st_${s}`)}</option>
                ))}
              </select>
            </Field>
            <Field label={t('ns_f_reason')}>
              <input className={inputCls} value={moveForm.reason} onChange={(e) => setMoveForm({ ...moveForm, reason: e.target.value })} />
            </Field>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{t('ns_move_hint')}</div>
            {formError && <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs px-3 py-2">{formError}</div>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className={btnGhost} onClick={() => setMoving(null)}>{t('ns_cancel')}</button>
              <button type="submit" className={btnPrimary} disabled={busy}>{busy ? t('ns_saving') : t('ns_save')}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
