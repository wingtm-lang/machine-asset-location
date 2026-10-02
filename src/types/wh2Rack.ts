/**
 * WH2 Warehouse Machine Rack Mapping Types and Constants
 * Single Source of Truth for WH2 Racks layout and Slot Location IDs.
 * Format: WH2-{RAK}-{TINGKAT}{KOLOM}-S{SLOT} e.g. WH2-R4-B12-S2
 */

export type WH2RackId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6';
export type RackLevel = 'A' | 'B' | 'C';
export type RackSlotNumber = 1 | 2 | 3;

export interface RackConfig {
  id: WH2RackId;
  name?: string;
  n: number; // jumlah kolom
  l: number; // left %
  t: number; // top %
  w: number; // width %
  h: number; // height %
}

export const WH2_RACKS: RackConfig[] = [
  { id: 'R1', n: 32, l: 49,   t: 8,  w: 48, h: 26, name: 'Rak R1' },
  { id: 'R2', n: 28, l: 50.5, t: 44, w: 43, h: 23, name: 'Rak R2' },
  { id: 'R3', n: 28, l: 50.5, t: 71, w: 43, h: 23, name: 'Rak R3' },
  { id: 'R4', n: 26, l: 3,    t: 8,  w: 42, h: 26, name: 'Rak R4' },
  { id: 'R5', n: 15, l: 21,   t: 44, w: 25, h: 23, name: 'Rak R5' },
  { id: 'R6', n: 15, l: 21,   t: 71, w: 25, h: 23, name: 'Rak R6' },
];

export const ALL_WH2_RACK_IDS: WH2RackId[] = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'];
export const RACK_LEVELS: RackLevel[] = ['C', 'B', 'A'];

export const RACK_MAX_COLUMNS: Record<WH2RackId, number> = {
  R1: 32,
  R2: 28,
  R3: 28,
  R4: 26,
  R5: 15,
  R6: 15,
};

export interface RackSlotItem {
  assetCode: string;
  barcode?: string;
  serial?: string;
  name?: string;
  localName?: string;
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
  localName?: string;
  manufacturer?: string;
  model?: string;
  locationId: string;
  siteId: string;
  status: string;
}

export interface RackIssue {
  row?: number;
  assetCode?: string;
  locationId?: string;
  problem: string;
}

export interface SelectedColumnCoord {
  level: RackLevel | string;
  column: number;
}

export function formatSlotLocationId(rak: string, tingkat: string, kolom: number, slot: number): string {
  const cleanRak = String(rak || '').trim().toUpperCase();
  const cleanLevel = String(tingkat || '').trim().toUpperCase();
  return `WH2-${cleanRak}-${cleanLevel}${kolom}-S${slot}`;
}

export function parseSlotLocationId(locationId: string): { rak: WH2RackId; tingkat: RackLevel; kolom: number; slot: number } | null {
  if (!locationId) return null;
  // Format: WH2-R4-B12-S2
  const match = String(locationId).trim().match(/^WH2-(R[1-6])-([A-C])(\d+)-S([1-3])$/i);
  if (!match) return null;
  return {
    rak: match[1].toUpperCase() as WH2RackId,
    tingkat: match[2].toUpperCase() as RackLevel,
    kolom: parseInt(match[3], 10),
    slot: parseInt(match[4], 10),
  };
}

export function formatRackDisplay(locationId: string): string | null {
  const p = parseSlotLocationId(locationId);
  if (!p) return null;
  return `Rak ${p.rak} · Tingkat ${p.tingkat} · Kolom ${p.kolom} · Slot ${p.slot}`;
}
