import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../services/authContext';
import { getTranslation } from '../services/translations';
import { storageService } from '../services/storage';
import { Machine, SiteId } from '../types';

interface DashboardViewProps {
  onNavigateTab: (tab: string) => void;
  onSelectMachine: (machine: Machine) => void;
  onOpenScanner: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateTab,
  onSelectMachine,
  onOpenScanner,
}) => {
  const { currentUser, language, canPerformAction, canAccessSite } = useAuth();
  const machines = storageService.getAllMachines();
  const sites = storageService.getSites();
  const transfers = storageService.getTransfers();
  const opnameSessions = storageService.getOpnameSessions();
  const movements = storageService.getMovements();

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
    for (const m of machines) {
      if (map[m.siteId] !== undefined) map[m.siteId]++;
      else map[m.siteId] = 1;
    }
    return map;
  }, [machines]);

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
    const counts = { ACTIVE: 0, BROKEN: 0, IN_REPAIR: 0, LOANED: 0, SOLD: 0 };
    for (const m of accessibleMachines) {
      if (counts[m.status] !== undefined) {
        counts[m.status]++;
      }
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
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-100 bg-white/15 px-2.5 py-0.5 rounded-full border border-white/20">
                PT.WINNERS Asset System
              </span>
              <span className="text-xs text-emerald-100/80 font-mono">
                Site Access: {currentUser?.siteAccess.join(', ')}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {getTranslation('dashboard', language)} — {currentUser?.displayName}
            </h1>
            <p className="text-xs sm:text-sm text-emerald-50/90">
              {isViewer
                ? 'Ringkasan Eksekutif & Distribusi Aset Mesin Jahit Pabrik'
                : 'Pusat Kontrol Pelacakan & Mutasi Aset Mesin Jahit (PW1, PW2, PW3, WH2, SW, QA)'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={onOpenScanner}
              className="px-4 py-2.5 bg-white hover:bg-emerald-50 text-emerald-900 rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
            >
              <Search className="w-4 h-4 text-emerald-700" />
              <span>{getTranslation('scan', language)}</span>
            </button>

            {canPerformAction('MOVE') && (
              <button
                onClick={() => onNavigateTab('move')}
                className="px-4 py-2.5 bg-emerald-900/60 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 border border-emerald-500/30"
              >
                <Layers className="w-4 h-4" />
                <span>{getTranslation('move', language)}</span>
              </button>
            )}

            {canPerformAction('OPNAME') && (
              <button
                onClick={() => onNavigateTab('opname')}
                className="px-4 py-2.5 bg-teal-900/60 hover:bg-teal-900 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 border border-teal-500/30"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>{getTranslation('opname', language)}</span>
              </button>
            )}

            <button
              onClick={handleSyncFromSheet}
              disabled={isSyncing}
              className="px-4 py-2.5 bg-emerald-950/70 hover:bg-emerald-950 disabled:opacity-50 text-emerald-100 rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 border border-emerald-400/20"
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
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-1">
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
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-1">
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
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>In Transit / Transfer</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-700 font-mono">
            {inTransitTransfers.length}
          </div>
          <div className="text-[11px] text-amber-700">
            {overdueTransfers.length > 0 ? `${overdueTransfers.length} terlambat` : 'Semua tepat waktu'}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-1">
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
        </div>
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
                onClick={() => onNavigateTab('machines')}
                className={`p-4 rounded-2xl border text-left transition-all hover:scale-[1.02] shadow-xs ${
                  hasAccess
                    ? 'bg-white border-slate-200/90 hover:border-emerald-500 hover:bg-emerald-50/30'
                    : 'bg-slate-50 border-slate-200 opacity-60'
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
                <div key={name} className="space-y-1">
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
                </div>
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
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="text-emerald-800 font-bold">ACTIVE</div>
                <div className="text-xl font-bold text-emerald-950 font-mono mt-1">
                  {statusCounts.ACTIVE.toLocaleString()}
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="text-amber-800 font-bold">IN_REPAIR</div>
                <div className="text-xl font-bold text-amber-950 font-mono mt-1">
                  {statusCounts.IN_REPAIR.toLocaleString()}
                </div>
              </div>

              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                <div className="text-rose-800 font-bold">BROKEN</div>
                <div className="text-xl font-bold text-rose-950 font-mono mt-1">
                  {statusCounts.BROKEN.toLocaleString()}
                </div>
              </div>

              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                <div className="text-purple-800 font-bold">LOANED</div>
                <div className="text-xl font-bold text-purple-950 font-mono mt-1">
                  {statusCounts.LOANED.toLocaleString()}
                </div>
              </div>

              <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl">
                <div className="text-slate-700 font-bold">SOLD</div>
                <div className="text-xl font-bold text-slate-900 font-mono mt-1">
                  {statusCounts.SOLD.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Movements Preview */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-700" />
                <span>Aktivitas Mutasi Terkini</span>
              </h3>
              <button
                onClick={() => onNavigateTab('machines')}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-bold"
              >
                Lihat Semua
              </button>
            </div>

            <div className="space-y-2">
              {movements.slice(0, 4).map((mov) => (
                <div
                  key={mov.movementId}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between gap-2"
                >
                  <div className="space-y-0.5 truncate">
                    <div className="font-mono font-bold text-emerald-700">{mov.assetCode}</div>
                    <div className="text-slate-700 truncate">
                      {mov.fromLocation} → <span className="text-emerald-700 font-bold">{mov.toLocation}</span>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-500 shrink-0 font-mono">
                    {new Date(mov.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
