import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Building2,
  Boxes,
  ArrowRightLeft,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Activity,
  ExternalLink,
  ShieldCheck,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../services/authContext';
import { getTranslation, makeT, localizeMessage } from '../services/translations';
import { storageService } from '../services/storage';
import { sortSites } from '../services/siteOrder';
import { supabase } from '../services/supabase';
import { gasAuthService, ServerMovementRecord } from '../services/gasAuthService';
import { Machine, SiteId, MachineStatus, MachineListFilter } from '../types';
import { formatDateTime } from '../utils/dateTime';

interface DashboardViewProps {
  onNavigateTab: (tab: string) => void;
  onOpenMachines: (filter: MachineListFilter) => void;
  onOpenNonSewing?: (site: string) => void;
  onSelectMachine: (machine: Machine) => void;
  onOpenScanner: () => void;
}

const STATUS_PILLS = [
  { key: 'ACTIVE',     box: 'bg-emerald-50 border-emerald-200', title: 'text-emerald-800', num: 'text-emerald-950' },
  { key: 'IN_TRANSIT', box: 'bg-sky-50 border-sky-200',         title: 'text-sky-800',     num: 'text-sky-950' },
  { key: 'IN_REPAIR',  box: 'bg-amber-50 border-amber-200',     title: 'text-amber-800',   num: 'text-amber-950' },
  { key: 'BROKEN',     box: 'bg-rose-50 border-rose-200',       title: 'text-rose-800',    num: 'text-rose-950' },
  { key: 'LOANED',     box: 'bg-purple-50 border-purple-200',   title: 'text-purple-800',  num: 'text-purple-950' },
  { key: 'SOLD',       box: 'bg-slate-100 border-slate-200',    title: 'text-slate-700',   num: 'text-slate-900' },
] as const;

const CARD_BTN =
  'text-left w-full cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500';

