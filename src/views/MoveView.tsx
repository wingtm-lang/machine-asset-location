import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Building,
  ArrowRight,
  Clock,
  User,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../services/authContext';
import { getTranslation } from '../services/translations';
import { storageService } from '../services/storage';
import { soundService } from '../services/sound';
import { Machine, MachineStatus, Location } from '../types';

interface MoveViewProps {
  initialMachine?: Machine | null;
  batchMachines?: Machine[];
  onSuccessDone: () => void;
}

export const MoveView: React.FC<MoveViewProps> = ({
  initialMachine,
  batchMachines,
  onSuccessDone,
}) => {
  const { currentUser, language, canAccessSite } = useAuth();

  // Active machines to move (either batch or single)
  const machinesToMove: Machine[] = useMemo(() => {
    if (batchMachines && batchMachines.length > 0) return batchMachines;
    if (initialMachine) return [initialMachine];
    return [];
  }, [batchMachines, initialMachine]);

  const currentSite = machinesToMove.length > 0 ? machinesToMove[0].siteId : 'PW1';
  const hasAccess = canAccessSite(currentSite);

  // Form states
  const [targetLocationId, setTargetLocationId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<MachineStatus | 'KEEP'>('KEEP');
  const [loanTo, setLoanTo] = useState<string>('');
  const [loanDueDate, setLoanDueDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [undoingAsset, setUndoingAsset] = useState<string | null>(null);

  // Available locations for current site
  const availableLocations = useMemo(() => {
    return storageService.getLocations(currentSite).filter((l) => l.active);
  }, [currentSite]);

  // Last movements by this user for Undo (A5.5)
  const [recentMovements, setRecentMovements] = useState(storageService.getMovements());

  const refreshMovements = () => {
    setRecentMovements(storageService.getMovements());
  };

  const undoTimeLimitMinutes = storageService.getSettings().undoTimeLimitMinutes || 60;

  // WH2 slot occupancy checker
  const selectedTargetLoc = availableLocations.find((l) => l.locationId === targetLocationId);
  const slotOccupancy = useMemo(() => {
    if (!selectedTargetLoc || selectedTargetLoc.type !== 'RACK_SLOT') return null;
    const existing = storageService.getMachinesAtLocation(selectedTargetLoc.locationId);
    return {
      current: existing.length,
      limit: selectedTargetLoc.capacity || 3,
      isFull: existing.length >= (selectedTargetLoc.capacity || 3),
      machines: existing,
    };
  }, [selectedTargetLoc]);

  const handleExecuteMove = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (machinesToMove.length === 0) {
      setFeedback({ type: 'error', message: 'Tidak ada mesin yang dipilih untuk dipindahkan.' });
      return;
    }

    const effectiveTargetLoc = selectedStatus === 'SOLD' ? (targetLocationId.trim() || 'SOLD') : targetLocationId.trim();

    if (!effectiveTargetLoc) {
      setFeedback({ type: 'error', message: 'Silakan pilih lokasi tujuan.' });
      return;
    }

    if (!currentUser || isSubmitting) return;

    if (selectedStatus === 'LOANED' && (!loanTo.trim() || !loanDueDate.trim())) {
      setFeedback({ type: 'error', message: 'Status LOANED wajib mengisi peminjam (Loan To) dan batas waktu (Due Date).' });
      return;
    }

    setIsSubmitting(true);
    let successCount = 0;
    let lastError = '';

    try {
      for (const m of machinesToMove) {
        const res = await storageService.moveMachine({
          assetCode: m.assetCode,
          targetLocationId: effectiveTargetLoc,
          username: currentUser.username,
          userSiteAccess: currentUser.siteAccess,
          reason,
          newStatus: selectedStatus !== 'KEEP' ? selectedStatus : undefined,
          loanTo: selectedStatus === 'LOANED' ? loanTo : undefined,
          loanDueDate: selectedStatus === 'LOANED' ? loanDueDate : undefined,
        });

        if (res.success) {
          successCount++;
        } else {
          lastError = res.message;
        }
      }

      if (successCount > 0) {
        soundService.playSuccess();
        setFeedback({
          type: 'success',
          message: selectedStatus === 'SOLD'
            ? `Sukses memperbarui ${successCount} mesin menjadi status SOLD (Terjual/Keluar Pabrik)!`
            : `Sukses memindahkan ${successCount} mesin ke ${effectiveTargetLoc}!`,
        });
        refreshMovements();
        setTimeout(() => {
          onSuccessDone();
        }, 1200);
      } else {
        soundService.playError();
        setFeedback({ type: 'error', message: lastError || 'Gagal memindahkan mesin.' });
      }
    } catch (err: any) {
      soundService.playError();
      setFeedback({ type: 'error', message: err.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUndo = async (assetCode: string) => {
    if (!currentUser || undoingAsset) return;
    setUndoingAsset(assetCode);
    try {
      const res = await storageService.undoLastMove({
        assetCode,
        username: currentUser.username,
        isAdmin: currentUser.role === 'Admin',
      });

      if (res.success) {
        soundService.playSuccess();
        setFeedback({ type: 'success', message: res.message });
        refreshMovements();
      } else {
        soundService.playError();
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      soundService.playError();
      setFeedback({ type: 'error', message: err.message || 'Gagal membatalkan pemindahan.' });
    } finally {
      setUndoingAsset(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <h1 className="text-lg sm:text-xl font-black text-slate-900">
            {getTranslation('move', language)} ({currentSite})
          </h1>
        </div>
        <p className="text-xs text-slate-500">
          Pindahkan mesin ke Line, Line Extra, Gudang, atau Slot Rak WH2 (Kapasitas maks 3 mesin per slot).
        </p>
      </div>

      {/* Permission Check Notice */}
      {!hasAccess && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-800 text-xs shadow-sm">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>{getTranslation('no_site_access_error', language)} (Site: {currentSite})</div>
        </div>
      )}

      {/* Main Move Form */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-6">
        {/* Selected Machines List */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
            <span>Mesin yang akan dipindahkan ({machinesToMove.length}):</span>
            <span className="text-[11px] text-slate-500 font-mono">Site: {currentSite}</span>
          </div>

          {machinesToMove.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
              Pilih mesin dari menu "Daftar Mesin" atau gunakan fitur Scan Barcode.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {machinesToMove.map((m) => (
                <div
                  key={m.assetCode}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5 truncate">
                    <div className="font-mono font-bold text-emerald-700">{m.assetCode}</div>
                    <div className="font-semibold text-slate-900 truncate">{m.standardMachineName}</div>
                    <div className="text-[11px] text-slate-500">
                      Lokasi Asal: <span className="font-mono font-bold text-amber-700">{m.locationId}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {m.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleExecuteMove} className="space-y-5 pt-4 border-t border-slate-100">
          {/* Status Change Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                {getTranslation('change_status_optional', language)}:
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as MachineStatus | 'KEEP')}
                className={`w-full bg-slate-50 hover:bg-white focus:bg-white border rounded-xl px-3 py-2 text-xs text-slate-900 ${
                  selectedStatus === 'SOLD'
                    ? 'border-emerald-500 ring-1 ring-emerald-500/50'
                    : 'border-slate-200'
                }`}
              >
                <option value="KEEP">-- Tetap (Tidak Mengubah Status) --</option>
                <option value="ACTIVE">ACTIVE (Aktif)</option>
                <option value="IN_REPAIR">IN_REPAIR (Sedang Diperbaiki)</option>
                <option value="BROKEN">BROKEN (Rusak)</option>
                <option value="LOANED">LOANED (Dipinjamkan)</option>
                <option value="SOLD">SOLD (Dijual/Afkir)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                {selectedStatus === 'SOLD' ? 'Catatan Penjualan / Pembeli (Opsional):' : `${getTranslation('reason', language)}:`}
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={selectedStatus === 'SOLD' ? 'Contoh: Dijual ke PT Subkon Jaya, No Faktur #123' : 'Contoh: Penyesuaian layout line order kemeja...'}
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Banner Khusus Status SOLD */}
          {selectedStatus === 'SOLD' && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-1 animate-in fade-in">
              <div className="flex items-center gap-2 text-emerald-800 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Status SOLD Terpilih — Tidak Perlu Memilih Lokasi di Site</span>
              </div>
              <p className="text-slate-600 text-[11px]">
                Mesin telah terjual atau dikeluarkan dari operasional pabrik. Lokasi mesin akan otomatis dicatat sebagai <strong className="font-mono text-emerald-700">SOLD</strong> tanpa memerlukan pemilihan rak atau line.
              </p>
            </div>
          )}

          {/* Destination Location Dropdown (Disembunyikan / Opsional jika SOLD) */}
          {selectedStatus !== 'SOLD' ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  {getTranslation('select_dest_location', language)} di Site {currentSite}:
                </label>
                <select
                  value={targetLocationId}
                  onChange={(e) => setTargetLocationId(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-slate-900 font-mono shadow-xs"
                >
                  <option value="">-- Pilih Lokasi Tujuan --</option>
                  {availableLocations.map((loc) => (
                    <option key={loc.locationId} value={loc.locationId}>
                      {loc.locationId} ({loc.displayName}) - {loc.type}
                    </option>
                  ))}
                </select>
              </div>

              {/* WH2 Slot Capacity Live Indicator (A5.1 & A2) */}
              {slotOccupancy && (
                <div
                  className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                    slotOccupancy.isFull
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>Kapasitas Slot Rak WH2:</span>
                    <span className="font-mono">
                      {slotOccupancy.current} / {slotOccupancy.limit} Mesin
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        slotOccupancy.isFull ? 'bg-rose-500' : 'bg-emerald-600'
                      }`}
                      style={{ width: `${Math.min((slotOccupancy.current / slotOccupancy.limit) * 100, 100)}%` }}
                    />
                  </div>
                  {slotOccupancy.isFull && (
                    <div className="text-[11px] font-bold text-rose-700">
                      {getTranslation('slot_full_error', language)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-600">Lokasi Tujuan:</span>
              <span className="font-mono font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-200">
                Otomatis Diset: SOLD
              </span>
            </div>
          )}

          {/* Loan Details (Required if LOANED as per A5.3) */}
          {selectedStatus === 'LOANED' && (
            <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-purple-900 font-semibold mb-1">
                  Peminjam (Loan To) *:
                </label>
                <input
                  type="text"
                  value={loanTo}
                  onChange={(e) => setLoanTo(e.target.value)}
                  placeholder="Nama subkontraktor / pabrik lain"
                  className="w-full bg-white border border-purple-200 rounded-lg px-3 py-1.5 text-slate-900"
                  required
                />
              </div>
              <div>
                <label className="block text-purple-900 font-semibold mb-1">
                  Batas Waktu Pinjam (Due Date) *:
                </label>
                <input
                  type="date"
                  value={loanDueDate}
                  onChange={(e) => setLoanDueDate(e.target.value)}
                  className="w-full bg-white border border-purple-200 rounded-lg px-3 py-1.5 text-slate-900"
                  required
                />
              </div>
            </div>
          )}

          {/* Feedback alert */}
          {feedback && (
            <div
              className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 ${
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !hasAccess || machinesToMove.length === 0 || (selectedStatus !== 'SOLD' && (slotOccupancy?.isFull ?? false))}
            className={`w-full py-3 text-white rounded-xl text-sm font-extrabold shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:scale-[1.01] ${
              selectedStatus === 'SOLD'
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-emerald-700 hover:bg-emerald-600'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Sedang Menyimpan ke Server...'
                : selectedStatus === 'SOLD'
                ? `Konfirmasi Status SOLD (${machinesToMove.length} Mesin)`
                : `Simpan Pemindahan (${machinesToMove.length} Mesin)`}
            </span>
          </button>
        </form>
      </div>

      {/* UNDO SECTION (A5.5 - Available within 60 minutes) */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-amber-600" />
            <h3 className="font-bold text-sm text-slate-900">
              {getTranslation('undo_last_move', language)}
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            {getTranslation('undo_available_within', language)} ({undoTimeLimitMinutes} menit)
          </span>
        </div>

        <div className="space-y-2">
          {recentMovements
            .filter((m) => {
              if (m.type !== 'MOVE') return false;
              const moveTime = new Date(m.timestamp).getTime();
              const diffMin = (Date.now() - moveTime) / (1000 * 60);
              return diffMin <= undoTimeLimitMinutes;
            })
            .slice(0, 5)
            .map((mov) => (
              <div
                key={mov.movementId}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-700">{mov.assetCode}</span>
                    <span className="text-slate-600">
                      {mov.fromLocation} → <span className="text-emerald-700 font-bold">{mov.toLocation}</span>
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Oleh: {mov.byUser} • {new Date(mov.timestamp).toLocaleTimeString('id-ID')}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleUndo(mov.assetCode)}
                  disabled={undoingAsset === mov.assetCode}
                  className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 disabled:opacity-50 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1 self-start sm:self-auto transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{undoingAsset === mov.assetCode ? 'Membatalkan...' : 'Undo Pemindahan'}</span>
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
