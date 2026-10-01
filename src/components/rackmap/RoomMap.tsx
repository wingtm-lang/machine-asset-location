import React from 'react';
import { WH2_RACKS, RackConfig, RackSlotItem } from '../../services/rackMapService';

interface RoomMapProps {
  selectedRack: RackConfig | null;
  onSelectRack: (rack: RackConfig) => void;
  slots: RackSlotItem[];
}

export const RoomMap: React.FC<RoomMapProps> = ({
  selectedRack,
  onSelectRack,
  slots,
}) => {
  // Hitung jumlah slot terisi per rak
  const getRackFilledCount = (rackId: string): number => {
    return slots.filter((s) => s.rak === rackId).length;
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xs">
      <div className="overflow-x-auto pb-0.5">
        <div
          className="relative w-full min-w-[620px] rounded-xl overflow-hidden border border-slate-200/70 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/50 select-none"
          style={{
            aspectRatio: '4 / 1',
            backgroundImage:
              'radial-gradient(circle, rgba(148, 163, 184, 0.25) 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        >
          {/* Watermark MECHANIC di area kiri bawah R4 */}
          <div
            className="absolute font-black tracking-widest text-slate-400/25 dark:text-slate-600/25 select-none pointer-events-none"
            style={{
              left: '4%',
              top: '52%',
              fontSize: 'clamp(14px, 2.2vw, 24px)',
              letterSpacing: '0.15em',
            }}
          >
            MECHANIC
          </div>

          {/* 6 Rak Gudang WH2 (Proporsi 4:1, Lebar Penuh Tanpa Acrylic Room) */}
          {WH2_RACKS.map((rack) => {
            const isSelected = selectedRack?.id === rack.id;
            const filledCount = getRackFilledCount(rack.id);
            const totalCapacity = rack.n * 3 * 3; // kolom x 3 tingkat x 3 slot
            const fillRatio = totalCapacity > 0 ? filledCount / totalCapacity : 0;
            const fillPercent = Math.min(100, Math.round(fillRatio * 100));

            // Warna fill makin pekat sesuai tingkat keterisian
            const fillOpacity = 0.18 + fillRatio * 0.45;

            return (
              <button
                key={rack.id}
                type="button"
                onClick={() => onSelectRack(rack)}
                className={`absolute rounded-[10px] flex flex-col items-center justify-center cursor-pointer transition-all duration-200 overflow-hidden border ${
                  isSelected
                    ? 'ring-2 ring-indigo-500 shadow-md shadow-indigo-500/20 border-indigo-400 dark:border-indigo-500 z-10 -translate-y-0.5'
                    : 'border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 hover:-translate-y-0.5 hover:shadow-sm bg-white/90 dark:bg-slate-900/90'
                }`}
                style={{
                  left: `${rack.l}%`,
                  top: `${rack.t}%`,
                  width: `${rack.w}%`,
                  height: `${rack.h}%`,
                }}
                title={`Rak ${rack.id}: ${filledCount}/${totalCapacity} terisi (${fillPercent}%)`}
              >
                {/* Visual isian warna dari bawah (progress fill) */}
                <div
                  className="absolute bottom-0 left-0 right-0 pointer-events-none transition-all duration-300 ease-out"
                  style={{
                    height: `${fillPercent}%`,
                    backgroundColor:
                      fillPercent > 0
                        ? `rgba(79, 70, 229, ${fillOpacity})`
                        : 'rgba(241, 245, 249, 0.4)',
                  }}
                />

                {/* Konten Rak: Kode Rak & Angka Keterisian */}
                <div className="relative z-10 flex flex-col items-center justify-center leading-none pointer-events-none select-none px-1">
                  <span
                    className={`font-black tracking-tight ${
                      isSelected
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-800 dark:text-slate-100'
                    }`}
                    style={{ fontSize: 'clamp(12px, 1.25vw, 15px)' }}
                  >
                    {rack.id}
                  </span>
                  <span
                    className="font-mono font-medium text-slate-500 dark:text-slate-400 mt-0.5"
                    style={{ fontSize: 'clamp(9px, 0.85vw, 11px)' }}
                  >
                    {filledCount}/{totalCapacity}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
