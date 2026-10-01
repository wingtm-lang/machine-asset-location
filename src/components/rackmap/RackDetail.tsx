import React, { useRef, useState, useEffect } from 'react';
import { RackConfig, RACK_LEVELS, RackSlotItem } from '../../services/rackMapService';

export interface SelectedColumnCoord {
  level: 'A' | 'B' | 'C' | string;
  column: number;
}

interface RackDetailProps {
  rack: RackConfig;
  selectedCoord: SelectedColumnCoord | null;
  onSelectColumn: (coord: SelectedColumnCoord) => void;
  slots: RackSlotItem[];
}

export const RackDetail: React.FC<RackDetailProps> = ({
  rack,
  selectedCoord,
  onSelectColumn,
  slots,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(800);

  // Monitor lebar kontainer untuk menentukan mode 1 baris atau pecah 2 baris pada layar sempit
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      if (el) {
        setContainerWidth(el.clientWidth);
      }
    };

    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0) {
            setContainerWidth(entry.contentRect.width);
          }
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    } else {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }
  }, []);

  // Filter slots untuk rak saat ini
  const rackSlots = slots.filter((s) => s.rak === rack.id);
  const totalCapacity = rack.n * 3 * 3;
  const filledCount = rackSlots.length;

  // Map koordinat slot: `${tingkat}-${kolom}` -> [slot1, slot2, slot3]
  const cellMap = new Map<string, (RackSlotItem | null)[]>();

  for (const s of rackSlots) {
    const key = `${s.tingkat}-${s.kolom}`;
    if (!cellMap.has(key)) {
      cellMap.set(key, [null, null, null]);
    }
    const arr = cellMap.get(key)!;
    const slotIdx = s.slot - 1;
    if (slotIdx >= 0 && slotIdx < 3) {
      arr[slotIdx] = s;
    }
  }

  // Perhitungan layout CSS Grid (Spesifikasi 2, 4, 5)
  const labelOffset = 36; // Lebar badge huruf tingkat di kiri (24px) + gap (12px)
  const availableGridWidth = Math.max(120, containerWidth - labelOffset - 8);

  const singleRowGap = rack.n > 28 ? 2 : 3;
  const estimatedSingleCellWidth =
    (availableGridWidth - (rack.n - 1) * singleRowGap) / rack.n;

  // Pecah deretan menjadi 2 baris sama panjang jika kotak < 16px di 1 baris (Point 4)
  const shouldSplit = rack.n > 12 && estimatedSingleCellWidth < 16;

  // Tentukan kolom per baris grid
  const midPoint = shouldSplit ? Math.ceil(rack.n / 2) : rack.n;
  const gridCols = midPoint;
  const gridGap = gridCols > 28 ? 2 : 3;

  // Estimasi lebar kotak aktual
  const actualCellWidth = (availableGridWidth - (gridCols - 1) * gridGap) / gridCols;
  const isTinyCell = actualCellWidth < 16;
  const hasGroupGap = actualCellWidth >= 16;

  // Helper untuk merender deretan tombol kolom pada range tertentu
  const renderColumnRange = (level: string, startCol: number, endCol: number) => {
    const colsInRow: number[] = [];
    for (let c = startCol; c <= endCol; c++) {
      colsInRow.push(c);
    }

    return (
      <div
        className="w-full"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
          gap: `${gridGap}px`,
        }}
      >
        {colsInRow.map((col) => {
          const isSelected =
            selectedCoord?.level === level && selectedCoord?.column === col;
          const isGroupEnd = col % 5 === 0 && col !== endCol;
          const key = `${level}-${col}`;
          const slotItems = cellMap.get(key) || [null, null, null];
          const filledSlotCount = slotItems.filter(Boolean).length;

          // Tooltip saat hover: "R4-B12 · 2/3 slot" beserta kode aset
          const assignedAssets = slotItems
            .map((item, i) =>
              item ? `Slot ${i + 1}: ${item.assetCode} (${item.name || 'Mesin'})` : null
            )
            .filter(Boolean);

          const tooltipLines = [
            `${rack.id}-${level}${col} · ${filledSlotCount}/3 slot`,
            ...assignedAssets,
          ];
          const tooltipText = tooltipLines.join('\n');

          // Blok warna jika < 16px (Point 3: kosong = abu pudar, sebagian = aksen lembut, penuh = aksen penuh)
          const tinyBg =
            filledSlotCount === 0
              ? 'bg-slate-200 dark:bg-slate-700/60'
              : filledSlotCount === 3
              ? 'bg-indigo-600 dark:bg-indigo-500'
              : 'bg-indigo-300 dark:bg-indigo-800/80';

          return (
            <button
              key={col}
              type="button"
              onClick={() => onSelectColumn({ level, column: col })}
              style={{
                aspectRatio: '1 / 1',
                width: '100%',
                maxWidth: '30px',
                minWidth: '0px',
                marginRight: hasGroupGap && isGroupEnd ? '4px' : undefined,
              }}
              className={`rounded-md transition-all duration-150 cursor-pointer relative select-none flex flex-col justify-between overflow-hidden ${
                isSelected
                  ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900 bg-indigo-50/70 dark:bg-indigo-950/50 shadow-xs z-10'
                  : isTinyCell
                  ? `${tinyBg} hover:opacity-90`
                  : 'bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-700/80'
              }`}
              title={tooltipText}
              aria-label={`Rak ${rack.id} Tingkat ${level} Kolom ${col}`}
            >
              {/* Garis 3 slot jika kotak >= 16px (Point 3) */}
              {!isTinyCell && (
                <div className="w-full h-full p-[2px] flex flex-col justify-between">
                  {[0, 1, 2].map((slotIdx) => {
                    const isFilled = Boolean(slotItems[slotIdx]);
                    return (
                      <span
                        key={slotIdx}
                        className={`w-full rounded-full transition-colors duration-150 ${
                          isFilled
                            ? 'bg-indigo-600 dark:bg-indigo-400'
                            : 'bg-slate-300 dark:bg-slate-600/70'
                        }`}
                        style={{ height: '22%' }}
                      />
                    );
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  // Helper untuk merender penomoran kolom
  const renderNumberRange = (startCol: number, endCol: number) => {
    const colsInRow: number[] = [];
    for (let c = startCol; c <= endCol; c++) {
      colsInRow.push(c);
    }

    return (
      <div
        className="w-full"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
          gap: `${gridGap}px`,
        }}
      >
        {colsInRow.map((col) => {
          const isGroupEnd = col % 5 === 0 && col !== endCol;
          const showNumber = col === 1 || col % 5 === 0 || col === startCol;

          return (
            <div
              key={col}
              style={{
                width: '100%',
                maxWidth: '30px',
                minWidth: '0px',
                marginRight: hasGroupGap && isGroupEnd ? '4px' : undefined,
              }}
              className="text-center select-none"
            >
              {showNumber ? (
                <span className="text-[9px] sm:text-[10px] font-mono text-slate-400 dark:text-slate-500 block text-center leading-none">
                  {col}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 w-full"
    >
      {/* Judul Satu Baris: "R4" besar + "26 kolom" redup + "0/234" di kanan */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Rak {rack.id}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
            {rack.n} kolom
          </span>
        </div>
        <div className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
          {filledCount}/{totalCapacity}
        </div>
      </div>

      {/* Grid 3 Tingkatan: C (atas), B (tengah), A (bawah) - TANPA SCROLLBAR HORIZONTAL */}
      <div className="w-full space-y-3">
        {RACK_LEVELS.map((level) => (
          <div key={level} className="flex items-center gap-2 w-full">
            {/* Label Huruf Tingkat dalam Lingkaran Kecil di Kiri */}
            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 select-none">
              {level}
            </div>

            {/* Kontainer Grid Kolom dengan Padding 3px (Mencegah Ring Terpotong) */}
            <div className="flex-1 min-w-0 p-[3px] space-y-2">
              {/* Bagian 1: Kolom 1 sampai midPoint */}
              {renderColumnRange(level, 1, midPoint)}

              {/* Bagian 2 (Cadangan Layar Sempit / Mobile): Kolom midPoint + 1 sampai n */}
              {shouldSplit && renderColumnRange(level, midPoint + 1, rack.n)}
            </div>
          </div>
        ))}

        {/* Baris Nomor Kolom di Bawah (Kelipatan 5: 1, 5, 10, 15, ...) */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/70 w-full">
          <div className="w-6 shrink-0" />
          <div className="flex-1 min-w-0 p-[3px] space-y-2">
            {renderNumberRange(1, midPoint)}
            {shouldSplit && renderNumberRange(midPoint + 1, rack.n)}
          </div>
        </div>
      </div>

      {/* Legenda Satu Baris Kecil (3 item, 11px, warna redup) */}
      <div className="flex items-center gap-4 flex-wrap text-[11px] pt-3 border-t border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-slate-300 dark:bg-slate-600" />
          Slot kosong
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600 dark:bg-indigo-400" />
          Slot terisi
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs border-2 border-indigo-500 bg-slate-100 dark:bg-slate-800" />
          Kolom terpilih
        </span>
      </div>
    </div>
  );
};

export default RackDetail;
