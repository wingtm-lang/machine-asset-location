import React, { useState } from 'react';
import {
  RackConfig,
  RackSlotItem,
  MachineSearchResult,
  rackMapService,
} from '../../services/rackMapService';
import { SelectedColumnCoord } from './RackDetail';
import {
  Search,
  RotateCcw,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  Package,
  QrCode,
} from 'lucide-react';

interface SlotPanelProps {
  rack: RackConfig;
  coord: SelectedColumnCoord;
  slots: RackSlotItem[];
  byUser: string;
  onRefresh: () => Promise<void>;
  onClose: () => void;
  onNotifyToast?: (type: 'success' | 'error' | 'warning', text: string) => void;
  onOpenScanner?: () => void;
}

export const SlotPanel: React.FC<SlotPanelProps> = ({
  rack,
  coord,
  slots,
  byUser,
  onRefresh,
  onClose,
  onNotifyToast,
  onOpenScanner,
}) => {
  const positionCode = `${rack.id}-${coord.level}${coord.column}`;

  // Slot states (1, 2, 3)
  const [searchQueries, setSearchQueries] = useState<Record<number, string>>({
    1: '',
    2: '',
    3: '',
  });
  const [searchResults, setSearchResults] = useState<Record<number, MachineSearchResult | null>>({
    1: null,
    2: null,
    3: null,
  });
  const [searchingSlot, setSearchingSlot] = useState<number | null>(null);
  const [loadingActionSlot, setLoadingActionSlot] = useState<number | null>(null);

  // Status message state
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);

  const notify = (type: 'success' | 'error' | 'warning', text: string) => {
    if (onNotifyToast) {
      onNotifyToast(type, text);
    } else {
      setStatusMessage({ type, text });
    }
  };

  // Undo memory: asset code that was just assigned
  const [lastAssignedAsset, setLastAssignedAsset] = useState<{
    slot: number;
    assetCode: string;
  } | null>(null);

  // Find slot items for current rack + level + column
  const getSlotItem = (slotNumber: number): RackSlotItem | undefined => {
    return slots.find(
      (s) =>
        s.rak === rack.id &&
        s.tingkat === coord.level &&
        s.kolom === coord.column &&
        s.slot === slotNumber
    );
  };

  // Hitung jumlah slot terisi di posisi ini
  const filledCount = [1, 2, 3].filter((slotNum) => Boolean(getSlotItem(slotNum))).length;

  // Search handler for empty slot
  const handleSearch = async (slotNumber: number) => {
    const query = (searchQueries[slotNumber] || '').trim();
    if (!query) {
      notify('warning', 'Ketik kode aset, barcode, atau serial mesin.');
      return;
    }

    setSearchingSlot(slotNumber);
    setStatusMessage(null);

    try {
      const res = await rackMapService.searchMachine(query);
      if (res.success && res.machine) {
        setSearchResults((prev) => ({ ...prev, [slotNumber]: res.machine! }));
      } else {
        setSearchResults((prev) => ({ ...prev, [slotNumber]: null }));
        notify('error', res.message || `Mesin "${query}" tidak ditemukan.`);
      }
    } catch (err: any) {
      notify('error', err.message || 'Gagal mencari mesin.');
    } finally {
      setSearchingSlot(null);
    }
  };

  // Assign machine to slot
  const handleAssign = async (slotNumber: number, machine: MachineSearchResult) => {
    // 1. Validasi Status ACTIVE
    if (machine.status !== 'ACTIVE') {
      notify(
        'error',
        `Mesin ${machine.assetCode} berstatus "${machine.status}". Hanya mesin ACTIVE yang dapat ditempatkan di rak.`
      );
      return;
    }

    // 2. Validasi Site WH2
    const loc = machine.locationId || '';
    const site = machine.siteId || '';
    const isWh2 = site === 'WH2' || loc.toUpperCase().startsWith('WH2');

    if (!isWh2) {
      notify(
        'error',
        `Mesin ${machine.assetCode} terdaftar di site ${site || 'Luar'} (${loc}). Fitur ini khusus site WH2.`
      );
      return;
    }

    // 3. Cek jika mesin sudah berada di slot rak lain (misal WH2-R1-B03-S1)
    const rackMatch = loc.match(/^WH2-(R[1-6])-([A-C]\d+-S[1-3])/i);
    const targetLoc = `WH2-${rack.id}-${coord.level}${coord.column}-S${slotNumber}`;

    if (rackMatch && loc.toUpperCase() !== targetLoc.toUpperCase()) {
      const existingPos = `${rackMatch[1]}-${rackMatch[2]}`;
      const confirmed = window.confirm(
        `Mesin ini sudah di ${existingPos}. Pindahkan ke slot ini (${positionCode}-S${slotNumber})?`
      );
      if (!confirmed) {
        return;
      }
    }

    setLoadingActionSlot(slotNumber);
    setStatusMessage(null);

    try {
      const res = await rackMapService.assignRackSlot({
        assetCode: machine.assetCode,
        siteId: 'WH2',
        rak: rack.id,
        tingkat: coord.level,
        kolom: coord.column,
        slot: slotNumber,
        byUser: byUser || 'User',
      });

      if (res.success) {
        notify('success', res.message || `Mesin ${machine.assetCode} berhasil ditempatkan di Slot ${slotNumber}.`);
        setLastAssignedAsset({ slot: slotNumber, assetCode: machine.assetCode });
        // Clear search input and result
        setSearchQueries((prev) => ({ ...prev, [slotNumber]: '' }));
        setSearchResults((prev) => ({ ...prev, [slotNumber]: null }));
        // Refresh rack data
        await onRefresh();
      } else {
        notify('error', res.message || 'Gagal menempatkan mesin ke slot rak.');
      }
    } catch (err: any) {
      notify('error', err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoadingActionSlot(null);
    }
  };

  // Remove machine from slot (set to WH2-UNASSIGNED)
  const handleRemove = async (slotNumber: number, item: RackSlotItem) => {
    const confirmed = window.confirm(
      `Keluarkan mesin ${item.assetCode} dari slot ${slotNumber}? Lokasi dikembalikan ke WH2-UNASSIGNED.`
    );
    if (!confirmed) return;

    setLoadingActionSlot(slotNumber);
    setStatusMessage(null);

    try {
      const res = await rackMapService.removeMachineFromRack(item.assetCode, byUser || 'User');
      if (res.success) {
        notify('success', res.message || `Mesin ${item.assetCode} berhasil dikeluarkan dari rak.`);
        setLastAssignedAsset(null);
        await onRefresh();
      } else {
        notify('error', res.message || 'Gagal mengeluarkan mesin.');
      }
    } catch (err: any) {
      notify('error', err.message || 'Terjadi kesalahan saat memproses.');
    } finally {
      setLoadingActionSlot(null);
    }
  };

  // Undo placement
  const handleUndo = async (assetCode: string) => {
    setLoadingActionSlot(999);
    setStatusMessage(null);

    try {
      const res = await rackMapService.undoMove(assetCode, byUser || 'User');
      if (res.success) {
        notify('success', res.message || `Penempatan mesin ${assetCode} berhasil dibatalkan.`);
        setLastAssignedAsset(null);
        await onRefresh();
      } else {
        notify('error', res.message || 'Gagal membatalkan penempatan.');
      }
    } catch (err: any) {
      notify('error', err.message || 'Gagal melakukan undo.');
    } finally {
      setLoadingActionSlot(null);
    }
  };

  const isGlobalLoading = loadingActionSlot !== null || searchingSlot !== null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
      {/* Header Panel Ringkas: Judul "R4-B12" + Badge "2/3" + Tombol X */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            {positionCode}
          </h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
            {filledCount}/3
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Tutup panel"
          aria-label="Tutup panel slot"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Fallback inline banner jika notifikasi lokal diperlukan */}
      {statusMessage && (
        <div
          className={`p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
              : statusMessage.type === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />}
            {statusMessage.type === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />}
            {statusMessage.type === 'error' && <XCircle className="w-4 h-4 shrink-0 text-rose-600" />}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs opacity-70 hover:opacity-100 p-0.5"
          >
            ×
          </button>
        </div>
      )}

      {/* 3 Kartu Slot Ringkas Tinggi Seragam (Slot 1, 2, 3) */}
      <div className="space-y-2.5">
        {[1, 2, 3].map((slotNumber) => {
          const filledItem = getSlotItem(slotNumber);
          const isSlotBusy = loadingActionSlot === slotNumber;
          const isSearchingThis = searchingSlot === slotNumber;
          const searchResult = searchResults[slotNumber];
          const queryVal = searchQueries[slotNumber] || '';

          return (
            <div
              key={slotNumber}
              className="p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/60 space-y-2 transition-colors min-h-[92px] flex flex-col justify-center"
            >
              {/* Header Kartu Slot */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      filledItem ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  />
                  Slot {slotNumber}
                </span>

                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                    filledItem
                      ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50'
                      : 'text-slate-400 dark:text-slate-500 bg-slate-200/60 dark:bg-slate-800'
                  }`}
                >
                  {filledItem ? 'Terisi' : 'Kosong'}
                </span>
              </div>

              {/* Slot Terisi: Kode Aset Tebal, Nama/Model Redup, Tombol Ghost Keluarkan */}
              {filledItem ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <div className="font-mono font-bold text-sm text-slate-900 dark:text-white truncate">
                      {filledItem.assetCode}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {filledItem.localName || filledItem.name || 'Mesin Jahit'}
                      {filledItem.serial ? ` · ${filledItem.serial}` : ''}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isGlobalLoading}
                    onClick={() => handleRemove(slotNumber, filledItem)}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-40 shrink-0"
                    title="Keluarkan dari rak"
                    aria-label={`Keluarkan mesin dari Slot ${slotNumber}`}
                  >
                    {isSlotBusy ? (
                      <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                    ) : (
                      <LogOut className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ) : (
                /* Slot Kosong: 1 Baris Input Pencarian & Tombol Tempatkan */
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        disabled={isGlobalLoading}
                        placeholder="Kode aset / barcode / serial"
                        value={queryVal}
                        onChange={(e) =>
                          setSearchQueries((prev) => ({ ...prev, [slotNumber]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSearch(slotNumber);
                          }
                        }}
                        className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={isGlobalLoading || !queryVal.trim()}
                      onClick={() => handleSearch(slotNumber)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white flex items-center gap-1 shadow-2xs transition-colors shrink-0"
                      title="Cari mesin"
                    >
                      {isSearchingThis ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>Cari</span>
                      )}
                    </button>
                    {onOpenScanner && (
                      <button
                        type="button"
                        disabled={isGlobalLoading}
                        onClick={onOpenScanner}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                        title="Scan barcode"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Kartu Hasil Pencarian Ringkas */}
                  {searchResult && (
                    <div className="p-2 rounded-lg border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 flex items-center justify-between gap-2 animate-in fade-in-50">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                            {searchResult.assetCode}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 truncate">
                            ({searchResult.locationId || 'UNASSIGNED'})
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {searchResult.localName || searchResult.standardMachineName || 'Mesin'} {searchResult.model ? `· ${searchResult.model}` : ''}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={isGlobalLoading}
                          onClick={() => handleAssign(slotNumber, searchResult)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white flex items-center gap-1 shadow-2xs transition-colors"
                        >
                          {isSlotBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Package className="w-3.5 h-3.5" />
                          )}
                          <span>Tempatkan</span>
                        </button>
                        <button
                          type="button"
                          disabled={isGlobalLoading}
                          onClick={() =>
                            setSearchResults((prev) => ({ ...prev, [slotNumber]: null }))
                          }
                          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          title="Batal"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tombol Undo Penempatan Terakhir */}
      {lastAssignedAsset && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            Baru saja menempatkan <b className="text-slate-700 dark:text-slate-200">{lastAssignedAsset.assetCode}</b>
          </div>
          <button
            type="button"
            disabled={isGlobalLoading}
            onClick={() => handleUndo(lastAssignedAsset.assetCode)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium border border-amber-300 text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 flex items-center gap-1 transition-colors shrink-0"
          >
            {loadingActionSlot === 999 ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RotateCcw className="w-3 h-3" />
            )}
            <span>Undo</span>
          </button>
        </div>
      )}
    </div>
  );
};
