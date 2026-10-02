import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  X,
  History,
  QrCode,
  Layers,
  ArrowRightLeft,
  Printer,
  Calendar,
  Building,
  Tag,
  ShieldCheck,
  User,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { Machine } from '../types';
import { getMachineLabel } from '../utils/machineName';
import { useAuth } from '../services/authContext';
import { getTranslation } from '../services/translations';
import { storageService } from '../services/storage';
import { gasAuthService, ServerMovementRecord } from '../services/gasAuthService';
import { Pagination } from './Pagination';

interface MachineDetailModalProps {
  machine: Machine | null;
  isOpen: boolean;
  onClose: () => void;
  onMoveClick?: (machine: Machine) => void;
}

export const MachineDetailModal: React.FC<MachineDetailModalProps> = ({
  machine,
  isOpen,
  onClose,
  onMoveClick,
}) => {
  const { language, canAccessSite, canPerformAction } = useAuth();
  const [activeTab, setActiveTab] = useState<'info' | 'movements' | 'status_log' | 'qr_card'>('info');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Server-side movement history states
  const [serverMovements, setServerMovements] = useState<ServerMovementRecord[]>([]);
  const [isLoadingMovements, setIsLoadingMovements] = useState<boolean>(false);
  const [movementsError, setMovementsError] = useState<string | null>(null);
  const [movementsPage, setMovementsPage] = useState<number>(1);

  const fetchMachineMovements = async (assetCode: string) => {
    setIsLoadingMovements(true);
    setMovementsError(null);
    setMovementsPage(1);
    try {
      const res = await gasAuthService.getMovements({ assetCode, limit: 100 });
      if (res.success && res.movements) {
        setServerMovements(res.movements);
      } else {
        setMovementsError(res.message || 'Gagal memuat riwayat mesin dari server.');
      }
    } catch (err: any) {
      setMovementsError(err.message || 'Terjadi kesalahan saat memuat riwayat.');
    } finally {
      setIsLoadingMovements(false);
    }
  };

  useEffect(() => {
    if (isOpen && machine && activeTab === 'movements') {
      setMovementsPage(1);
      fetchMachineMovements(machine.assetCode);
    }
  }, [isOpen, machine?.assetCode, activeTab]);

  // Generate authentic 2D QR Code from machine.barcode (not assetCode)
  useEffect(() => {
    if (machine) {
      // Ambil nilai barcode (pastikan string dan encode nilai Barcode)
      const barcodeValue = String(machine.barcode || '').trim();
      if (barcodeValue) {
        QRCode.toDataURL(
          barcodeValue,
          {
            errorCorrectionLevel: 'M',
            margin: 2,
            scale: 8,
            width: 260,
            color: {
              dark: '#000000',
              light: '#ffffff',
            },
          },
          (err, url) => {
            if (!err && url) {
              setQrDataUrl(url);
            }
          }
        );
      }
    }
  }, [machine]);

  if (!isOpen || !machine) return null;

  const nm = getMachineLabel(machine);
  const statusLogs = storageService.getStatusLogs(machine.assetCode);
  const transfers = storageService.getTransfers().filter((t) => t.assetCode === machine.assetCode);
  const hasSiteAccess = canAccessSite(machine.siteId);

  const handlePrintCard = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-3xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center font-bold font-mono">
              {machine.siteId}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-slate-900">
                  {nm.primary}
                </h3>
                <span
                  className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                    machine.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : machine.status === 'BROKEN'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : machine.status === 'IN_REPAIR'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : machine.status === 'LOANED'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {machine.status}
                </span>
              </div>
              {nm.secondary && (
                <div className="text-[11px] text-slate-500 font-medium">
                  {nm.secondary}
                </div>
              )}
              <p className="text-xs text-slate-500 font-mono">
                {machine.assetCode} • Barcode: {machine.barcode}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 pb-1 border-b border-slate-100 bg-slate-50/40 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('info')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'info'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Spesifikasi & Info</span>
          </button>

          <button
            onClick={() => setActiveTab('movements')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'movements'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>
              Riwayat Pemindahan {isLoadingMovements ? '(...)' : `(${serverMovements.length})`}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('status_log')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'status_log'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Log Status ({statusLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('qr_card')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'qr_card'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Label QR Code</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* TAB 1: INFO & SPECS */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              {/* Location & Ownership Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-emerald-700" />
                    <span>Lokasi & Site Mesin</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-200/80">
                      <span className="text-slate-500">Site Saat Ini:</span>
                      <span className="font-bold font-mono bg-emerald-100 px-2 py-0.5 rounded text-emerald-900 border border-emerald-200">
                        {machine.siteId}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/80">
                      <span className="text-slate-500">Lokasi ID:</span>
                      <span className="font-bold text-slate-900 font-mono">
                        {machine.locationId}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/80">
                      <span className="text-slate-500">Home Factory (Asal):</span>
                      <span className="font-medium text-slate-800">
                        {machine.homeFactory}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/80">
                      <span className="text-slate-500">Terakhir Dipindah:</span>
                      <span className="text-slate-800">
                        {machine.lastMovedAt ? new Date(machine.lastMovedAt).toLocaleString('id-ID') : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Oleh User:</span>
                      <span className="text-slate-800 font-mono">
                        {machine.lastMovedBy || '-'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span>Spesifikasi Teknis Mesin</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-200/80">
                      <span className="text-slate-500">Merk (Manufacturer):</span>
                      <span className="font-bold text-slate-900">{machine.manufacturer}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/80">
                      <span className="text-slate-500">Model:</span>
                      <span className="font-bold text-emerald-800 font-mono">{machine.model}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/80">
                      <span className="text-slate-500">Serial Number:</span>
                      <span className="font-mono text-slate-900 font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
                        {machine.serial}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/80">
                      <span className="text-slate-500">Nama Standar:</span>
                      <span className="text-slate-800 font-medium">{machine.standardMachineName}</span>
                    </div>
                    {machine.localName && (
                      <div className="flex justify-between py-1 border-b border-slate-200/80">
                        <span className="text-slate-500">Nama Lokal:</span>
                        <span className="text-slate-900 font-bold">{machine.localName}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 border-b border-slate-200/80">
                      <span className="text-slate-500">Nama Korea (Item):</span>
                      <span className="text-slate-800 font-medium">{machine.item || '-'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Tgl Perolehan:</span>
                      <span className="text-slate-800">{machine.acqDate || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status / Loan Details if Applicable */}
              {machine.status === 'LOANED' && (
                <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-xs space-y-2">
                  <div className="font-bold flex items-center gap-2 text-purple-900">
                    <User className="w-4 h-4 text-purple-700" />
                    <span>Informasi Peminjaman Mesin (Status: LOANED)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-purple-700">Dipinjamkan Kepada:</span>
                      <div className="font-bold text-purple-950">{machine.loanTo || '-'}</div>
                    </div>
                    <div>
                      <span className="text-purple-700">Batas Waktu Pengembalian:</span>
                      <div className="font-bold text-purple-950">{machine.loanDueDate || '-'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* In Transit Details */}
              {machine.pendingTransferId && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                  <div className="font-bold text-amber-950">Mesin Terkunci (Sedang In Transit)</div>
                  <p className="text-amber-800">
                    Transfer ID: <span className="font-mono font-bold">{machine.pendingTransferId}</span>.
                    Mesin tidak dapat dipindahkan atau diubah statusnya sebelum diterima di site tujuan.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MOVEMENTS HISTORY (SERVER API) */}
          {activeTab === 'movements' && (
            <div className="space-y-3">
              {isLoadingMovements ? (
                <div className="text-center py-10 space-y-2">
                  <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-500 font-mono">Memuat riwayat dari server...</p>
                </div>
              ) : movementsError ? (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-3">
                  <span>{movementsError}</span>
                  <button
                    type="button"
                    onClick={() => machine && fetchMachineMovements(machine.assetCode)}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer"
                  >
                    Coba Lagi
                  </button>
                </div>
              ) : serverMovements.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Belum ada catatan mutasi untuk mesin ini.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2.5">
                    {serverMovements
                      .slice((movementsPage - 1) * 25, movementsPage * 25)
                      .map((mov) => (
                        <div
                          key={mov.historyId || `${mov.assetCode}-${mov.timestamp}`}
                          className={`p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                            mov.isUndone ? 'opacity-60 bg-rose-50/30' : ''
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                  mov.status === 'ACTIVE'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : mov.status === 'BROKEN'
                                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {mov.status || 'MUTASI'}
                              </span>
                              {mov.isUndone && (
                                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 border border-rose-200">
                                  Dibatalkan
                                </span>
                              )}
                              <span className="font-mono text-slate-500 text-[11px]">
                                {mov.timestamp}
                              </span>
                            </div>
                            <div className="text-slate-900 font-medium">
                              <span className="text-slate-500">Dari: </span>
                              <span className="font-mono text-amber-800 font-bold">
                                {mov.fromSite ? `[${mov.fromSite}] ` : ''}
                                {mov.fromLocation || '-'}
                              </span>
                              <span className="text-slate-500"> → Menuju: </span>
                              <span className="font-mono text-emerald-800 font-bold">
                                {mov.toSite ? `[${mov.toSite}] ` : ''}
                                {mov.toLocation || '-'}
                              </span>
                            </div>
                            {mov.reason && <p className="text-[11px] text-slate-600 italic">{mov.reason}</p>}
                            {mov.notes && <p className="text-[10px] text-slate-500">{mov.notes}</p>}
                          </div>
                          <div className="text-right text-[11px] text-slate-500 shrink-0">
                            Oleh: <span className="font-bold text-slate-800">{mov.movedBy || 'Sistem'}</span>
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Pagination jika baris riwayat > 25 */}
                  {serverMovements.length > 25 && (
                    <Pagination
                      currentPage={movementsPage}
                      totalItems={serverMovements.length}
                      pageSize={25}
                      onPageChange={setMovementsPage}
                      itemLabel="mutasi"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: STATUS LOG */}
          {activeTab === 'status_log' && (
            <div className="space-y-3">
              {statusLogs.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Belum ada catatan perubahan status untuk mesin ini.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {statusLogs.map((log) => (
                    <div
                      key={log.logId}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-rose-700 line-through">{log.oldStatus}</span>
                          <span className="text-slate-400">→</span>
                          <span className="font-bold text-emerald-700">{log.newStatus}</span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {new Date(log.timestamp).toLocaleString('id-ID')}
                        </span>
                      </div>
                      {log.note && <p className="text-slate-700 text-[11px]">{log.note}</p>}
                      <div className="text-[10px] text-slate-500">Oleh user: {log.byUser}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: REAL 2D QR CODE ASSET LABEL CARD */}
          {activeTab === 'qr_card' && (
            <div className="flex flex-col items-center space-y-6">
              {/* Printable Physical Asset Badge */}
              <div
                id="printable-qr-card"
                className="w-80 bg-white text-slate-950 rounded-2xl p-5 border-2 border-slate-300 shadow-xl flex flex-col items-center text-center space-y-3 print:border-black print:shadow-none"
              >
                <div className="w-full flex items-center justify-between border-b pb-2 border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-sm tracking-wider text-emerald-700">PT.WINNERS</span>
                    <span className="text-[10px] font-bold text-slate-400">• TAG 2D QR</span>
                  </div>
                  <span className="text-[11px] font-extrabold bg-slate-900 text-white px-2 py-0.5 rounded font-mono">
                    {machine.homeFactory || machine.siteId}
                  </span>
                </div>

                {/* Real 2D QR Code Matrix Image (Encoded from machine.barcode) */}
                <div className="w-48 h-48 bg-white border-2 border-slate-900 p-2 rounded-xl flex items-center justify-center relative shadow-xs">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`2D QR Code (Barcode: ${machine.barcode})`}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-xs text-slate-400 font-mono animate-pulse">
                      Generating 2D QR...
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 w-full">
                  <div className="text-xs font-black uppercase text-slate-900 line-clamp-1">
                    {nm.primary}
                  </div>
                  {nm.secondary && (
                    <div className="text-[10px] text-slate-500 font-medium line-clamp-1">
                      {nm.secondary}
                    </div>
                  )}

                  {/* Asset Code Display */}
                  <div className="text-sm font-mono font-black text-emerald-800 tracking-wide">
                    {machine.assetCode}
                  </div>

                  {/* Barcode 12-Digit (Source of 2D QR Code) */}
                  <div className="bg-slate-50 rounded-lg py-1 px-2 border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      KODE BARCODE (DI-ENCODE KE QR):
                    </span>
                    <span className="text-xs font-mono font-black text-slate-900 tracking-wider">
                      {machine.barcode}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 font-mono">
                    SN: {machine.serial || '-'} • Model: {machine.model || '-'}
                  </div>
                </div>
              </div>

              {/* Action Buttons: Print & Download */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={handlePrintCard}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-transform hover:scale-105 active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Label QR Mesin</span>
                </button>

                {qrDataUrl && (
                  <a
                    href={qrDataUrl}
                    download={`QR_Barcode_${machine.barcode}.png`}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
                  >
                    <QrCode className="w-4 h-4 text-emerald-600" />
                    <span>Unduh PNG</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors"
          >
            Tutup
          </button>

          {hasSiteAccess && !machine.pendingTransferId && machine.status !== 'SOLD' && onMoveClick && (
            <button
              onClick={() => {
                onMoveClick(machine);
                onClose();
              }}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-transform hover:scale-105 active:scale-95"
            >
              <Layers className="w-4 h-4" />
              <span>{getTranslation('move', language)}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
