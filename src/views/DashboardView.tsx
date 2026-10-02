import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Building2,
  Boxes,
  Layers,
  ArrowRightLeft,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Activity,
  Search,
  ExternalLink,
  ShieldCheck,
  Clock,
  RotateCcw,
  Grid,
} from 'lucide-react';
import { useAuth } from '../services/authContext';
import { getTranslation } from '../services/translations';
import { storageService } from '../services/storage';
import { gasAuthService, ServerMovementRecord } from '../services/gasAuthService';
import { Machine, SiteId, MachineStatus, MachineListFilter } from '../types';
import { PtWinnersLogo } from '../components/PtWinnersLogo';

interface DashboardViewProps {
  onNavigateTab: (tab: string) => void;
  onOpenMachines: (filter: MachineListFilter) => void;
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

function formatWibTimestamp(timestampStr: string): string {
  if (!timestampStr) return '-';
  try {
    // Parse timestamp sebagai WIB: new Date(timestamp.replace(' ', 'T') + '+07:00')
    const date = new Date(timestampStr.replace(' ', 'T') + '+07:00');
    if (isNaN(date.getTime())) return timestampStr;

    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } else {
      const day = String(date.getDate()).padStart(2, '0');
      const month = date.toLocaleString('id-ID', { month: 'short' });
      const time = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      return `${day} ${month} ${time}`;
    }
  } catch {
    return timestampStr;
  }
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateTab,
  onOpenMachines,
  onSelectMachine,
  onOpenScanner,
}) => {
  const { currentUser, language, canPerformAction, canAccessSite } = useAuth();
  const machines = storageService.getAllMachines();
  const sites = storageService.getSites();
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
        setMovementsError(res?.message || 'Gagal memuat riwayat mutasi dari server.');
      }
    } catch (err: any) {
      setMovementsError(err.message || 'Tidak dapat terhubung ke server.');
    } finally {
      setIsLoadingMovements(false);
    }
  }, []);

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
        setSyncToast(`Berhasil menarik ${res.count} data mesin dari Google Spreadsheet (${res.source})!`);
        setTimeout(() => setSyncToast(null), 5000);
      } else {
        setSyncToast(`Gagal: ${res.message}`);
        setTimeout(() => setSyncToast(null), 7000);
      }
    } catch (e: any) {
      setSyncToast('Gagal: ' + e.message);
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

  // Machine Types / Standard Name Breakdown
  const machineTypeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of accessibleMachines) {
      const name = m.standardMachineName || 'Unknown Type';
      map[name] = (map[name] || 0) + 1;
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [accessibleMachines]);

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
      {/* Welcome Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-sky-700 via-cyan-600 to-teal-700 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-100 bg-white/15 px-2.5 py-0.5 rounded-full border border-white/20 flex items-center gap-1.5">
                <PtWinnersLogo className="w-3.5 h-3.5 object-contain" />
                PT.WINNERS Asset System
              </span>
              <span className="text-xs text-sky-100/80 font-mono">
                Site Access: {currentUser?.siteAccess.join(', ')}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {getTranslation('dashboard', language)} — {currentUser?.displayName}
            </h1>
            <p className="text-xs sm:text-sm text-sky-50/90">
              {isViewer
                ? 'Ringkasan Eksekutif & Distribusi Aset Mesin Jahit Pabrik'
                : 'Pusat Kontrol Pelacakan & Mutasi Aset Mesin Jahit (PW1, PW2, PW3, WH2, SW, QA)'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={onOpenScanner}
              className="px-4 py-2.5 bg-white hover:bg-sky-50 text-sky-950 rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
            >
              <Search className="w-4 h-4 text-sky-700" />
              <span>{getTranslation('scan', language)}</span>
            </button>

            {canPerformAction('MOVE') && (
              <button
                onClick={() => onNavigateTab('move')}
                className="px-4 py-2.5 bg-sky-950/60 hover:bg-sky-950 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 border border-sky-400/30"
              >
                <Layers className="w-4 h-4" />
                <span>{getTranslation('move', language)}</span>
              </button>
            )}

            <button
              onClick={() => onNavigateTab('rackmap')}
              className="px-4 py-2.5 bg-teal-950/70 hover:bg-teal-900 text-teal-100 rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 border border-teal-400/30"
              title="Buka Denah & Mapping Posisi Mesin di Rak Gudang WH2"
            >
              <Grid className="w-4 h-4 text-teal-300" />
              <span>Mapping Rak WH2</span>
            </button>

            {canPerformAction('OPNAME') && (
              <button
                onClick={() => onNavigateTab('opname')}
                className="px-4 py-2.5 bg-cyan-950/60 hover:bg-cyan-950 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 border border-cyan-400/30"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>{getTranslation('opname', language)}</span>
              </button>
            )}

            <button
              onClick={handleSyncFromSheet}
              disabled={isSyncing}
              className="px-4 py-2.5 bg-sky-950/80 hover:bg-sky-950 disabled:opacity-50 text-sky-100 rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 border border-sky-300/30"
              title="Tarik data terbaru dari Google Spreadsheet tab 'machine_asset'"
            >
              <RotateCcw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Menyinkronkan...' : 'Sync Data'}</span>
            </button>
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
                  Database Bersih (0 Data Dummy)
                </span>
                <span className="text-xs font-mono text-slate-500">Siap untuk data real</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                Sinkronkan Data Mesin dari Google Spreadsheet ("machine_asset")
              </h2>
              <p className="text-xs text-slate-600">
                Data dummy telah dibersihkan. Klik tombol di samping untuk memuat seluruh daftar aset mesin resmi PT.WINNERS langsung dari Google Spreadsheet ID <span className="font-mono text-emerald-700 font-bold">1-D87s2xI6ERVQydmP1Gbmj7XzqB5o7Ziib7mvKVhtio</span>.
              </p>
            </div>

            <button
              onClick={handleSyncFromSheet}
              disabled={isSyncing}
              className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs shadow-sm flex items-center justify-center gap-2 shrink-0 transition-transform hover:scale-105 active:scale-95"
            >
              <RotateCcw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sedang Menarik Data...' : 'Tarik Data dari Sheet Sekarang'}</span>
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
                Terdapat {overdueTransfers.length} mesin berstatus In Transit lebih dari 3 hari belum diterima oleh site tujuan.
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('transfers')}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs whitespace-nowrap self-start sm:self-auto shadow-xs"
          >
            Periksa Transfer
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
            <span>Total Mesin Dikelola</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
            {accessibleMachines.length.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">
            Dari total {machines.length.toLocaleString()} aset perusahaan
          </div>
        </button>

        {/* Aktif */}
        <button
          type="button"
          onClick={() => onOpenMachines({ status: 'ACTIVE' })}
          className={`p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-1 ${CARD_BTN}`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Mesin Aktif (Operasi)</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono">
            {statusCounts.ACTIVE.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium">
            {((statusCounts.ACTIVE / (accessibleMachines.length || 1)) * 100).toFixed(1)}% Operasional
          </div>
        </button>

        {/* In Transit: angka diganti agar cocok dengan isi tabel */}
        <button
          type="button"
          onClick={() => onOpenMachines({ status: 'IN_TRANSIT' })}
          className={`p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-1 ${CARD_BTN}`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>In Transit / Transfer</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-700 font-mono">
            {statusCounts.IN_TRANSIT.toLocaleString()}
          </div>
          <div className="text-[11px] text-amber-700">
            {overdueTransfers.length > 0 ? `${overdueTransfers.length} terlambat` : 'Semua tepat waktu'}
          </div>
        </button>

        {/* Perbaikan & Rusak */}
        <button
          type="button"
          onClick={() => onOpenMachines({ status: 'BROKEN_REPAIR' })}
          className={`p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-1 ${CARD_BTN}`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Perbaikan & Rusak</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-700 font-mono">
            {(statusCounts.BROKEN + statusCounts.IN_REPAIR).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">
            {statusCounts.IN_REPAIR} Diperbaiki • {statusCounts.BROKEN} Rusak
          </div>
        </button>
      </div>

      {/* SITES DISTRIBUTION GRID */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-700" />
            <span>Distribusi Mesin Per Site (Pabrik & Gudang)</span>
          </h2>
          <span className="text-xs text-slate-500">Klik site untuk filter</span>
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
                onClick={() => onOpenMachines({ site: site.siteId, status: 'ALL' })}
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
        {/* Machine Types Breakdown */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-emerald-700" />
              <span>Populasi Jenis Mesin Utama (Standard Machine Names)</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">Top 8</span>
          </div>

          <div className="space-y-3">
            {machineTypeCounts.map(([name, count]) => {
              const pct = ((count / (accessibleMachines.length || 1)) * 100).toFixed(1);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => onOpenMachines({ typeName: name, status: 'ALL', site: 'ALL' })}
                  className="block w-full text-left space-y-1 rounded-lg p-1 -m-1 hover:bg-slate-50 cursor-pointer"
                >
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-800 font-medium truncate max-w-[280px]">{name}</span>
                    <span className="font-mono font-bold text-slate-900">
                      {count.toLocaleString()} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Distribution & Recent Moves */}
        <div className="space-y-6">
          {/* Status Pills */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Rangkuman Status Mesin</span>
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
                <span>Aktivitas Mutasi Terkini</span>
              </h3>
              <button
                type="button"
                onClick={() => onNavigateTab('history')}
                className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-bold transition-colors cursor-pointer"
              >
                Lihat Semua
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
                  Coba lagi
                </button>
              </div>
            )}

            {/* Empty state */}
            {!isLoadingMovements && !movementsError && serverMovements.length === 0 && (
              <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                Belum ada riwayat untuk site Anda
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
                              Dibatalkan
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
                          {formatWibTimestamp(mov.timestamp)}
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
