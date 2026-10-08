import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  History,
  Search,
  Calendar,
  Building2,
  RefreshCw,
  Download,
  AlertTriangle,
  ArrowRight,
  User,
  Clock,
  Filter,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../services/authContext';
import { gasAuthService, ServerMovementRecord } from '../services/gasAuthService';
import { Pagination } from '../components/Pagination';
import { formatDateTime } from '../utils/dateTime';

const PAGE_SIZE = 25;

interface HistoryViewProps {
  onSelectMachine?: (assetCode: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ onSelectMachine }) => {
  const { currentUser } = useAuth();
  const tableTopRef = useRef<HTMLDivElement | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSite, setSelectedSite] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Data states
  const [movements, setMovements] = useState<ServerMovementRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [currentLimit, setCurrentLimit] = useState<number>(200);

  // Available sites from user session
  const accessibleSites = useMemo(() => {
    const rawSites = currentUser?.siteAccess || [];
    const list = rawSites.filter((s) => s !== 'ALL');
    return list.length > 0 ? list : ['PW1', 'PW2', 'PW3', 'WH2', 'SW', 'QA'];
  }, [currentUser]);

  // Fetch data from server
  const fetchMovementsData = useCallback(
    async (limit: number, append: boolean = false) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        const res = await gasAuthService.getMovements({
          site: selectedSite !== 'ALL' ? selectedSite : undefined,
          from: fromDate ? fromDate : undefined,
          to: toDate ? toDate : undefined,
          limit,
        });

        if (res.success) {
          const newRecords = res.movements || [];
          if (append) {
            setMovements((prev) => {
              const existingIds = new Set(prev.map((p) => p.historyId));
              const uniqueNew = newRecords.filter((n) => !existingIds.has(n.historyId));
              return [...prev, ...uniqueNew];
            });
          } else {
            setMovements(newRecords);
          }
          setHasMore(Boolean(res.hasMore));
        } else {
          setErrorMessage(res.message || 'Gagal memuat riwayat pemindahan mesin dari server.');
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Tidak dapat terhubung ke server.');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [selectedSite, fromDate, toDate]
  );

  // Initial load on mount or tab focus
  useEffect(() => {
    setCurrentLimit(200);
    setCurrentPage(1);
    fetchMovementsData(200, false);
  }, [fetchMovementsData]);

  const handleApplyFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setCurrentLimit(200);
    setCurrentPage(1);
    fetchMovementsData(200, false);
  };

  const handleResetFilter = () => {
    setSearchQuery('');
    setSelectedSite('ALL');
    setFromDate('');
    setToDate('');
    setCurrentLimit(200);
    setCurrentPage(1);
    gasAuthService.getMovements({ limit: 200 }).then((res) => {
      if (res.success && res.movements) {
        setMovements(res.movements);
        setHasMore(Boolean(res.hasMore));
      }
    });
  };

  const handleLoadMore = () => {
    const nextLimit = Math.min(currentLimit + 200, 1000);
    setCurrentLimit(nextLimit);
    fetchMovementsData(nextLimit, true);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    if (tableTopRef.current) {
      tableTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Client-side search filtering across records
  const filteredMovements = useMemo(() => {
    if (!searchQuery.trim()) return movements;
    const query = searchQuery.trim().toLowerCase();
    return movements.filter(
      (m) =>
        (m.assetCode && m.assetCode.toLowerCase().includes(query)) ||
        (m.barcode && m.barcode.toLowerCase().includes(query)) ||
        (m.serial && m.serial.toLowerCase().includes(query)) ||
        (m.machineName && m.machineName.toLowerCase().includes(query)) ||
        (m.fromLocation && m.fromLocation.toLowerCase().includes(query)) ||
        (m.toLocation && m.toLocation.toLowerCase().includes(query)) ||
        (m.movedBy && m.movedBy.toLowerCase().includes(query)) ||
        (m.reason && m.reason.toLowerCase().includes(query))
    );
  }, [movements, searchQuery]);

  // Client-side pagination (maksimal 25 baris per halaman)
  const paginatedMovements = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredMovements.slice(start, start + PAGE_SIZE);
  }, [filteredMovements, currentPage]);

  // Pastikan currentPage tetap dalam batas valid jika hasil filter berubah
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredMovements.length / PAGE_SIZE));
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [filteredMovements.length, currentPage]);

  // Client-side CSV export
  const handleExportCsv = () => {
    if (filteredMovements.length === 0) return;

    const headers = [
      'Waktu',
      'Kode Aset',
      'Barcode',
      'Nama Mesin',
      'Nomor Seri',
      'Dari Lokasi',
      'Ke Lokasi',
      'Dari Site',
      'Ke Site',
      'Status',
      'Alasan',
      'Oleh',
      'Status Undo',
      'Catatan',
    ];

    const rows = filteredMovements.map((m) => [
      `"${(m.timestamp || '').replace(/"/g, '""')}"`,
      `"${(m.assetCode || '').replace(/"/g, '""')}"`,
      `"${(m.barcode || '').replace(/"/g, '""')}"`,
      `"${(m.machineName || '').replace(/"/g, '""')}"`,
      `"${(m.serial || '').replace(/"/g, '""')}"`,
      `"${(m.fromLocation || '').replace(/"/g, '""')}"`,
      `"${(m.toLocation || '').replace(/"/g, '""')}"`,
      `"${(m.fromSite || '').replace(/"/g, '""')}"`,
      `"${(m.toSite || '').replace(/"/g, '""')}"`,
      `"${(m.status || '').replace(/"/g, '""')}"`,
      `"${(m.reason || '').replace(/"/g, '""')}"`,
      `"${(m.movedBy || '').replace(/"/g, '""')}"`,
      `"${m.isUndone ? 'Dibatalkan' : 'Aktif'}"`,
      `"${(m.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `riwayat_mesin_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2 animate-in fade-in">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#0f1b2d] border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                Riwayat Mesin
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Log riwayat mutasi dan pergerakan lokasi mesin langsung dari server GAS
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchMovementsData(currentLimit, false)}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            title="Muat Ulang Data Server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredMovements.length === 0}
            className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Ekspor Data ke File CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div className="p-5 rounded-3xl bg-white dark:bg-[#0f1b2d] border border-slate-200/90 dark:border-slate-800 shadow-sm">
        <form onSubmit={handleApplyFilter} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Box */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Pencarian (Kode / Barcode / Serial):
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Contoh: 000000066145 / DDL"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Site Selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Filter Site Pabrik / Gudang:
              </label>
              <div className="relative">
                <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={selectedSite}
                  onChange={(e) => {
                    setSelectedSite(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white font-bold focus:border-indigo-500 focus:outline-none"
                >
                  <option value="ALL">Semua Site Terjangkau</option>
                  {accessibleSites.map((s) => (
                    <option key={s} value={s}>
                      Site {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dari Tanggal */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Dari Tanggal:
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Sampai Tanggal */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Sampai Tanggal:
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              Menampilkan {filteredMovements.length} baris riwayat
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetFilter}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Filter className="w-3 h-3" />
                <span>Terapkan</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchMovementsData(currentLimit, false)}
            className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer shrink-0"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="p-6 rounded-3xl bg-white dark:bg-[#0f1b2d] border border-slate-200/90 dark:border-slate-800 space-y-4 shadow-sm">
          <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/4 animate-pulse" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="h-16 bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        </div>
      ) : filteredMovements.length === 0 ? (
        /* Empty State */
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-[#0f1b2d] border border-slate-200/90 dark:border-slate-800 space-y-3 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <History className="w-7 h-7" />
          </div>
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
            Belum ada riwayat untuk site Anda
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Tidak ada catatan pergerakan mesin yang cocok dengan kriteria filter yang dipilih.
          </p>
          <button
            type="button"
            onClick={handleResetFilter}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            Bersihkan Filter
          </button>
        </div>
      ) : (
        /* Table & Card Presentation */
        <div ref={tableTopRef} className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block rounded-3xl bg-white dark:bg-[#0f1b2d] border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] font-mono">
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Mesin</th>
                    <th className="py-3 px-4">Dari → Ke (Lokasi)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Alasan &amp; Catatan</th>
                    <th className="py-3 px-4">Oleh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {paginatedMovements.map((m) => (
                    <tr
                      key={m.historyId || `${m.assetCode}-${m.timestamp}`}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                        m.isUndone ? 'opacity-55 bg-rose-50/20 dark:bg-rose-950/10' : ''
                      }`}
                    >
                      {/* Waktu */}
                      <td className="py-3.5 px-4 whitespace-nowrap align-top">
                        <div
                          className="font-mono text-slate-900 dark:text-slate-100 font-semibold"
                          title={m.timestamp}
                        >
                          {formatDateTime(m.timestamp, { seconds: true })}
                        </div>
                        {m.isUndone && (
                          <span className="inline-block mt-1 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                            Dibatalkan (Undo)
                          </span>
                        )}
                      </td>

                      {/* Mesin */}
                      <td className="py-3.5 px-4 align-top">
                        <div
                          onClick={() => m.assetCode && onSelectMachine && onSelectMachine(m.assetCode)}
                          className={`font-black text-slate-900 dark:text-white font-mono text-xs ${
                            m.isUndone ? 'line-through text-slate-500' : ''
                          } ${onSelectMachine ? 'hover:text-indigo-600 cursor-pointer' : ''}`}
                        >
                          {m.assetCode || 'N/A'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs">
                          {m.machineName || 'Mesin Jahit'}
                        </div>
                        {(m.barcode || m.serial) && (
                          <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                            {m.barcode ? `BC: ${m.barcode}` : ''}{' '}
                            {m.serial ? `SN: ${m.serial}` : ''}
                          </div>
                        )}
                      </td>

                      {/* Dari -> Ke */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            {m.fromSite ? `[${m.fromSite}] ` : ''}
                            {m.fromLocation || '-'}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {m.toSite ? `[${m.toSite}] ` : ''}
                            {m.toLocation || '-'}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center align-top whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            m.status === 'ACTIVE'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : m.status === 'BROKEN'
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900'
                              : m.status === 'IN_REPAIR'
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                              : m.status === 'LOANED'
                              ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {m.status || 'MUTASI'}
                        </span>
                      </td>

                      {/* Alasan & Catatan */}
                      <td className="py-3.5 px-4 align-top text-xs text-slate-700 dark:text-slate-300 max-w-xs">
                        <div className="font-medium">{m.reason || '-'}</div>
                        {m.notes && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 italic mt-0.5">
                            {m.notes}
                          </div>
                        )}
                      </td>

                      {/* Oleh */}
                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <div className="font-bold text-slate-800 dark:text-slate-200 text-[11px] flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{m.movedBy || 'Sistem'}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List View */}
          <div className="md:hidden space-y-3">
            {paginatedMovements.map((m) => (
              <div
                key={m.historyId || `${m.assetCode}-${m.timestamp}`}
                className={`p-4 rounded-2xl bg-white dark:bg-[#0f1b2d] border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-xs ${
                  m.isUndone ? 'opacity-60 border-rose-200' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span title={m.timestamp}>{formatDateTime(m.timestamp, { seconds: true })}</span>
                  </div>
                  {m.isUndone ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 border border-rose-200">
                      Dibatalkan
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {m.status || 'MUTASI'}
                    </span>
                  )}
                </div>

                <div>
                  <div
                    onClick={() => m.assetCode && onSelectMachine && onSelectMachine(m.assetCode)}
                    className={`font-black text-slate-900 dark:text-white font-mono text-sm ${
                      m.isUndone ? 'line-through text-slate-500' : ''
                    }`}
                  >
                    {m.assetCode || 'N/A'}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    {m.machineName || 'Mesin Jahit'}
                  </div>
                  {(m.barcode || m.serial) && (
                    <div className="text-[10px] font-mono text-slate-400">
                      {m.barcode ? `BC: ${m.barcode}` : ''} {m.serial ? `SN: ${m.serial}` : ''}
                    </div>
                  )}
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-amber-700 dark:text-amber-400 font-mono">
                    {m.fromSite ? `[${m.fromSite}] ` : ''}
                    {m.fromLocation || '-'}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                    {m.toSite ? `[${m.toSite}] ` : ''}
                    {m.toLocation || '-'}
                  </span>
                </div>

                {m.reason && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 italic">
                    Alasan: {m.reason}
                  </p>
                )}

                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1">
                  <span>
                    Oleh: <strong className="text-slate-800 dark:text-slate-200">{m.movedBy || 'Sistem'}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Kontrol Paginasi */}
          <Pagination
            currentPage={currentPage}
            totalItems={filteredMovements.length}
            pageSize={PAGE_SIZE}
            onPageChange={handlePageChange}
            hasMore={hasMore}
            itemLabel="riwayat"
            onLoadMore={handleLoadMore}
            isLoadingMore={isLoadingMore}
          />
        </div>
      )}
    </div>
  );
};

export default HistoryView;
