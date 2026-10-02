/**
 * Service pemanggil Google Apps Script (GAS) Web App untuk Mapping Rak Gudang WH2
 * Format Lokasi: WH2-{RAK}-{TINGKAT}{KOLOM}-S{SLOT}
 * Contoh: WH2-R4-B12-S2 (Rak R4, Tingkat B, Kolom 12, Slot 2)
 */

import { postGasApi } from './gasAuthService';
import { storageService } from './storage';
import {
  WH2RackId,
  RackLevel,
  RackConfig,
  WH2_RACKS,
  RACK_LEVELS,
  RACK_MAX_COLUMNS,
  RackSlotItem,
  MachineSearchResult,
  RackIssue,
  SelectedColumnCoord,
  formatSlotLocationId,
  parseSlotLocationId,
  formatRackDisplay,
} from '../types/wh2Rack';

// Re-export all WH2 rack types and constants so existing imports work seamlessly
export {
  WH2_RACKS,
  RACK_LEVELS,
  RACK_MAX_COLUMNS,
  formatSlotLocationId,
  parseSlotLocationId,
  formatRackDisplay,
};
export type {
  WH2RackId,
  RackLevel,
  RackConfig,
  RackSlotItem,
  MachineSearchResult,
  RackIssue,
  SelectedColumnCoord,
};

export const callGasApi = postGasApi;

export const rackMapService = {
  /**
   * GET_RACK_MAP
   * Mengambil data slot rak WH2 dari server GAS beserta issues/data bermasalah.
   * Tidak ada fallback lokal; bila server gagal, kembalikan error.
   */
  async getRackMap(): Promise<{
    success: boolean;
    slots: RackSlotItem[];
    issues: RackIssue[];
    message?: string;
  }> {
    try {
      const res = await postGasApi<{
        success: boolean;
        slots?: RackSlotItem[];
        issues?: RackIssue[];
        message?: string;
      }>('GET_RACK_MAP', {});

      if (res && res.success && Array.isArray(res.slots)) {
        return {
          success: true,
          slots: res.slots,
          issues: Array.isArray(res.issues) ? res.issues : [],
        };
      }
      return {
        success: false,
        slots: [],
        issues: [],
        message: res?.message || 'Gagal memuat mapping rak WH2 dari server.',
      };
    } catch (err: any) {
      return {
        success: false,
        slots: [],
        issues: [],
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
      // Fallback pencarian lokal jika jaringan tidak tersedia
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
   * Hanya mengandalkan server GAS (tidak menulis cache lokal direct mutation).
   */
  async assignRackSlot(params: {
    assetCode: string;
    siteId?: string;
    rak: string;
    tingkat: string;
    kolom: number;
    slot: number;
    byUser?: string;
  }): Promise<{ success: boolean; message: string }> {
    const { assetCode, rak, tingkat, kolom, slot } = params;
    const siteId = params.siteId || 'WH2';
    const newLocationId = formatSlotLocationId(rak, tingkat, kolom, slot);

    try {
      const res = await postGasApi<{ success: boolean; message: string }>('ASSIGN_RACK_SLOT', {
        assetCode,
        siteId,
        rak,
        tingkat,
        kolom,
        slot,
        byUser: params.byUser,
      });

      if (res && res.success) {
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
        byUser,
      });

      if (res && res.success) {
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
        byUser,
      });

      if (res && res.success) {
        return {
          success: true,
          message: res.message || `Penempatan mesin ${assetCode} berhasil dibatalkan.`,
        };
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
