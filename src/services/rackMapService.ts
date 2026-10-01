/**
 * Service pemanggil Google Apps Script (GAS) Web App untuk Mapping Rak Gudang WH2
 * Format Lokasi: WH2-{RAK}-{TINGKAT}{KOLOM}-S{SLOT}
 * Contoh: WH2-R4-B12-S2 (Rak R4, Tingkat B, Kolom 12, Slot 2)
 */

import { postGasApi, getGasBaseUrl } from './gasAuthService';
import { storageService } from './storage';

export const callGasApi = postGasApi;

export interface RackSlotItem {
  assetCode: string;
  barcode?: string;
  serial?: string;
  name?: string;
  site?: string;
  rak: string; // "R1".."R6"
  tingkat: 'A' | 'B' | 'C' | string;
  kolom: number;
  slot: number; // 1..3
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

export interface RackConfig {
  id: string; // "R1".."R6"
  n: number;  // jumlah kolom
  l: number;  // left %
  t: number;  // top %
  w: number;  // width %
  h: number;  // height %
}

export const WH2_RACKS: RackConfig[] = [
  { id: 'R1', n: 32, l: 49,   t: 8,  w: 48, h: 26 },
  { id: 'R2', n: 28, l: 50.5, t: 44, w: 43, h: 23 },
  { id: 'R3', n: 28, l: 50.5, t: 71, w: 43, h: 23 },
  { id: 'R4', n: 26, l: 3,    t: 8,  w: 42, h: 26 },
  { id: 'R5', n: 15, l: 21,   t: 44, w: 25, h: 23 },
  { id: 'R6', n: 15, l: 21,   t: 71, w: 25, h: 23 },
];

export const RACK_LEVELS: ('C' | 'B' | 'A')[] = ['C', 'B', 'A'];

export const rackMapService = {
  /**
   * GET_RACK_MAP
   * Mengambil data slot rak WH2 dari server GAS.
   * Tidak ada fallback lokal; bila server gagal, kembalikan error.
   */
  async getRackMap(): Promise<{ success: boolean; slots: RackSlotItem[]; message?: string }> {
    try {
      const res = await postGasApi<{ success: boolean; slots?: RackSlotItem[]; message?: string }>(
        'GET_RACK_MAP',
        {}
      );
      if (res && res.success && Array.isArray(res.slots)) {
        return { success: true, slots: res.slots };
      }
      return {
        success: false,
        slots: [],
        message: res?.message || 'Gagal memuat mapping rak WH2 dari server.',
      };
    } catch (err: any) {
      return {
        success: false,
        slots: [],
        message: err.message || 'Tidak dapat terhubung ke server untuk memuat rak WH2.',
      };
    }
  },

  /**
   * SEARCH_MACHINE params: { query } (query = kode aset / barcode / serial)
   */
  async searchMachine(query: string): Promise<{ success: boolean; machine?: MachineSearchResult; message?: string }> {
    const cleanQuery = (query || '').trim();
    if (!cleanQuery) {
      return { success: false, message: 'Masukkan kode aset, barcode, atau nomor seri.' };
    }

    try {
      const res = await postGasApi<{ success: boolean; machine?: MachineSearchResult; message?: string }>(
        'SEARCH_MACHINE',
        { query: cleanQuery }
      );
      if (res && res.success && res.machine) {
        return { success: true, machine: res.machine };
      }
      return {
        success: false,
        message: res?.message || `Mesin dengan kata kunci "${cleanQuery}" tidak ditemukan di server.`,
      };
    } catch {
      // Fallback pencarian lokal jika jaringan gagal
      const machines = storageService.getAllMachines();
      const qUpper = cleanQuery.toUpperCase();

      const found = machines.find(
        (m) =>
          (m.assetCode && m.assetCode.toUpperCase() === qUpper) ||
          (m.barcode && m.barcode === cleanQuery) ||
          (m.serial && m.serial.toUpperCase() === qUpper)
      );

      if (found) {
        return {
          success: true,
          machine: {
            assetCode: found.assetCode,
            barcode: found.barcode,
            serial: found.serial,
            standardMachineName: found.standardMachineName || found.item,
            manufacturer: found.manufacturer,
            model: found.model,
            locationId: found.locationId,
            siteId: found.siteId,
            status: found.status,
          },
        };
      }

      return { success: false, message: `Mesin dengan kata kunci "${cleanQuery}" tidak ditemukan.` };
    }
  },

  /**
   * ASSIGN_RACK_SLOT params: { assetCode, siteId:"WH2", rak, tingkat, kolom, slot }
   * Hanya diterapkan di lokal bila respons server success: true
   */
  async assignRackSlot(params: {
    assetCode: string;
    siteId?: string;
    rak: string;
    tingkat: string;
    kolom: number;
    slot: number;
    byUser: string;
  }): Promise<{ success: boolean; message: string }> {
    const { assetCode, rak, tingkat, kolom, slot, byUser } = params;
    const siteId = params.siteId || 'WH2';
    const newLocationId = `WH2-${rak}-${tingkat}${kolom}-S${slot}`;

    try {
      const res = await postGasApi<{ success: boolean; message: string }>('ASSIGN_RACK_SLOT', {
        assetCode,
        siteId,
        rak,
        tingkat,
        kolom,
        slot,
      });

      if (res && res.success) {
        storageService.setMachineLocationDirect({
          assetCode,
          locationId: newLocationId,
          siteId: 'WH2',
          username: byUser,
          reason: `Ditempatkan di slot rak ${newLocationId}`,
        });
        return {
          success: true,
          message: res.message || `Mesin ${assetCode} berhasil ditempatkan di posisi ${newLocationId}.`,
        };
      }

      return {
        success: false,
        message: res?.message || 'Gagal menempatkan mesin di slot rak server.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Tidak dapat terhubung ke server. Coba lagi.',
      };
    }
  },

  /**
   * MOVE_MACHINE params: { assetCode, barcode, locationId:"WH2-UNASSIGNED", siteId:"WH2", status, reason }
   * Mengosongkan slot (mengembalikan mesin ke WH2-UNASSIGNED)
   */
  async removeMachineFromRack(assetCode: string, byUser: string): Promise<{ success: boolean; message: string }> {
    const machine = storageService.getAllMachines().find((m) => m.assetCode.toUpperCase() === assetCode.toUpperCase());

    try {
      const res = await postGasApi<{ success: boolean; message: string }>('MOVE_MACHINE', {
        assetCode,
        barcode: machine?.barcode || assetCode,
        locationId: 'WH2-UNASSIGNED',
        siteId: 'WH2',
        status: machine?.status || 'ACTIVE',
        reason: 'Dikeluarkan dari rak',
      });

      if (res && res.success) {
        storageService.setMachineLocationDirect({
          assetCode,
          locationId: 'WH2-UNASSIGNED',
          siteId: 'WH2',
          username: byUser,
          reason: 'Dikeluarkan dari rak',
        });
        return {
          success: true,
          message: res.message || `Mesin ${assetCode} berhasil dikeluarkan dari rak.`,
        };
      }

      return {
        success: false,
        message: res?.message || 'Gagal mengeluarkan mesin dari rak server.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Tidak dapat terhubung ke server. Coba lagi.',
      };
    }
  },

  /**
   * UNDO_MOVE params: { assetCode }
   */
  async undoMove(assetCode: string, byUser: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await postGasApi<{ success: boolean; message: string }>('UNDO_MOVE', {
        assetCode,
      });

      if (res && res.success) {
        return await storageService.undoLastMove({
          assetCode,
          username: byUser,
          isAdmin: true,
        });
      }

      return {
        success: false,
        message: res?.message || 'Gagal membatalkan pemindahan di server.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Tidak dapat terhubung ke server. Coba lagi.',
      };
    }
  },
};