// Site yang hanya memiliki mesin non sewing: kartu membuka menu Mesin Non Sewing.
const NON_SEWING_SITES = new Set(['WH1', 'WH3', 'SW', 'TBL', 'BO', 'GE', 'LAB']);

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateTab,
  onOpenMachines,
  onOpenNonSewing,
  onSelectMachine,
}) => {
  const { currentUser, language, canAccessSite } = useAuth();
  const t = makeT(language);
  const sewingMachines = storageService.getAllMachines();

  // Mesin non sewing tidak dimuat storageService; ambil ringkasannya untuk dihitung bersama mesin sewing.
  const [nonSewing, setNonSewing] = useState<Machine[]>([]);
  const loadNonSewing = useCallback(async () => {
    try {
      const rows: Array<{ asset_code: string; site_id: string; status: string; standard_machine_name: string | null }> = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from('machines')
          .select('asset_code, site_id, status, standard_machine_name')
          .eq('category', 'NON_SEWING')
          .order('id')
          .range(from, from + 999);
        if (error) return; // kolom/ SQL belum terpasang: tampilkan mesin sewing saja
        const part = (data ?? []) as unknown as typeof rows;
        rows.push(...part);
        if (part.length < 1000) break;
      }
      setNonSewing(
        rows.map(
          (r) =>
            ({
              assetCode: r.asset_code,
              siteId: r.site_id,
              status: r.status,
              standardMachineName: r.standard_machine_name ?? '',
            }) as unknown as Machine
        )
      );
    } catch {
      /* diabaikan: dashboard tetap menampilkan mesin sewing */
    }
  }, []);
  useEffect(() => {
    void loadNonSewing();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void loadNonSewing();
    }, 60000);
    return () => clearInterval(id);
  }, [loadNonSewing]);

  const machines = useMemo(() => [...sewingMachines, ...nonSewing], [sewingMachines, nonSewing]);
  const sites = sortSites(storageService.getSites());
  const transfers = storageService.getTransfers();
  const opnameSessions = storageService.getOpnameSessions();

  // Server Movements State
  const [serverMovements, setServerMovements] = useState<ServerMovementRecord[]>([]);
  const [isLoadingMovements, setIsLoadingMovements] = useState<boolean>(true);
  const [movementsError, setMovementsError] = useState<string | null>(null);

  const fetchRecentMovements = useCallback(async () => {
    setIsLoadingMovements(true);
    setMovementsError(null);
    try {
      const res = await gasAuthService.getMovements({ limit: 5 });
      if (res && res.success) {
        setServerMovements(Array.isArray(res.movements) ? res.movements.slice(0, 5) : []);
      } else {
        setMovementsError(res?.message ? localizeMessage(res.message, language) : t('dash_load_failed'));
      }
    } catch (err: any) {
      setMovementsError(err.message ? localizeMessage(err.message, language) : t('dash_no_connect'));
    } finally {
      setIsLoadingMovements(false);
    }
  }, [language]);

  // Fetch on mount
  useEffect(() => {
    fetchRecentMovements();
  }, [fetchRecentMovements]);

  // Auto reload every 60 seconds only when tab is visible
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchRecentMovements();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchRecentMovements]);

  // Live Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const handleSyncFromSheet = async () => {
    setIsSyncing(true);
    setSyncToast(null);
    try {
      const res = await storageService.syncFromGoogleSheet(undefined, 'machine_asset');
      if (res.success) {
        setSyncToast(t('dash_sync_ok', { n: res.count, source: res.source }));
        setTimeout(() => setSyncToast(null), 5000);
      } else {
        setSyncToast(t('dash_sync_fail', { msg: localizeMessage(res.message, language) }));
        setTimeout(() => setSyncToast(null), 7000);
      }
    } catch (e: any) {
      setSyncToast(t('dash_sync_fail', { msg: localizeMessage(e.message, language) }));
      setTimeout(() => setSyncToast(null), 5000);
    } finally {
      setIsSyncing(false);
      fetchRecentMovements();
    }
  };

  // Filter machines based on user role and accessible sites
  const accessibleMachines = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'Admin' || currentUser.siteAccess.includes('ALL')) {
      return machines;
    }
    return machines.filter((m) => currentUser.siteAccess.includes(m.siteId));
  }, [machines, currentUser]);

  // Site breakdown counts
  const siteCounts = useMemo(() => {
    const map: Record<string, number> = { PW1: 0, PW2: 0, PW3: 0, WH2: 0, SW: 0, QA: 0 };
    for (const m of accessibleMachines) {
      if (map[m.siteId] !== undefined) map[m.siteId]++;
      else map[m.siteId] = 1;
    }
    return map;
  }, [accessibleMachines]);

  // Populasi jenis mesin: dipisah mesin sewing dan non sewing (Top 8 masing-masing)
  const topTypes = useCallback((list: Machine[]) => {
    const map: Record<string, number> = {};
    for (const m of list) {
      const name = m.standardMachineName || 'Unknown Type';
      map[name] = (map[name] || 0) + 1;
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, []);
  const sewingTypeData = useMemo(() => {
    const ns = new Set<Machine>(nonSewing);
    const list = accessibleMachines.filter((m) => !ns.has(m));
    return { total: list.length, rows: topTypes(list) };
  }, [accessibleMachines, nonSewing, topTypes]);
  const nonSewingTypeData = useMemo(() => {
    const ns = new Set<Machine>(nonSewing);
    const list = accessibleMachines.filter((m) => ns.has(m));
    return { total: list.length, rows: topTypes(list) };
  }, [accessibleMachines, nonSewing, topTypes]);

  // Status breakdown
  const statusCounts = useMemo(() => {
    const counts: Record<MachineStatus, number> = {
      ACTIVE: 0, IN_TRANSIT: 0, IN_REPAIR: 0, BROKEN: 0, LOANED: 0, SOLD: 0,
    };
    for (const m of accessibleMachines) {
      if (counts[m.status] !== undefined) counts[m.status]++;
    }
    return counts;
  }, [accessibleMachines]);

  // In Transit transfers pending
  const inTransitTransfers = useMemo(() => {
    return transfers.filter((t) => t.status === 'IN_TRANSIT');
  }, [transfers]);

  // Overdue transfers (> 3 days)
  const overdueTransfers = useMemo(() => {
    const limitDays = storageService.getSettings().transferOverdueDays || 3;
    const now = Date.now();
    return inTransitTransfers.filter((t) => {
      const sentTime = new Date(t.sentAt).getTime();
      const diffDays = (now - sentTime) / (1000 * 3600 * 24);
      return diffDays > limitDays;
    });
  }, [inTransitTransfers]);

  // Weekly Opname summary
  const completedOpnamesThisWeek = useMemo(() => {
    return opnameSessions.filter((s) => s.status === 'COMPLETED').length;
  }, [opnameSessions]);

  const isViewer = currentUser?.role === 'Viewer';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Banner ringkas */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-sky-900 to-sky-800 text-white shadow-md relative">
        <button
          type="button"
          onClick={handleSyncFromSheet}
          disabled={isSyncing}
          className="absolute right-4 top-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-50 text-sky-100 transition-colors cursor-pointer"
          title={isSyncing ? t('dash_syncing') : t('dash_sync_title')}
          aria-label={t('dash_sync_btn')}
        >
          <RotateCcw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
        </button>

        <div className="space-y-3 pr-12">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">{t('dash_summary_title')}</h1>
            <p className="text-xs sm:text-sm text-sky-100/90 mt-0.5">
              {isViewer ? t('dash_sub_viewer') : t('dash_sub_default')}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {sortSites((currentUser?.siteAccess ?? []).map((siteId) => ({ siteId }))).map(({ siteId }) => (
              <span
                key={siteId}
                className="px-2 py-0.5 rounded-md bg-white/10 border border-white/15 text-[11px] font-mono font-semibold text-sky-50"
              >
                {siteId}
              </span>
            ))}
          </div>

        </div>
      </div>

      {/* SYNC TOAST BANNER */}
      {syncToast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{syncToast}</span>
        </div>
      )}

      {/* EMPTY DATABASE BANNER (If 0 machines) */}
      {machines.length === 0 && (
        <div className="p-6 rounded-3xl bg-white border border-emerald-200 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {t('dash_empty_badge')}
                </span>
                <span className="text-xs font-mono text-slate-500">{t('dash_empty_ready')}</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                {t('dash_empty_title')}
              </h2>
              <p className="text-xs text-slate-600">
                {t('dash_empty_desc')} <span className="font-mono text-emerald-700 font-bold">1-D87s2xI6ERVQydmP1Gbmj7XzqB5o7Ziib7mvKVhtio</span>.
              </p>
            </div>

            <button
              onClick={handleSyncFromSheet}
              disabled={isSyncing}
              className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs shadow-sm flex items-center justify-center gap-2 shrink-0 transition-transform hover:scale-105 active:scale-95"
            >
              <RotateCcw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? t('dash_pulling') : t('dash_pull_now')}</span>
            </button>
          </div>
        </div>
      )}

      {/* OVERDUE TRANSFER ALERTS */}
      {overdueTransfers.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-800 text-xs shadow-sm animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <div className="font-bold text-rose-900 text-sm">
                {getTranslation('overdue_alert', language)}
              </div>
              <div className="text-rose-700">
                {t('dash_overdue_desc', { n: overdueTransfers.length })}
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('transfers')}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs whitespace-nowrap self-start sm:self-auto shadow-xs"
          >
            {t('dash_check_transfers')}
          </button>
        </div>
      )}

      {/* TOP STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total */}
        <button
          type="button"
          onClick={() => onOpenMachines({ status: 'ALL', site: 'ALL' })}
          className={`p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-1 ${CARD_BTN}`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>{t('dash_total_managed')}</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
            {accessibleMachines.length.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">
            {t('dash_of_total', { n: machines.length.toLocaleString() })}
          </div>
          <div className="text-[11px] text-slate-400">
            {t('dash_split', { s: sewingMachines.length.toLocaleString(), n: nonSewing.length.toLocaleString() })}
          </div>
        </button>

        {/* Aktif */}
        <button
          type="button"
          onClick={() => onOpenMachines({ status: 'ACTIVE' })}
          className={`p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-1 ${CARD_BTN}`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>{t('dash_active_ops')}</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono">
            {statusCounts.ACTIVE.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium">
            {t('dash_operational', { pct: ((statusCounts.ACTIVE / (accessibleMachines.length || 1)) * 100).toFixed(1) })}
          </div>
        </button>

        {/* In Transit: angka diganti agar cocok dengan isi tabel */}
        <button
          type="button"
          onClick={() => onOpenMachines({ status: 'IN_TRANSIT' })}
          className={`p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-1 ${CARD_BTN}`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>{t('dash_in_transit_card')}</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-700 font-mono">
            {statusCounts.IN_TRANSIT.toLocaleString()}
          </div>
          <div className="text-[11px] text-amber-700">
            {overdueTransfers.length > 0 ? t('dash_late', { n: overdueTransfers.length }) : t('dash_all_on_time')}
          </div>
        </button>

        {/* Perbaikan & Rusak */}
        <button
          type="button"
          onClick={() => onOpenMachines({ status: 'BROKEN_REPAIR' })}
          className={`p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-1 ${CARD_BTN}`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>{t('dash_repair_broken')}</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-700 font-mono">
            {(statusCounts.BROKEN + statusCounts.IN_REPAIR).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">
            {t('dash_repair_broken_sub', { repair: statusCounts.IN_REPAIR, broken: statusCounts.BROKEN })}
          </div>
        </button>
      </div>

      {/* SITES DISTRIBUTION GRID */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-700" />
            <span>{t('dash_site_dist')}</span>
          </h2>
          <span className="text-xs text-slate-500">{t('dash_click_site')}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {sites.map((site) => {
            const count = siteCounts[site.siteId] || 0;
            const hasAccess = canAccessSite(site.siteId);
            return (
              <button
                key={site.siteId}
                type="button"
                disabled={!hasAccess}
                onClick={() =>
                  NON_SEWING_SITES.has(site.siteId.toUpperCase()) && onOpenNonSewing
                    ? onOpenNonSewing(site.siteId)
                    : onOpenMachines({ site: site.siteId, status: 'ALL' })
                }
                className={`p-4 rounded-2xl border text-left transition-all hover:scale-[1.02] shadow-xs ${
                  hasAccess
                    ? 'bg-white border-slate-200/90 hover:border-emerald-500 hover:bg-emerald-50/30 cursor-pointer'
                    : 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-black text-sm font-mono text-emerald-800">{site.siteId}</span>
                  <span className="text-[10px] uppercase font-bold text-slate-600 px-1.5 py-0.5 rounded bg-slate-100">
                    {site.type}
                  </span>
                </div>
                <div className="text-xl font-black text-slate-900 font-mono">
                  {count.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500 truncate mt-1">{site.name}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* TWO COLUMN BREAKDOWNS: Top Machine Types & Statuses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Populasi jenis mesin: sewing & non sewing */}
        <div className="space-y-6">
          {[
            { key: 'sewing', title: t('dash_type_pop_sewing'), data: sewingTypeData, color: 'from-emerald-600 to-teal-500', Icon: Boxes },
            { key: 'nonsewing', title: t('dash_type_pop_ns'), data: nonSewingTypeData, color: 'from-sky-600 to-indigo-500', Icon: Wrench },
          ].map(({ key, title, data, color, Icon }) => (
            <div key={key} className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Icon className="w-4 h-4 text-emerald-700" />
                  <span>{title}</span>
                </h3>
                <span className="text-xs text-slate-500 font-mono">Top 8 · {data.total.toLocaleString()}</span>
              </div>

              <div className="space-y-3">
                {data.rows.length === 0 && (
                  <div className="text-xs text-slate-400 py-2">{t('dash_type_empty')}</div>
                )}
                {data.rows.map(([name, count]) => {
                  const pct = ((count / (data.total || 1)) * 100).toFixed(1);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() =>
                        key === 'sewing'
                          ? onOpenMachines({ typeName: name, status: 'ALL', site: 'ALL' })
                          : onOpenNonSewing?.('')
                      }
                      className="block w-full text-left space-y-1 rounded-lg p-1 -m-1 hover:bg-slate-50 cursor-pointer"
                    >
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-800 font-medium truncate max-w-[280px]">{name}</span>
                        <span className="font-mono font-bold text-slate-900">
                          {count.toLocaleString()} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full bg-gradient-to-r ${color} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Status Distribution & Recent Moves */}
        <div className="space-y-6">
          {/* Status Pills */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>{t('dash_status_summary')}</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              {STATUS_PILLS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => onOpenMachines({ status: p.key })}
                  className={`p-3 rounded-xl border text-left transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer ${p.box}`}
                >
                  <div className={`font-bold ${p.title}`}>{p.key}</div>
                  <div className={`text-xl font-bold font-mono mt-1 ${p.num}`}>
                    {statusCounts[p.key].toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Movements Preview */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>{t('dash_recent_moves')}</span>
              </h3>
              <button
                type="button"
                onClick={() => onNavigateTab('history')}
                className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-bold transition-colors cursor-pointer"
              >
                {t('dash_view_all')}
              </button>
            </div>

            {/* Skeleton state (5 lines) */}
            {isLoadingMovements && (
              <div className="space-y-2 py-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/70 animate-pulse flex items-center justify-between gap-2"
                  >
                    <div className="space-y-1.5 w-3/5">
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                      <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-4/5"></div>
                    </div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                  </div>
                ))}
              </div>
            )}

            {/* Error state */}
            {!isLoadingMovements && movementsError && (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="truncate">{movementsError}</span>
                </div>
                <button
                  type="button"
                  onClick={fetchRecentMovements}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-500 transition-colors shrink-0 cursor-pointer"
                >
                  {t('dash_retry')}
                </button>
              </div>
            )}

            {/* Empty state */}
            {!isLoadingMovements && !movementsError && serverMovements.length === 0 && (
              <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                {t('hist_empty_title')}
              </div>
            )}

            {/* Data rows (5 baris terbaru) */}
            {!isLoadingMovements && !movementsError && serverMovements.length > 0 && (
              <div className="space-y-2">
                {serverMovements.slice(0, 5).map((mov) => {
                  const isUndone = Boolean(mov.isUndone);
                  return (
                    <div
                      key={mov.historyId || `${mov.assetCode}-${mov.timestamp}`}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 transition-colors ${
                        isUndone
                          ? 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800 opacity-60'
                          : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="space-y-0.5 truncate min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`font-mono font-bold ${
                              isUndone
                                ? 'text-slate-500 dark:text-slate-400 line-through'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {mov.assetCode || '-'}
                          </span>
                          {isUndone && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              {t('hist_undone')}
                            </span>
                          )}
                        </div>

                        {mov.machineName && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {mov.machineName}
                          </div>
                        )}

                        <div className="text-slate-700 dark:text-slate-300 truncate text-[11px]">
                          <span className="font-mono">{mov.fromLocation || '-'}</span> →{' '}
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            {mov.toLocation || '-'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0 space-y-0.5">
                        <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 font-semibold">
                          {formatDateTime(mov.timestamp, { seconds: true, lang: language })}
                        </div>
                        {mov.movedBy && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate max-w-[90px]">
                            {mov.movedBy}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
