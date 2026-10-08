import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ArrowRightLeft,
  Send,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Building,
  Clock,
  Search,
  ExternalLink,
  QrCode,
  Trash2,
  Plus,
  Layers,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Sparkles,
  Info,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../services/authContext';
import { getTranslation } from '../services/translations';
import { storageService } from '../services/storage';
import { soundService } from '../services/sound';
import { Machine, Transfer, SiteId } from '../types';
import { getMachineLabel } from '../utils/machineName';

// Paginasi riwayat tab "Transfer Terkirim"
const OUTBOUND_PAGE_SIZE = 10;

/** Daftar tombol halaman, contoh: 1 … 4 5 6 … 12 */
function buildPageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('…');
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push('…');
  pages.push(total);
  return pages;
}

interface TransfersViewProps {
  batchMachines?: Machine[];
  onSelectMachine: (machine: Machine) => void;
}

export const TransfersView: React.FC<TransfersViewProps> = ({
  batchMachines,
  onSelectMachine,
}) => {
  const { currentUser, language, canAccessSite } = useAuth();
  const sites = storageService.getSites();
  const allMachines = storageService.getAllMachines();

  const [activeTab, setActiveTab] = useState<'inbound' | 'outbound' | 'send_new'>(() => {
    return batchMachines && batchMachines.length > 0 ? 'send_new' : 'inbound';
  });

  const [selectedToSite, setSelectedToSite] = useState<string>('PW2');
  const [vehicleNo, setVehicleNo] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');
  const [transferNote, setTransferNote] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Batch transfer list
  const [selectedBatchMachines, setSelectedBatchMachines] = useState<Machine[]>(() => {
    return batchMachines && batchMachines.length > 0 ? [...batchMachines] : [];
  });

  // Scan input states
  const [scanInput, setScanInput] = useState<string>('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [recentlyAddedCode, setRecentlyAddedCode] = useState<string | null>(null);

  // Paste batch area states
  const [isPasteModeOpen, setIsPasteModeOpen] = useState<boolean>(false);
  const [pasteInput, setPasteInput] = useState<string>('');
  const [pasteSummary, setPasteSummary] = useState<string | null>(null);

  const scanInputRef = useRef<HTMLInputElement>(null);

  // Receive Modal states
  const [receivingTransfer, setReceivingTransfer] = useState<Transfer | null>(null);
  const [receiveTargetLocationId, setReceiveTargetLocationId] = useState<string>('');

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [outboundPage, setOutboundPage] = useState<number>(1);

  // Sync batchMachines prop if passed from external navigation
  useEffect(() => {
    if (batchMachines && batchMachines.length > 0) {
      setSelectedBatchMachines((prev) => {
        const seen = new Set(prev.map((m) => m.assetCode.toUpperCase()));
        const additions = batchMachines.filter((m) => !seen.has(m.assetCode.toUpperCase()));
        return [...additions, ...prev];
      });
      setActiveTab('send_new');
    }
  }, [batchMachines]);

  // Selalu mulai dari halaman 1 saat membuka tab Transfer Terkirim
  useEffect(() => {
    if (activeTab === 'outbound') setOutboundPage(1);
  }, [activeTab]);

  // Focus scan input whenever entering send_new tab
  useEffect(() => {
    if (activeTab === 'send_new') {
      setTimeout(() => {
        scanInputRef.current?.focus();
      }, 100);
    }
  }, [activeTab]);

  // Transfers lists
  const transfers = storageService.getTransfers();
  const overdueDaysLimit = storageService.getSettings().transferOverdueDays || 3;

  // Inbound transfers: transfers destined to sites the user has access to
  const inboundTransfers = useMemo(() => {
    return transfers.filter((t) => {
      if (t.status !== 'IN_TRANSIT') return false;
      return canAccessSite(t.toSite);
    });
  }, [transfers, currentUser]);

  // Outbound transfers: transfers sent from sites the user has access to
  const outboundTransfers = useMemo(() => {
    return transfers.filter((t) => {
      return canAccessSite(t.fromSite);
    });
  }, [transfers, currentUser]);

  // Paginasi: halaman dijepit agar tetap valid bila jumlah transfer berkurang
  const outboundTotalPages = Math.max(1, Math.ceil(outboundTransfers.length / OUTBOUND_PAGE_SIZE));
  const safeOutboundPage = Math.min(outboundPage, outboundTotalPages);
  const pagedOutboundTransfers = useMemo(() => {
    const start = (safeOutboundPage - 1) * OUTBOUND_PAGE_SIZE;
    return outboundTransfers.slice(start, start + OUTBOUND_PAGE_SIZE);
  }, [outboundTransfers, safeOutboundPage]);

  // Available destination locations when receiving
  const destinationLocations = useMemo(() => {
    if (!receivingTransfer) return [];
    return storageService.getLocations(receivingTransfer.toSite).filter((l) => l.active);
  }, [receivingTransfer]);

  // Validate a single machine query (Barcode / Asset Code / Serial)
  const validateMachineForTransfer = (
    rawCode: string,
    currentList: Machine[]
  ): { valid: true; machine: Machine } | { valid: false; error: string; reason: string } => {
    // Normalisasi: trim dan bersihkan karakter kontrol
    const clean = rawCode.replace(/[\x00-\x1F\x7F]/g, '').trim();
    if (!clean) {
      return { valid: false, error: 'Kode kosong', reason: 'EMPTY' };
    }

    const { machine } = storageService.getMachineByCode(clean);
    if (!machine) {
      return { valid: false, error: `Barcode/Kode "${clean}": tidak ditemukan`, reason: 'NOT_FOUND' };
    }

    if (currentList.some((m) => m.assetCode.toUpperCase() === machine.assetCode.toUpperCase())) {
      return { valid: false, error: `Mesin ${machine.assetCode}: sudah ada di daftar`, reason: 'ALREADY_IN_LIST' };
    }

    if (!canAccessSite(machine.siteId)) {
      return { valid: false, error: `Mesin ${machine.assetCode}: di luar akses Anda (Site ${machine.siteId})`, reason: 'NO_ACCESS' };
    }

    if (machine.pendingTransferId) {
      return { valid: false, error: `Mesin ${machine.assetCode}: sedang dalam proses transfer lain`, reason: 'PENDING' };
    }

    if (machine.status === 'SOLD') {
      return { valid: false, error: `Mesin ${machine.assetCode}: berstatus SOLD/Afkir`, reason: 'SOLD' };
    }

    if (machine.siteId === selectedToSite) {
      return { valid: false, error: `Mesin ${machine.assetCode}: sudah berada di site tujuan (${selectedToSite})`, reason: 'SAME_SITE' };
    }

    return { valid: true, machine };
  };

  // Process single scan input
  const handleProcessScanInput = () => {
    const raw = scanInput;
    if (!raw.trim()) return;

    const res = validateMachineForTransfer(raw, selectedBatchMachines);
    if (res.valid) {
      soundService.playSuccess();
      setSelectedBatchMachines((prev) => [res.machine, ...prev]);
      setRecentlyAddedCode(res.machine.assetCode);
      setScanError(null);
      setTimeout(() => setRecentlyAddedCode(null), 2500);
    } else {
      soundService.playError();
      setScanError(res.error);
    }

    setScanInput('');
    // Always re-focus scan input
    setTimeout(() => {
      scanInputRef.current?.focus();
    }, 10);
  };

  // Handle key down on scan input: intercept Enter key
  const handleScanInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleProcessScanInput();
    }
  };

  // Process paste batch input
  const handleProcessPasteBatch = () => {
    const codes = pasteInput
      .split(/[\s,;\n]+/)
      .map((c) => c.replace(/[\x00-\x1F\x7F]/g, '').trim())
      .filter((c) => c.length > 0);

    if (codes.length === 0) {
      setPasteSummary('Tidak ada kode valid yang dimasukkan.');
      return;
    }

    let addedCount = 0;
    const skippedItems: { code: string; error: string }[] = [];
    let currentBatch = [...selectedBatchMachines];

    for (const code of codes) {
      const res = validateMachineForTransfer(code, currentBatch);
      if (res.valid) {
        currentBatch = [res.machine, ...currentBatch];
        addedCount++;
      } else {
        skippedItems.push({ code, error: res.error });
      }
    }

    setSelectedBatchMachines(currentBatch);
    setPasteInput('');

    if (addedCount > 0) {
      soundService.playSuccess();
    } else {
      soundService.playError();
    }

    if (skippedItems.length > 0) {
      const sampleErrors = skippedItems
        .slice(0, 3)
        .map((s) => s.error)
        .join('; ');
      const moreText = skippedItems.length > 3 ? ` dan ${skippedItems.length - 3} lainnya` : '';
      setPasteSummary(`${addedCount} mesin ditambahkan, ${skippedItems.length} dilewati (${sampleErrors}${moreText}).`);
    } else {
      setPasteSummary(`Semua ${addedCount} mesin berhasil ditambahkan ke daftar!`);
    }

    setTimeout(() => {
      scanInputRef.current?.focus();
    }, 50);
  };

  // Remove single machine from batch list
  const handleRemoveFromBatch = (assetCode: string) => {
    setSelectedBatchMachines((prev) => prev.filter((m) => m.assetCode !== assetCode));
  };

  // Clear all machines from batch list
  const handleClearBatch = () => {
    setSelectedBatchMachines([]);
    setScanError(null);
    setPasteSummary(null);
    setTimeout(() => {
      scanInputRef.current?.focus();
    }, 50);
  };

  // Handle Send Transfer (Step 1)
  const handleSendTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!currentUser || isSending || selectedBatchMachines.length === 0) return;

    setIsSending(true);
    try {
      const res = await storageService.sendTransfer({
        assetCodes: selectedBatchMachines.map((m) => m.assetCode),
        toSite: selectedToSite,
        sentBy: currentUser.username,
        userSiteAccess: currentUser.siteAccess,
        vehicleNo,
        driverName,
        note: transferNote,
      });

      if (res.success) {
        soundService.playSuccess();
        setFeedback({ type: 'success', message: res.message });
        setSelectedBatchMachines([]);
        setVehicleNo('');
        setDriverName('');
        setTransferNote('');
        setActiveTab('outbound');
      } else {
        soundService.playError();
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      soundService.playError();
      setFeedback({ type: 'error', message: err.message || 'Gagal mengirim transfer.' });
    } finally {
      setIsSending(false);
    }
  };

  // Handle Receive Transfer (Step 2)
  const handleConfirmReceive = async () => {
    if (!receivingTransfer || !receiveTargetLocationId || !currentUser || isReceiving) return;

    setIsReceiving(true);
    try {
      const res = await storageService.receiveTransfer({
        transferId: receivingTransfer.transferId,
        toLocationId: receiveTargetLocationId,
        receivedBy: currentUser.username,
        userSiteAccess: currentUser.siteAccess,
      });

      if (res.success) {
        soundService.playSuccess();
        setFeedback({ type: 'success', message: res.message });
        setReceivingTransfer(null);
        setReceiveTargetLocationId('');
      } else {
        soundService.playError();
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      soundService.playError();
      setFeedback({ type: 'error', message: err.message || 'Gagal menerima transfer.' });
    } finally {
      setIsReceiving(false);
    }
  };

  // Handle Cancel Transfer
  const handleCancelTransfer = async (transferId: string) => {
    if (!currentUser || cancellingId) return;
    setCancellingId(transferId);
    try {
      const res = await storageService.cancelTransfer(transferId, currentUser.username, currentUser.siteAccess);
      if (res.success) {
        soundService.playSuccess();
        setFeedback({ type: 'success', message: res.message });
      } else {
        soundService.playError();
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      soundService.playError();
      setFeedback({ type: 'error', message: err.message || 'Gagal membatalkan transfer.' });
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in pb-12">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
            <ArrowRightLeft className="w-4 h-4" />
          </div>
          <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
            {getTranslation('transfers', language)} (Alur 2 Langkah)
          </h1>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Proses transfer antar pabrik: (1) Pengirim memindai mesin & mengirim (In Transit), (2) Penerima mengonfirmasi penerimaan & memilih lokasi tujuan.
        </p>
      </div>

      {/* Tabs Switcher */}
      <div className="flex gap-2 p-1.5 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-2xl shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('inbound')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all min-h-[40px] cursor-pointer ${
            activeTab === 'inbound'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700/60'
          }`}
          aria-label="Tab Menunggu Diterima"
        >
          <Download className="w-4 h-4" />
          <span>Menunggu Diterima ({inboundTransfers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('outbound')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all min-h-[40px] cursor-pointer ${
            activeTab === 'outbound'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700/60'
          }`}
          aria-label="Tab Transfer Terkirim"
        >
          <Send className="w-4 h-4" />
          <span>Transfer Terkirim</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('send_new')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all min-h-[40px] cursor-pointer ${
            activeTab === 'send_new'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700/60'
          }`}
          aria-label="Tab Kirim Transfer Baru"
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>Kirim Transfer Baru {selectedBatchMachines.length > 0 && `(${selectedBatchMachines.length})`}</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center gap-2.5 shadow-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* TAB 1: INBOUND TRANSFERS (PENDING RECEIPT) */}
      {activeTab === 'inbound' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>Daftar Mesin yang Sedang Dikirim Menuju Site Anda</span>
            </h2>
            <span className="text-xs text-slate-500">{inboundTransfers.length} transfer</span>
          </div>

          {inboundTransfers.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              Tidak ada mesin yang sedang dalam perjalanan menuju site Anda.
            </div>
          ) : (
            <div className="space-y-3">
              {inboundTransfers.map((t) => {
                const sentTime = new Date(t.sentAt).getTime();
                const isOverdue = (Date.now() - sentTime) / (1000 * 3600 * 24) > overdueDaysLimit;

                return (
                  <div
                    key={t.transferId}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm">{t.assetCode}</span>
                        <span className="font-mono text-[10px] text-slate-400">({t.transferId})</span>
                        {isOverdue && (
                          <span className="text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                            <span>Terlambat &gt; {overdueDaysLimit} Hari</span>
                          </span>
                        )}
                      </div>

                      <div className="text-slate-700 dark:text-slate-300">
                        Dari Site: <span className="font-bold text-amber-700 dark:text-amber-400">{t.fromSite}</span> → Menuju Site:{' '}
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">{t.toSite}</span>
                      </div>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Dikirim oleh: <span className="text-slate-800 dark:text-slate-200 font-semibold">{t.sentBy}</span> pada{' '}
                        {new Date(t.sentAt).toLocaleString('id-ID')}
                      </div>

                      {t.note && <div className="text-[11px] text-slate-600 dark:text-slate-400 italic">Catatan: {t.note}</div>}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setReceivingTransfer(t);
                        setReceiveTargetLocationId('');
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 self-start sm:self-auto transition-transform active:scale-95 min-h-[40px] cursor-pointer"
                      aria-label={`Terima mesin ${t.assetCode}`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{getTranslation('receive_transfer', language)}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: OUTBOUND TRANSFERS (SENT) */}
      {activeTab === 'outbound' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Send className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <span>Riwayat Transfer Keluar dari Site Anda</span>
          </h2>

          <div className="space-y-3">
            {pagedOutboundTransfers.map((t) => (
              <div
                key={t.transferId}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm">{t.assetCode}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        t.status === 'IN_TRANSIT'
                          ? 'bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                          : t.status === 'RECEIVED'
                          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : 'bg-rose-50 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>

                  <div className="text-slate-700 dark:text-slate-300">
                    Dari: <span className="font-bold text-amber-700 dark:text-amber-400">{t.fromSite}</span> → Ke:{' '}
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">{t.toSite}</span>
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Dikirim: {new Date(t.sentAt).toLocaleString('id-ID')} ({t.sentBy})
                    {t.receivedAt && (
                      <span> • Diterima: {new Date(t.receivedAt).toLocaleString('id-ID')} ({t.receivedBy})</span>
                    )}
                  </div>
                </div>

                {t.status === 'IN_TRANSIT' && (
                  <button
                    type="button"
                    onClick={() => handleCancelTransfer(t.transferId)}
                    disabled={cancellingId === t.transferId}
                    className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900 disabled:opacity-50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-bold flex items-center gap-1 self-start sm:self-auto transition-colors min-h-[40px] cursor-pointer"
                    aria-label={`Batalkan transfer ${t.transferId}`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{cancellingId === t.transferId ? 'Membatalkan...' : getTranslation('cancel_transfer', language)}</span>
                  </button>
                )}
              </div>
            ))}
          </div>

          {outboundTransfers.length > OUTBOUND_PAGE_SIZE && (
            <nav
              className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs"
              aria-label="Paginasi riwayat transfer terkirim"
            >
              <span className="text-slate-500 dark:text-slate-400">
                Menampilkan {(safeOutboundPage - 1) * OUTBOUND_PAGE_SIZE + 1}-
                {Math.min(safeOutboundPage * OUTBOUND_PAGE_SIZE, outboundTransfers.length)} dari {outboundTransfers.length} transfer
              </span>
              <div className="flex flex-wrap items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => setOutboundPage(safeOutboundPage - 1)}
                  disabled={safeOutboundPage <= 1}
                  className="px-3 py-1.5 min-h-[40px] min-w-[40px] rounded-lg text-xs font-bold border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1"
                  aria-label="Halaman sebelumnya"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sebelumnya</span>
                </button>
                {buildPageList(safeOutboundPage, outboundTotalPages).map((p, i) =>
                  p === '…' ? (
                    <span key={`gap-${i}`} className="px-1 text-slate-400">…</span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setOutboundPage(p)}
                      aria-label={`Halaman ${p}`}
                      aria-current={p === safeOutboundPage ? 'page' : undefined}
                      className={`px-3 py-1.5 min-h-[40px] min-w-[40px] rounded-lg text-xs font-bold border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        p === safeOutboundPage
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={() => setOutboundPage(safeOutboundPage + 1)}
                  disabled={safeOutboundPage >= outboundTotalPages}
                  className="px-3 py-1.5 min-h-[40px] min-w-[40px] rounded-lg text-xs font-bold border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1"
                  aria-label="Halaman berikutnya"
                >
                  <span className="hidden sm:inline">Berikutnya</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </nav>
          )}
        </div>
      )}

      {/* TAB 3: SEND NEW TRANSFER (DENGAN ALUR SCAN & BATCH LIST) */}
      {activeTab === 'send_new' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-sm space-y-6">
          <div className="space-y-4">
            {/* Target Site Selector */}
            <div>
              <label htmlFor="select-target-site" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {getTranslation('select_target_site', language)} *:
              </label>
              <select
                id="select-target-site"
                value={selectedToSite}
                onChange={(e) => setSelectedToSite(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 hover:bg-white focus:bg-white dark:hover:bg-slate-800 dark:focus:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:border-emerald-500 font-bold transition-colors min-h-[40px]"
                aria-label="Pilih Site Tujuan Transfer"
              >
                {sites.map((s) => (
                  <option key={s.siteId} value={s.siteId}>
                    {s.siteId} - {s.name} ({s.type})
                  </option>
                ))}
              </select>
            </div>

            {/* 1) SCAN INPUT BOX */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="scan-transfer-input" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Scan Barcode / Kode Aset / Nomor Seri:
                </label>
                <button
                  type="button"
                  onClick={() => setIsPasteModeOpen((prev) => !prev)}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold flex items-center gap-1 min-h-[36px] px-2"
                  aria-label="Buka area tempel banyak kode"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>{isPasteModeOpen ? 'Tutup Tempel Banyak' : 'Tempel banyak kode'}</span>
                  {isPasteModeOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                  <QrCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <input
                  id="scan-transfer-input"
                  ref={scanInputRef}
                  type="text"
                  value={scanInput}
                  onChange={(e) => {
                    setScanInput(e.target.value);
                    if (scanError) setScanError(null);
                  }}
                  onKeyDown={handleScanInputKeyDown}
                  placeholder="Arahkan barcode scanner fisik atau ketik kode lalu tekan Enter..."
                  className="w-full pl-10 pr-24 py-3 bg-slate-50 dark:bg-slate-900 hover:bg-white focus:bg-white dark:hover:bg-slate-800 dark:focus:bg-slate-800 border-2 border-emerald-500 rounded-2xl text-xs text-slate-900 dark:text-white font-mono placeholder:text-slate-400 shadow-xs focus:ring-2 focus:ring-emerald-500/20 transition-all min-h-[44px]"
                  autoComplete="off"
                  autoFocus
                  aria-label="Scan barcode atau kode aset mesin"
                />
                <button
                  type="button"
                  onClick={handleProcessScanInput}
                  disabled={!scanInput.trim()}
                  className="absolute right-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-xs min-h-[34px] cursor-pointer"
                  aria-label="Tambahkan scan"
                >
                  Tambah
                </button>
              </div>

              {/* Error indicator under input */}
              {scanError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span className="font-medium">{scanError}</span>
                </div>
              )}
            </div>

            {/* 3) TEMPEL BANYAK KODE DRAWER */}
            {isPasteModeOpen && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Tempel Banyak Kode / Barcode</span>
                  </span>
                  <span className="text-[11px] text-slate-400">Pisahkan dengan spasi, koma, titik koma, atau baris baru</span>
                </div>

                <textarea
                  value={pasteInput}
                  onChange={(e) => setPasteInput(e.target.value)}
                  placeholder="Contoh:&#10;IDN-8-2009-1396&#10;000000066145&#10;IDN-9-2009-1397"
                  rows={3}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white font-mono placeholder:text-slate-400 focus:border-emerald-500 transition-colors"
                  aria-label="Area teks tempel banyak kode"
                />

                <div className="flex items-center justify-between flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleProcessPasteBatch}
                    disabled={!pasteInput.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 min-h-[40px] cursor-pointer"
                    aria-label="Tambahkan semua kode yang ditempel"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambahkan Semua ke Daftar</span>
                  </button>

                  {pasteSummary && (
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      {pasteSummary}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 2) DAFTAR BATCH (TABEL & KARTU) */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Daftar Mesin Siap Dikirim:</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono font-black text-xs border border-emerald-200 dark:border-emerald-800">
                    {selectedBatchMachines.length} mesin
                  </span>
                </div>

                {selectedBatchMachines.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearBatch}
                    className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-semibold flex items-center gap-1 min-h-[36px] px-2 cursor-pointer"
                    aria-label="Kosongkan seluruh daftar mesin yang akan dikirim"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Kosongkan daftar</span>
                  </button>
                )}
              </div>

              {selectedBatchMachines.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1">
                  <QrCode className="w-7 h-7 mx-auto text-slate-300 dark:text-slate-600 mb-1" />
                  <p className="font-semibold text-slate-600 dark:text-slate-400">Daftar transfer masih kosong.</p>
                  <p className="text-[11px]">Gunakan input scan di atas untuk menambahkan mesin ke dalam batch pengiriman ini.</p>
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-xs">
                  {/* Desktop Table View */}
                  <div className="hidden sm:block max-h-72 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 sticky top-0 border-b border-slate-200 dark:border-slate-700 font-bold">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">#</th>
                          <th className="py-2.5 px-3">Kode Aset / Barcode</th>
                          <th className="py-2.5 px-3">Nama Mesin</th>
                          <th className="py-2.5 px-3">Lokasi Saat Ini</th>
                          <th className="py-2.5 px-3">Site Asal</th>
                          <th className="py-2.5 px-3 text-right w-16">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-800">
                        {selectedBatchMachines.map((m, idx) => {
                          const isRecent = recentlyAddedCode === m.assetCode;
                          const nm = getMachineLabel(m);
                          return (
                            <tr
                              key={m.assetCode}
                              className={`transition-colors ${
                                isRecent
                                  ? 'bg-emerald-50/80 dark:bg-emerald-950/50'
                                  : 'hover:bg-slate-50/80 dark:hover:bg-slate-700/50'
                              }`}
                            >
                              <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                                {selectedBatchMachines.length - idx}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                {m.assetCode}
                                {m.barcode && (
                                  <span className="block text-[10px] text-slate-400 font-normal font-mono">
                                    {m.barcode}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-800 dark:text-slate-200">
                                  {nm.primary}
                                </div>
                                {nm.secondary && (
                                  <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                    {nm.secondary}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                                {m.locationId}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[10px] font-mono">
                                  {m.siteId}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFromBatch(m.assetCode)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors min-h-[32px] min-w-[32px] inline-flex items-center justify-center cursor-pointer"
                                  title="Hapus dari daftar"
                                  aria-label={`Hapus mesin ${m.assetCode} dari daftar`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
                    {selectedBatchMachines.map((m, idx) => {
                      const isRecent = recentlyAddedCode === m.assetCode;
                      return (
                        <div
                          key={m.assetCode}
                          className={`p-3 text-xs flex items-center justify-between gap-2 transition-colors ${
                            isRecent
                              ? 'bg-emerald-50/80 dark:bg-emerald-950/50'
                              : 'bg-white dark:bg-slate-800'
                          }`}
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] text-slate-400">
                                #{selectedBatchMachines.length - idx}
                              </span>
                              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                {m.assetCode}
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">
                                {m.siteId}
                              </span>
                            </div>
                            <div className="text-slate-700 dark:text-slate-300 font-semibold truncate">
                              {getMachineLabel(m).primary}
                            </div>
                            {getMachineLabel(m).secondary && (
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                {getMachineLabel(m).secondary}
                              </div>
                            )}
                            <div className="text-[11px] text-slate-500 font-mono">
                              Lokasi: {m.locationId}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveFromBatch(m.assetCode)}
                            className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-xl min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
                            aria-label={`Hapus mesin ${m.assetCode}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Optional Logistics Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label htmlFor="vehicle-no-input" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nomor Kendaraan / Truk (Opsional):
                </label>
                <input
                  id="vehicle-no-input"
                  type="text"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  placeholder="Contoh: B 1234 XYZ"
                  className="w-full bg-slate-50 dark:bg-slate-900 hover:bg-white focus:bg-white dark:hover:bg-slate-800 dark:focus:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white focus:border-emerald-500 min-h-[40px]"
                  aria-label="Nomor kendaraan truk"
                />
              </div>

              <div>
                <label htmlFor="driver-name-input" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Sopir (Opsional):
                </label>
                <input
                  id="driver-name-input"
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Contoh: Pak Joko"
                  className="w-full bg-slate-50 dark:bg-slate-900 hover:bg-white focus:bg-white dark:hover:bg-slate-800 dark:focus:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white focus:border-emerald-500 min-h-[40px]"
                  aria-label="Nama sopir pengantar"
                />
              </div>
            </div>

            <div>
              <label htmlFor="transfer-note-input" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Catatan / Alasan Transfer (Opsional):
              </label>
              <input
                id="transfer-note-input"
                type="text"
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                placeholder="Contoh: Pemenuhan kapasitas order export site tujuan"
                className="w-full bg-slate-50 dark:bg-slate-900 hover:bg-white focus:bg-white dark:hover:bg-slate-800 dark:focus:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:border-emerald-500 placeholder:text-slate-400 min-h-[40px]"
                aria-label="Catatan atau alasan transfer"
              />
            </div>

            {/* 5) SUBMIT BUTTON */}
            <form onSubmit={handleSendTransfer}>
              <button
                type="submit"
                disabled={isSending || selectedBatchMachines.length === 0}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl text-sm font-extrabold shadow-sm flex items-center justify-center gap-2 transition-transform active:scale-98 min-h-[48px] cursor-pointer"
                aria-label={`Kirim ${selectedBatchMachines.length} mesin ke site ${selectedToSite}`}
              >
                <Send className="w-4 h-4" />
                <span>
                  {isSending
                    ? 'Sedang Mengirim ke Server...'
                    : `Kirim ${selectedBatchMachines.length} Mesin ke ${selectedToSite} (Kunci In Transit)`}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* RECEIVE DESTINATION MODAL */}
      {receivingTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Terima Mesin di Site {receivingTransfer.toSite}</span>
            </h3>

            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs space-y-1">
              <div>
                Kode Aset: <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{receivingTransfer.assetCode}</span>
              </div>
              <div>
                Dikirim dari: <span className="font-bold text-amber-700 dark:text-amber-400">{receivingTransfer.fromSite}</span>
              </div>
            </div>

            <div>
              <label htmlFor="receive-location-select" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Pilih Lokasi Penempatan di Site {receivingTransfer.toSite} *:
              </label>
              <select
                id="receive-location-select"
                value={receiveTargetLocationId}
                onChange={(e) => setReceiveTargetLocationId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white font-mono focus:border-emerald-500 min-h-[40px]"
                aria-label="Pilih lokasi penempatan mesin yang diterima"
              >
                <option value="">-- Pilih Lokasi Tujuan --</option>
                {destinationLocations.map((loc) => (
                  <option key={loc.locationId} value={loc.locationId}>
                    {loc.locationId} ({loc.displayName})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReceivingTransfer(null)}
                disabled={isReceiving}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 min-h-[40px] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReceive}
                disabled={!receiveTargetLocationId || isReceiving}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-colors min-h-[40px] cursor-pointer"
              >
                {isReceiving ? 'Menyimpan di Server...' : 'Konfirmasi Diterima'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
