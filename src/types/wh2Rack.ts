/**
 * WH2 Warehouse Machine Rack Mapping Types and Constants
 */

export type WH2RackId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6';
export type RackLevel = 'A' | 'B' | 'C';
export type RackSlotNumber = 1 | 2 | 3;

export interface RackConfig {
  id: WH2RackId;
  name: string;
  columns: number;
  levels: RackLevel[]; // ['C', 'B', 'A']
  slotsPerColumn: number; // 3
  capacity: number; // columns * 3 * 3
  // Percentage coordinates on layout plan (ratio 1838:304)
  layout: {
    left: number; // %
    top: number;  // %
    width: number; // %
    height: number; // %
  };
}

export const WH2_RACK_CONFIG: Record<WH2RackId, RackConfig> = {
  R1: {
    id: 'R1',
    name: 'Rak R1',
    columns: 32,
    levels: ['C', 'B', 'A'],
    slotsPerColumn: 3,
    capacity: 32 * 3 * 3, // 288
    layout: { left: 57, top: 4.9, width: 42.9, height: 15.5 },
  },
  R2: {
    id: 'R2',
    name: 'Rak R2',
    columns: 28,
    levels: ['C', 'B', 'A'],
    slotsPerColumn: 3,
    capacity: 28 * 3 * 3, // 252
    layout: { left: 58.4, top: 41.8, width: 37.3, height: 14 },
  },
  R3: {
    id: 'R3',
    name: 'Rak R3',
    columns: 28,
    levels: ['C', 'B', 'A'],
    slotsPerColumn: 3,
    capacity: 28 * 3 * 3, // 252
    layout: { left: 58.4, top: 55.9, width: 37.3, height: 13.8 },
  },
  R4: {
    id: 'R4',
    name: 'Rak R4',
    columns: 26,
    levels: ['C', 'B', 'A'],
    slotsPerColumn: 3,
    capacity: 26 * 3 * 3, // 234
    layout: { left: 18.9, top: 4.9, width: 34.6, height: 13.2 },
  },
  R5: {
    id: 'R5',
    name: 'Rak R5',
    columns: 15,
    levels: ['C', 'B', 'A'],
    slotsPerColumn: 3,
    capacity: 15 * 3 * 3, // 135
    layout: { left: 33.2, top: 41.8, width: 20.2, height: 14 },
  },
  R6: {
    id: 'R6',
    name: 'Rak R6',
    columns: 15,
    levels: ['C', 'B', 'A'],
    slotsPerColumn: 3,
    capacity: 15 * 3 * 3, // 135
    layout: { left: 33.2, top: 55.9, width: 20.2, height: 13.8 },
  },
};

export const ALL_WH2_RACK_IDS: WH2RackId[] = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'];

export interface RackSlotItem {
  assetCode: string;
  barcode?: string;
  serial?: string;
  name?: string;
  site?: string;
  rak: string;      // 'R1'..'R6'
  tingkat: string;  // 'A'..'C'
  kolom: number;    // 1..columns
  slot: number;     // 1..3
  model?: string;
  manufacturer?: string;
  status?: string;
}

export interface MachineSearchResult {
  assetCode: string;
  barcode?: string;
  serial?: string;
  standardMachineName?: string;
  manufacturer?: string;
  model?: string;
  locationId: string;
  siteId: string;
  status: string;
}

export interface SelectedColumnPosition {
  rak: WH2RackId;
  tingkat: RackLevel;
  kolom: number;
}

export function formatSlotLocationId(rak: string, tingkat: string, kolom: number, slot: number): string {
  return `WH2-${rak}-${tingkat}${kolom}-S${slot}`;
}

export function parseSlotLocationId(locationId: string): { rak: string; tingkat: string; kolom: number; slot: number } | null {
  if (!locationId) return null;
  // Format: WH2-R4-B12-S2
  const match = locationId.match(/^WH2-(R\d+)-([A-C])(\d+)-S([1-3])$/i);
  if (!match) return null;
  return {
    rak: match[1].toUpperCase(),
    tingkat: match[2].toUpperCase(),
    kolom: parseInt(match[3], 10),
    slot: parseInt(match[4], 10),
  };
}
