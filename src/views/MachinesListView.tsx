import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Layers,
  ArrowRightLeft,
  QrCode,
  Download,
  AlertCircle,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  Eye,
  Building,
  RotateCcw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../services/authContext';
import { getTranslation } from '../services/translations';
import { storageService } from '../services/storage';
import { Machine, MachineStatus } from '../types';

interface MachinesListViewProps {
  onSelectMachine: (machine: Machine) => void;
  onOpenScanner: () => void;
  onMoveBatch: (machines: Machine[]) => void;
  onTransferBatch: (machines: Machine[]) => void;
}

export const MachinesListView: React.FC<MachinesListViewProps> = ({
  onSelectMachine,
  onOpenScanner,
  onMoveBatch,
  onTransferBatch,
}) => {
  const { currentUser, language, canPerformAction, canAccessSite } = useAuth();
  const allMachines = storageService.getAllMachines();
  const sites = storageService.getSites();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSite, setSelectedSite] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ACTIVE'); // Default ACTIVE as per A5.3
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('ALL');
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Bulk selection state
  const [selectedAssetCodes, setSelectedAssetCodes] = useState<Set<string>>(new Set());

  // Quick Google Sheet Sync
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const handleQuickSyncFromSheet = async () => {
    setIsSyncing(true);
    setSyncToast(null);
    try {
      const res = await storageService.syncFromGoogleSheet(undefined, 'machine_asset');
      if (res.success) {
        setSyncToast(`Sinkronisasi Sukses: ${res.count} mesin dimuat dari Google Sheet (${res.source})!`);
        setTimeout(() => setSyncToast(null), 5000);
      } else {
        setSyncToast(`Gagal: ${res.message}`);
        setTimeout(() => setSyncToast(null), 7000);
      }
    } catch (e: any) {
      setSyncToast('Gagal sinkronisasi data: ' + e.message);
      setTimeout(() => setSyncToast(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Distinct manufacturers
  const manufacturers = useMemo(() => {
    const set = new Set<string>();
    for (const m of allMachines) {
      if (m.manufacturer) set.add(m.manufacturer);
    }
    return Array.from(set).sort();
  }, [allMachines]);

  // Filtered dataset
  const filteredMachines = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return allMachines.filter((m) => {
      // 1. RBAC Site filter: Non-admin users only see machines at their current site (A4)
      if (currentUser && currentUser.role !== 'Admin' && !currentUser.siteAccess.includes('ALL')) {
        if (!currentUser.siteAccess.includes(m.siteId)) return false;
      }

      // 2. UI Site filter
      if (selectedSite !== 'ALL' && m.siteId !== selectedSite) return false;

      // 3. Status filter
      if (selectedStatus !== 'ALL' && m.status !== selectedStatus) return false;

      // 4. Manufacturer filter
      if (selectedManufacturer !== 'ALL' && m.manufacturer !== selectedManufacturer) return false;

      // 5. Unassigned filter
      if (onlyUnassigned && !m.locationId.includes('UNASSIGNED')) return false;

      // 6. Search query across Barcode, AssetCode, Serial, Model, Standard Name
      if (q) {
        const matchesBarcode = m.barcode.toLowerCase().includes(q);
        const matchesAsset = m.assetCode.toLowerCase().includes(q);
        const matchesSerial = m.serial.toLowerCase().includes(q);
        const matchesModel = m.model.toLowerCase().includes(q);
        const matchesName = m.standardMachineName.toLowerCase().includes(q);
        const matchesLocation = m.locationId.toLowerCase().includes(q);

        if (!matchesBarcode && !matchesAsset && !matchesSerial && !matchesModel && !matchesName && !matchesLocation) {
          return false;
        }
      }

      return true;
    });
  }, [allMachines, currentUser, selectedSite, selectedStatus, selectedManufacturer, onlyUnassigned, searchQuery]);

  // Paginated slice
  const totalPages = Math.ceil(filteredMachines.length / pageSize) || 1;
  const currentMachines = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMachines.slice(start, start + pageSize);
  }, [filteredMachines, currentPage, pageSize]);

  // Handle select all on current page
  const handleSelectAllCurrentPage = () => {
    const next = new Set(selectedAssetCodes);
    const allSelected = currentMachines.every((m) => next.has(m.assetCode));
    if (allSelected) {
      currentMachines.forEach((m) => next.delete(m.assetCode));
    } else {
      currentMachines.forEach((m) => next.add(m.assetCode));
    }
    setSelectedAssetCodes(next);
  };

  const toggleSelectOne = (code: string) => {
    const next = new Set(selectedAssetCodes);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelectedAssetCodes(next);
  };

  // Selected Machine objects
  const selectedMachineObjects = useMemo(() => {
    return allMachines.filter((m) => selectedAssetCodes.has(m.assetCode));
  }, [allMachines, selectedAssetCodes]);

  const handleExportExcel = () => {
    const dataToExport = filteredMachines.map((m) => ({
      'Asset Code': m.assetCode,
      'Barcode (12-Digit)': m.barcode,
      'Standard Machine Name': m.standardMachineName,
      'Item (Korea)': m.item,
      'Manufacturer': m.manufacturer,
      'Model': m.model,
      'Serial': m.serial,
      'Status': m.status,
      'Current Site': m.siteId,
      'Current Location': m.locationId,
      'Home Factory': m.homeFactory,
      'Acquisition Date': m.acqDate,
      'Last Moved At': m.lastMovedAt || '',
      'Last Opname At': m.lastOpnameAt || '',
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Machines');
    XLSX.writeFile(wb, `PT_WINNERS_Machines_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Search and Filters Header Card */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
        {/* Top Search Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari Asset Code (IDN-...), Barcode 12-digit, Serial Number, Model, atau Line..."
              className="w-full bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 font-mono transition-colors shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onOpenScanner}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm shadow-emerald-700/20 transition-transform active:scale-95"
            >
              <QrCode className="w-4 h-4" />
              <span>{getTranslation('scan', language)}</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Ekspor daftar ini ke file Excel .xlsx"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span className="hidden md:inline">Ekspor Excel</span>
            </button>

            <button
              onClick={handleQuickSyncFromSheet}
              disabled={isSyncing}
              className="px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-transform active:scale-95"
              title="Tarik data terbaru langsung dari Google Sheet 'machine_asset'"
            >
              <RotateCcw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden lg:inline">{isSyncing ? 'Menarik Data...' : 'Sync Sheet'}</span>
            </button>
          </div>
        </div>

        {/* Sync Toast Feedback */}
        {syncToast && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncToast}</span>
          </div>
        )}

        {/* Filter Pills / Selectors */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-slate-100 text-xs">
          {/* Site Filter */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
              Site Pabrik / Gudang:
            </label>
            <select
              value={selectedSite}
              onChange={(e) => {
                setSelectedSite(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-emerald-500"
            >
              <option value="ALL">Semua Site (PW1-3, WH2, SW, QA)</option>
              {sites.map((s) => (
                <option key={s.siteId} value={s.siteId}>
                  {s.siteId} - {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
              Status Mesin:
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-emerald-500"
            >
              <option value="ALL">Semua Status (Termasuk Sold)</option>
              <option value="ACTIVE">ACTIVE (Hanya Aktif)</option>
              <option value="IN_REPAIR">IN_REPAIR (Sedang Diperbaiki)</option>
              <option value="BROKEN">BROKEN (Rusak)</option>
              <option value="LOANED">LOANED (Dipinjam)</option>
              <option value="SOLD">SOLD (Dijual/Afkir)</option>
            </select>
          </div>

          {/* Manufacturer Filter */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
              Merk / Produsen:
            </label>
            <select
              value={selectedManufacturer}
              onChange={(e) => {
                setSelectedManufacturer(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-emerald-500"
            >
              <option value="ALL">Semua Merk</option>
              {manufacturers.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Unassigned Toggle */}
          <div className="flex items-end">
            <button
              onClick={() => {
                setOnlyUnassigned(!onlyUnassigned);
                setCurrentPage(1);
              }}
              className={`w-full py-1.5 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                onlyUnassigned
                  ? 'bg-amber-100/80 border-amber-300 text-amber-900 font-extrabold'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Hanya Tanpa Lokasi</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedAssetCodes.size > 0 && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-emerald-900 font-bold">
            <CheckSquare className="w-4 h-4 text-emerald-600" />
            <span>{selectedAssetCodes.size} mesin terpilih</span>
          </div>

          <div className="flex items-center gap-2">
            {canPerformAction('MOVE') && (
              <button
                onClick={() => onMoveBatch(selectedMachineObjects)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center gap-1 shadow-sm"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Pindah Lokasi Batch</span>
              </button>
            )}

            {canPerformAction('TRANSFER') && (
              <button
                onClick={() => onTransferBatch(selectedMachineObjects)}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-bold flex items-center gap-1 shadow-sm"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Kirim Transfer Antar Site</span>
              </button>
            )}

            <button
              onClick={() => setSelectedAssetCodes(new Set())}
              className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Machine Data Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3.5 w-10 text-center">
                  <button
                    onClick={handleSelectAllCurrentPage}
                    className="p-1 text-slate-400 hover:text-slate-700"
                  >
                    {currentMachines.every((m) => selectedAssetCodes.has(m.assetCode)) && currentMachines.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="p-3.5">Kode Aset / Barcode</th>
                <th className="p-3.5">Nama Mesin Standar</th>
                <th className="p-3.5">Merk & Model</th>
                <th className="p-3.5">Nomor Seri</th>
                <th className="p-3.5">Site / Lokasi</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {currentMachines.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    Tidak ada mesin yang cocok dengan kriteria pencarian / filter.
                  </td>
                </tr>
              ) : (
                currentMachines.map((m) => {
                  const isSelected = selectedAssetCodes.has(m.assetCode);
                  const isUnassigned = m.locationId.includes('UNASSIGNED');

                  return (
                    <tr
                      key={m.assetCode}
                      onClick={() => onSelectMachine(m)}
                      className={`hover:bg-emerald-50/40 cursor-pointer transition-colors ${
                        isSelected ? 'bg-emerald-50/60' : ''
                      }`}
                    >
                      <td
                        className="p-3.5 text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectOne(m.assetCode);
                        }}
                      >
                        <button className="p-1 text-slate-400 hover:text-slate-700">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </td>

                      <td className="p-3.5">
                        <div className="font-mono font-bold text-emerald-700 hover:text-emerald-800">{m.assetCode}</div>
                        <div className="font-mono text-[11px] text-slate-400">{m.barcode}</div>
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 text-xs">{m.standardMachineName}</div>
                        <div className="text-[11px] text-slate-500">{m.item || '-'}</div>
                      </td>

                      <td className="p-3.5">
                        <div className="font-semibold text-slate-800">{m.manufacturer}</div>
                        <div className="font-mono text-[11px] text-slate-500">{m.model}</div>
                      </td>

                      <td className="p-3.5 font-mono text-slate-700 font-medium">
                        {m.serial}
                        {m.dataFlag && (
                          <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 font-semibold px-1 py-0.5 rounded border border-amber-200">
                            {m.dataFlag}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold font-mono text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">
                            {m.siteId}
                          </span>
                          <span
                            className={`font-mono font-bold text-xs ${
                              isUnassigned ? 'text-amber-700 underline decoration-amber-400' : 'text-slate-800'
                            }`}
                          >
                            {m.locationId}
                          </span>
                        </div>
                        {m.pendingTransferId && (
                          <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
                            In Transit ({m.pendingTransferId})
                          </div>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                            m.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : m.status === 'BROKEN'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : m.status === 'IN_REPAIR'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : m.status === 'LOANED'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>

                      <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onSelectMachine(m)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                          title="Lihat Detail Lengkap"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Menampilkan {filteredMachines.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{' '}
            {Math.min(currentPage * pageSize, filteredMachines.length)} dari{' '}
            <span className="font-bold text-slate-900">{filteredMachines.length.toLocaleString()}</span> mesin
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span>Baris per halaman:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-800 font-medium"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 disabled:opacity-40 hover:bg-slate-100"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono text-slate-800 font-bold">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 disabled:opacity-40 hover:bg-slate-100"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
