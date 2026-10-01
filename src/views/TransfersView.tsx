import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../services/authContext';
import { getTranslation } from '../services/translations';
import { storageService } from '../services/storage';
import { soundService } from '../services/sound';
import { Machine, Transfer, SiteId } from '../types';

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

  const [activeTab, setActiveTab] = useState<'inbound' | 'outbound' | 'send_new'>('inbound');
  const [selectedToSite, setSelectedToSite] = useState<string>('PW2');
  const [sendAssetCodesInput, setSendAssetCodesInput] = useState<string>(
    batchMachines && batchMachines.length > 0 ? batchMachines.map((m) => m.assetCode).join(', ') : ''
  );
  const [vehicleNo, setVehicleNo] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');
  const [transferNote, setTransferNote] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Receive Modal states
  const [receivingTransfer, setReceivingTransfer] = useState<Transfer | null>(null);
  const [receiveTargetLocationId, setReceiveTargetLocationId] = useState<string>('');

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  // Available destination locations when receiving
  const destinationLocations = useMemo(() => {
    if (!receivingTransfer) return [];
    return storageService.getLocations(receivingTransfer.toSite).filter((l) => l.active);
  }, [receivingTransfer]);

  // Handle Send Transfer (Step 1)
  const handleSendTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!currentUser || isSending) return;

    const codes = sendAssetCodesInput
      .split(/[\s,;\n]+/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (codes.length === 0) {
      setFeedback({ type: 'error', message: 'Masukkan setidaknya satu Kode Aset atau Barcode.' });
      return;
    }

    setIsSending(true);
    try {
      const res = await storageService.sendTransfer({
        assetCodes: codes,
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
        setSendAssetCodesInput('');
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
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
            <ArrowRightLeft className="w-4 h-4" />
          </div>
          <h1 className="text-lg sm:text-xl font-black text-slate-900">
            {getTranslation('transfers', language)} (Alur 2 Langkah)
          </h1>
        </div>
        <p className="text-xs text-slate-500">
          Proses transfer antar pabrik: (1) Pengirim mengirim & mengunci mesin (In Transit), (2) Penerima mengonfirmasi penerimaan & memilih lokasi tujuan.
        </p>
      </div>

      {/* Tabs Switcher */}
      <div className="flex gap-2 p-1.5 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
        <button
          onClick={() => setActiveTab('inbound')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'inbound'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>Menunggu Diterima ({inboundTransfers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('outbound')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'outbound'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Transfer Terkirim</span>
        </button>

        <button
          onClick={() => setActiveTab('send_new')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'send_new'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>Kirim Transfer Baru</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center gap-2.5 shadow-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* TAB 1: INBOUND TRANSFERS (PENDING RECEIPT) */}
      {activeTab === 'inbound' && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-700" />
              <span>Daftar Mesin yang Sedang Dikirim Menuju Site Anda</span>
            </h2>
            <span className="text-xs text-slate-500">{inboundTransfers.length} transfer</span>
          </div>

          {inboundTransfers.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs rounded-2xl bg-slate-50 border border-slate-200">
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
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-emerald-700 text-sm">{t.assetCode}</span>
                        <span className="font-mono text-[10px] text-slate-400">({t.transferId})</span>
                        {isOverdue && (
                          <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>Terlambat &gt; {overdueDaysLimit} Hari</span>
                          </span>
                        )}
                      </div>

                      <div className="text-slate-700">
                        Dari Site: <span className="font-bold text-amber-700">{t.fromSite}</span> → Menuju Site:{' '}
                        <span className="font-bold text-emerald-700">{t.toSite}</span>
                      </div>

                      <div className="text-[11px] text-slate-500">
                        Dikirim oleh: <span className="text-slate-800 font-semibold">{t.sentBy}</span> pada{' '}
                        {new Date(t.sentAt).toLocaleString('id-ID')}
                      </div>

                      {t.note && <div className="text-[11px] text-slate-600 italic">Catatan: {t.note}</div>}
                    </div>

                    <button
                      onClick={() => {
                        setReceivingTransfer(t);
                        setReceiveTargetLocationId('');
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 self-start sm:self-auto transition-transform active:scale-95"
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
        <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Send className="w-4 h-4 text-emerald-700" />
            <span>Riwayat Transfer Keluar dari Site Anda</span>
          </h2>

          <div className="space-y-3">
            {outboundTransfers.map((t) => (
              <div
                key={t.transferId}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-700 text-sm">{t.assetCode}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        t.status === 'IN_TRANSIT'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : t.status === 'RECEIVED'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>

                  <div className="text-slate-700">
                    Dari: <span className="font-bold text-amber-700">{t.fromSite}</span> → Ke:{' '}
                    <span className="font-bold text-emerald-700">{t.toSite}</span>
                  </div>

                  <div className="text-[11px] text-slate-500">
                    Dikirim: {new Date(t.sentAt).toLocaleString('id-ID')} ({t.sentBy})
                    {t.receivedAt && (
                      <span> • Diterima: {new Date(t.receivedAt).toLocaleString('id-ID')} ({t.receivedBy})</span>
                    )}
                  </div>
                </div>

                {t.status === 'IN_TRANSIT' && (
                  <button
                    onClick={() => handleCancelTransfer(t.transferId)}
                    disabled={cancellingId === t.transferId}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1 self-start sm:self-auto transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{cancellingId === t.transferId ? 'Membatalkan...' : getTranslation('cancel_transfer', language)}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: SEND NEW TRANSFER */}
      {activeTab === 'send_new' && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-6">
          <form onSubmit={handleSendTransfer} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kode Aset / Barcode Mesin (Bisa banyak, pisahkan spasi/koma):
              </label>
              <textarea
                value={sendAssetCodesInput}
                onChange={(e) => setSendAssetCodesInput(e.target.value)}
                placeholder="Contoh: IDN-8-2009-1396, IDN-9-2009-1397, 000000066145"
                rows={3}
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 font-mono focus:border-emerald-500 placeholder:text-slate-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {getTranslation('select_target_site', language)}:
              </label>
              <select
                value={selectedToSite}
                onChange={(e) => setSelectedToSite(e.target.value)}
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:border-emerald-500 font-bold"
              >
                {sites.map((s) => (
                  <option key={s.siteId} value={s.siteId}>
                    {s.siteId} - {s.name} ({s.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Kendaraan / Truk (Opsional):
                </label>
                <input
                  type="text"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  placeholder="Contoh: B 1234 XYZ"
                  className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Sopir (Opsional):
                </label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Contoh: Pak Joko"
                  className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan / Alasan Transfer (Opsional):
              </label>
              <input
                type="text"
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                placeholder="Contoh: Pemindahan sementara untuk pemenuhan kapasitas order export"
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:border-emerald-500 placeholder:text-slate-400"
              />
            </div>

            <button
              type="submit"
              disabled={isSending}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-extrabold shadow-sm flex items-center justify-center gap-2 transition-transform active:scale-95"
            >
              <Send className="w-4 h-4" />
              <span>{isSending ? 'Sedang Mengirim ke Server...' : 'Kirim Mesin (Kunci Status In Transit)'}</span>
            </button>
          </form>
        </div>
      )}

      {/* RECEIVE DESTINATION MODAL */}
      {receivingTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-2xl">
            <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <Download className="w-5 h-5 text-emerald-600" />
              <span>Terima Mesin di Site {receivingTransfer.toSite}</span>
            </h3>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <div>
                Kode Aset: <span className="font-mono font-bold text-emerald-700">{receivingTransfer.assetCode}</span>
              </div>
              <div>
                Dikirim dari: <span className="font-bold text-amber-700">{receivingTransfer.fromSite}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Pilih Lokasi Penempatan di Site {receivingTransfer.toSite} *:
              </label>
              <select
                value={receiveTargetLocationId}
                onChange={(e) => setReceiveTargetLocationId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 font-mono focus:border-emerald-500"
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
                onClick={() => setReceivingTransfer(null)}
                disabled={isReceiving}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmReceive}
                disabled={!receiveTargetLocationId || isReceiving}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-colors"
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
