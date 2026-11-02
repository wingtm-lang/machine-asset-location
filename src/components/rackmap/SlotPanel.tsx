import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../services/authContext';
import { makeT, localizeMessage } from '../../services/translations';
import {
  RackConfig,
  RackSlotItem,
  MachineSearchResult,
  rackMapService,
} from '../../services/rackMapService';
import { SelectedColumnCoord } from './RackDetail';
import { supabase } from '../../services/supabase';
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
  /** Ikon scan per slot: minta pemindai kamera untuk slot ini (hasilnya kembali lewat scanInput). */
  onRequestScan?: (slotNumber: number) => void;
  /** Hasil scan dari pemindai kamera. Diproses sekali per nonce: masuk ke kolom Cari slot lalu otomatis dicari. */
  scanInput?: SlotScanInput | null;
}

export interface SlotScanInput {
  slot: number;
  code: string;
  nonce: number;
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
  onRequestScan,
  scanInput,
}) => {
  const { language } = useAuth();
  const t = makeT(language);
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
  const handleSearch = async (slotNumber: number, override?: string) => {
    const query = (override ?? searchQueries[slotNumber] ?? '').trim();
    if (!query) {
      notify('warning', t('sp_warn_empty_query'));
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
        notify('error', res.message ? localizeMessage(res.message, language) : t('sp_not_found', { query }));
      }
    } catch (err: any) {
      notify('error', localizeMessage(err.message, language) || t('sp_err_search'));
    } finally {
      setSearchingSlot(null);
    }
  };

  // Hasil scan kamera: tempel ke kolom Cari slot tujuan, lalu cari otomatis.
  // Penempatan tetap menunggu klik "Tempatkan" (tanpa auto-assign).
  const lastScanNonce = useRef<number | undefined>(scanInput?.nonce);
  useEffect(() => {
    if (!scanInput || scanInput.nonce === lastScanNonce.current) return;
    lastScanNonce.current = scanInput.nonce;
    setSearchQueries((prev) => ({ ...prev, [scanInput.slot]: scanInput.code }));
    setSearchResults((prev) => ({ ...prev, [scanInput.slot]: null }));
    handleSearch(scanInput.slot, scanInput.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanInput?.nonce]);

  // Assign machine to slot
  const handleAssign = async (slotNumber: number, machine: MachineSearchResult) => {
    // 1. Validasi Status ACTIVE
    if (machine.status !== 'ACTIVE') {
      notify(
        'error',
        t('sp_err_not_active', { code: machine.assetCode, status: machine.status })
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
        t('sp_err_not_wh2', { code: machine.assetCode, site: site || t('sp_site_outside'), loc })
      );
      return;
    }

    // 3. Cek jika mesin sudah berada di slot rak lain (misal WH2-R1-B03-S1)
    const rackMatch = loc.match(/^WH2-(R[1-6])-([A-C]\d+-S[1-3])/i);
    const targetLoc = `WH2-${rack.id}-${coord.level}${coord.column}-S${slotNumber}`;

    // Catatan: dulu ada window.confirm() di sini bila mesin sudah berada di slot rak lain.
    // Dihapus karena dialog native bisa diblokir di sebagian lingkungan dan membuat tombol
    // gagal diam-diam tanpa pesan apa pun. Pemindahan antar slot tetap aman: tervalidasi
    // di server (slot tujuan tidak boleh terisi) dan tercatat penuh di Riwayat Mesin.

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
        notify('success', res.message ? localizeMessage(res.message, language) : t('sp_ok_assigned', { code: machine.assetCode, slot: slotNumber }));
        setLastAssignedAsset({ slot: slotNumber, assetCode: machine.assetCode });
        // Clear search input and result
        setSearchQueries((prev) => ({ ...prev, [slotNumber]: '' }));
        setSearchResults((prev) => ({ ...prev, [slotNumber]: null }));
        // Refresh rack data
        await onRefresh();
      } else {
        notify('error', res.message ? localizeMessage(res.message, language) : t('sp_err_assign'));
      }
    } catch (err: any) {
      notify('error', localizeMessage(err.message, language) || t('sp_err_system'));
    } finally {
      setLoadingActionSlot(null);
    }
  };

  // Remove machine from slot (set to WH2-UNASSIGNED)
  const handleRemove = async (slotNumber: number, item: RackSlotItem) => {
    // Tidak pakai window.confirm(): di beberapa lingkungan dialog native diblokir dan
    // tombol ini gagal diam-diam tanpa pesan apa pun. Aksi ini aman (bisa di-undo).
    setLoadingActionSlot(slotNumber);
    setStatusMessage(null);

    try {
      const res = await rackMapService.removeMachineFromRack(item.assetCode, byUser || 'User');
      if (res.success) {
        notify('success', res.message ? localizeMessage(res.message, language) : t('sp_ok_removed', { code: item.assetCode }));
        setLastAssignedAsset(null);
        await onRefresh();
      } else {
        notify('error', res.message ? localizeMessage(res.message, language) : t('sp_err_remove'));
      }
    } catch (err: any) {
      notify('error', localizeMessage(err.message, language) || t('sp_err_processing'));
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
        notify('success', res.message ? localizeMessage(res.message, language) : t('sp_ok_undone', { code: assetCode }));
        setLastAssignedAsset(null);
        await onRefresh();
      } else {
        notify('error', res.message ? localizeMessage(res.message, language) : t('sp_err_undo'));
      }
    } catch (err: any) {
      notify('error', localizeMessage(err.message, language) || t('sp_err_undo2'));
    } finally {
      setLoadingActionSlot(null);
    }
  };

  // --- Mesin non sewing di kolom ini: berbagi slot dengan mesin sewing, tidak dihitung dalam 3 slot ---
  type NsHere = { asset_code: string; item: string | null; standard_machine_name: string | null; location_id: string };
  const slotIds = [1, 2, 3].map((n) => `WH2-${positionCode}-S${n}`);
  const [nsOpen, setNsOpen] = useState(false);
  const [nsHere, setNsHere] = useState<NsHere[]>([]);
  const [nsSlot, setNsSlot] = useState(1);
  const [nsCode, setNsCode] = useState('');
  const [nsBusy, setNsBusy] = useState(false);

  const loadNsHere = async () => {
    const { data } = await supabase
      .from('machines')
      .select('asset_code, item, standard_machine_name, location_id')
      .eq('category', 'NON_SEWING')
      .in('location_id', slotIds)
      .order('location_id');
    setNsHere((data ?? []) as unknown as NsHere[]);
  };
  useEffect(() => {
    setNsOpen(false);
    setNsCode('');
    void loadNsHere();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionCode]);

  const nsMove = async (assetCode: string, locationId: string) => {
    const { data, error } = await supabase.rpc('move_machine', {
      p_asset_code: assetCode,
      p_location_id: locationId,
      p_request_id: crypto.randomUUID(),
    });
    const r = (data ?? {}) as { success?: boolean; message?: string };
    if (error || r.success === false) {
      notify('error', localizeMessage(error?.message || r.message || '', language));
      return false;
    }
    return true;
  };

  const handleNsAdd = async () => {
    const code = nsCode.trim();
    if (!code || nsBusy) return;
    setNsBusy(true);
    try {
      const safe = code.replace(/[,()"\\]/g, '');
      const { data } = await supabase
        .from('machines')
        .select('asset_code, site_id')
        .eq('category', 'NON_SEWING')
        .or(`barcode.eq.${safe},asset_code.eq.${safe.toUpperCase()},serial.eq.${safe}`)
        .limit(1);
      const row = (data ?? [])[0] as { asset_code: string; site_id: string } | undefined;
      if (!row) {
        notify('error', t('sp_ns_not_found', { code }));
      } else if (row.site_id !== 'WH2') {
        notify('error', t('sp_ns_not_wh2', { code: row.asset_code, site: row.site_id }));
      } else if (await nsMove(row.asset_code, `WH2-${positionCode}-S${nsSlot}`)) {
        notify('success', t('sp_ns_added', { code: row.asset_code, slot: nsSlot }));
        setNsCode('');
        await loadNsHere();
      }
    } finally {
      setNsBusy(false);
    }
  };

  const handleNsRemove = async (assetCode: string) => {
    if (nsBusy) return;
    setNsBusy(true);
    try {
      if (await nsMove(assetCode, 'WH2-NS-UNASSIGNED')) {
        notify('success', t('sp_ns_removed', { code: assetCode }));
        await loadNsHere();
      }
    } finally {
      setNsBusy(false);
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
          title={t('sp_close_title')}
          aria-label={t('sp_close_aria')}
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
                  {filledItem ? t('sp_filled') : t('sp_empty')}
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
                      {filledItem.localName || filledItem.name || t('sp_default_name')}
                      {filledItem.serial ? ` · ${filledItem.serial}` : ''}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isGlobalLoading}
                    onClick={() => handleRemove(slotNumber, filledItem)}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-40 shrink-0"
                    title={t('sp_remove_title')}
                    aria-label={t('sp_remove_aria', { slot: slotNumber })}
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
                        placeholder={t('sp_search_ph')}
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
                      title={t('sp_search_title')}
                    >
                      {isSearchingThis ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>{t('sp_search_btn')}</span>
                      )}
                    </button>
                    {(onRequestScan || onOpenScanner) && (
                      <button
                        type="button"
                        disabled={isGlobalLoading}
                        onClick={() => (onRequestScan ? onRequestScan(slotNumber) : onOpenScanner?.())}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                        title={t('sp_scan_title')}
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
                          {searchResult.localName || searchResult.standardMachineName || t('sp_machine')} {searchResult.model ? `· ${searchResult.model}` : ''}
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
                          <span>{t('sp_place')}</span>
                        </button>
                        <button
                          type="button"
                          disabled={isGlobalLoading}
                          onClick={() =>
                            setSearchResults((prev) => ({ ...prev, [slotNumber]: null }))
                          }
                          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          title={t('cancel')}
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

      {/* Mesin non sewing di kolom ini: tampil setelah tombol ditekan */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setNsOpen((v) => !v)}
          className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          aria-expanded={nsOpen}
        >
          <span>{t('sp_ns_toggle', { n: nsHere.length })}</span>
          <span aria-hidden="true">{nsOpen ? '−' : '+'}</span>
        </button>
        {nsOpen && (
          <div className="mt-2 space-y-2">
            {nsHere.length === 0 ? (
              <div className="text-[11px] text-slate-400">{t('sp_ns_none')}</div>
            ) : (
              nsHere.map((m) => (
                <div
                  key={m.asset_code}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]"
                >
                  <div className="min-w-0">
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-100">{m.asset_code}</div>
                    <div className="text-slate-500 dark:text-slate-400 truncate">
                      {m.standard_machine_name || m.item || '-'} · {t('sp_slot_n', { n: m.location_id.slice(-1) })}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={nsBusy}
                    onClick={() => handleNsRemove(m.asset_code)}
                    className="px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 shrink-0"
                  >
                    {t('sp_ns_remove')}
                  </button>
                </div>
              ))
            )}
            <div className="flex items-center gap-2">
              <select
                value={nsSlot}
                onChange={(e) => setNsSlot(Number(e.target.value))}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs"
                aria-label={t('sp_ns_slot_aria')}
              >
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>{t('sp_slot_n', { n })}</option>
                ))}
              </select>
              <input
                value={nsCode}
                onChange={(e) => setNsCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleNsAdd(); } }}
                placeholder={t('sp_ns_ph')}
                className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono"
              />
              <button
                type="button"
                disabled={nsBusy || !nsCode.trim()}
                onClick={() => void handleNsAdd()}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-50"
              >
                {t('sp_ns_add')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tombol Undo Penempatan Terakhir */}
      {lastAssignedAsset && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {t('sp_just_placed')} <b className="text-slate-700 dark:text-slate-200">{lastAssignedAsset.assetCode}</b>
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
