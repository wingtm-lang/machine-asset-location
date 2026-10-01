import React, { useState, useEffect, useCallback } from 'react';
import {
  WH2_RACKS,
  RackConfig,
  RackSlotItem,
  rackMapService,
} from '../services/rackMapService';
import { getGasBaseUrl } from '../services/gasAuthService';
import { RoomMap } from '../components/rackmap/RoomMap';
import { RackDetail, SelectedColumnCoord } from '../components/rackmap/RackDetail';
import { SlotPanel } from '../components/rackmap/SlotPanel';
import { useAuth } from '../services/authContext';
import {
  RotateCcw,
  Boxes,
  CheckCircle2,
  AlertCircle,
  X,
  QrCode,
} from 'lucide-react';

interface RackMapViewProps {
  onOpenScanner?: () => void;
}

interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'warning';
  text: string;
}

export const RackMapView: React.FC<RackMapViewProps> = ({ onOpenScanner }) => {
  const { currentUser } = useAuth();

  // State
  const [selectedRack, setSelectedRack] = useState<RackConfig>(WH2_RACKS[3]); // Default: R4
  const [selectedCoord, setSelectedCoord] = useState<SelectedColumnCoord | null>({
    level: 'B',
    column: 12,
  }); // Default selected column R4-B12
  const [slots, setSlots] = useState<RackSlotItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const gasUrl = getGasBaseUrl();

  // Toast notification helper
  const showToast = useCallback((type: 'success' | 'error' | 'warning', text: string) => {
    const id = Date.now();
    setToast({ id, type, text });
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast((current) => (current?.id === toast.id ? null : current));
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Load Rack Map from GAS / Local
  const fetchMapData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await rackMapService.getRackMap();
      if (res.success && Array.isArray(res.slots)) {
        setSlots(res.slots);
      } else {
        showToast('error', res.message || 'Gagal memuat peta slot rak');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Gagal terhubung ke layanan GAS');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchMapData();
  }, [fetchMapData]);

  // Total capacity across all 6 racks: 144 columns x 3 levels x 3 slots = 1296 slots
  const totalCapacity = WH2_RACKS.reduce((acc, r) => acc + r.n * 3 * 3, 0);
  const totalFilled = slots.length;
  const occupancyPercent = totalCapacity > 0 ? (totalFilled / totalCapacity) * 100 : 0;

  return (
    <div className="space-y-4 font-sans text-slate-800 dark:text-slate-100 max-w-7xl mx-auto">
      {/* 2) HEADER RINGKAS (Tinggi ~56px / h-14, Satu Baris Tipis) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl px-4 sm:px-5 h-14 flex items-center justify-between shadow-xs">
        {/* Kiri: Judul "WH2 Rack Map" + Titik Status Kecil */}
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            WH2 Rack Map
          </h1>
          <div
            className="group relative flex items-center cursor-help"
            title={
              gasUrl
                ? `Status: Terhubung ke GAS Web App\n${gasUrl}\nFormat Lokasi: WH2-R[1-6]-[A-C][kolom]-S[1-3]`
                : `Status: Menggunakan Sinkronisasi Lokal (Offline)\nFormat Lokasi: WH2-R[1-6]-[A-C][kolom]-S[1-3]`
            }
          >
            <span
              className={`w-2.5 h-2.5 rounded-full transition-transform group-hover:scale-125 ${
                gasUrl ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50' : 'bg-amber-500'
              }`}
            />
          </div>
        </div>

        {/* Kanan: Chip Progres + Tombol Segarkan + Tombol Scan */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Chip Progres Keterisian */}
          <div className="flex items-center gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs">
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300 text-[11px] sm:text-xs">
              {totalFilled.toLocaleString('id-ID')} / {totalCapacity.toLocaleString('id-ID')}
            </span>
            <div className="w-12 sm:w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-indigo-600 dark:bg-indigo-400 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, occupancyPercent)}%` }}
              />
            </div>
          </div>

          {/* Tombol Ikon Segarkan (Ikon Saja) */}
          <button
            type="button"
            disabled={isLoading}
            onClick={fetchMapData}
            className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 transition-colors cursor-pointer"
            title="Segarkan data rack map"
            aria-label="Segarkan data"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>

          {/* Tombol Utama Scan (Ikon + Teks) */}
          {onOpenScanner && (
            <button
              type="button"
              onClick={onOpenScanner}
              className="px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Scan</span>
            </button>
          )}
        </div>
      </div>

      {/* 5) TATA LETAK TANPA SCROLL PANJANG (Desktop: 2 Kolom, Mobile: Bottom Sheet) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Kolom Kiri: Denah di atas, Detail Rak di bawahnya */}
        <div className="lg:col-span-8 space-y-4">
          {/* TAMPILAN 1: DENAH RUANGAN WH2 */}
          <RoomMap
            selectedRack={selectedRack}
            onSelectRack={(rack) => {
              setSelectedRack(rack);
              setSelectedCoord(null);
            }}
            slots={slots}
          />

          {/* TAMPILAN 2: DETAIL RAK TERPILIH */}
          {selectedRack && (
            <RackDetail
              rack={selectedRack}
              selectedCoord={selectedCoord}
              onSelectColumn={(coord) => setSelectedCoord(coord)}
              slots={slots}
            />
          )}
        </div>

        {/* Kolom Kanan: Desktop Drawer Sidebar Tetap */}
        <div className="hidden lg:block lg:col-span-4 sticky top-4">
          {selectedRack && selectedCoord ? (
            <SlotPanel
              rack={selectedRack}
              coord={selectedCoord}
              slots={slots}
              byUser={currentUser?.displayName || currentUser?.username || 'User'}
              onRefresh={fetchMapData}
              onClose={() => setSelectedCoord(null)}
              onNotifyToast={showToast}
              onOpenScanner={onOpenScanner}
            />
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 text-center flex flex-col items-center justify-center min-h-[280px] text-slate-400 dark:text-slate-500 space-y-2.5 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-indigo-500/70">
                <Boxes className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-[210px] leading-relaxed">
                Pilih salah satu kotak kolom pada rak untuk melihat & mengelola 3 slot aset.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Drawer (Bottom Sheet Naik dari Bawah Layar, Maks 70% Layar) */}
      {selectedRack && selectedCoord && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="flex-1" onClick={() => setSelectedCoord(null)} />
          <div className="bg-white dark:bg-slate-900 rounded-t-2xl max-h-[72vh] overflow-y-auto shadow-2xl border-t border-slate-200 dark:border-slate-800 p-4 animate-in slide-in-from-bottom duration-200">
            {/* Handle Bar */}
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-3" />
            <SlotPanel
              rack={selectedRack}
              coord={selectedCoord}
              slots={slots}
              byUser={currentUser?.displayName || currentUser?.username || 'User'}
              onRefresh={fetchMapData}
              onClose={() => setSelectedCoord(null)}
              onNotifyToast={showToast}
              onOpenScanner={onOpenScanner}
            />
          </div>
        </div>
      )}

      {/* 8) TOAST NOTIFIKASI KECIL DI POJOK (Bukan Blok Pesan di Halaman) */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
          <div
            className={`px-3.5 py-2.5 rounded-xl shadow-lg border text-xs font-medium flex items-center gap-2.5 max-w-sm ${
              toast.type === 'success'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-700 dark:border-slate-300'
                : toast.type === 'warning'
                ? 'bg-amber-900 text-amber-50 border-amber-700'
                : 'bg-rose-900 text-rose-50 border-rose-700'
            }`}
          >
            {toast.type === 'success' && (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 dark:text-emerald-600" />
            )}
            {toast.type === 'warning' && (
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-300" />
            )}
            {toast.type === 'error' && (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-300" />
            )}
            <span className="flex-1 leading-snug">{toast.text}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="opacity-60 hover:opacity-100 p-0.5"
              aria-label="Tutup notifikasi"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RackMapView;
