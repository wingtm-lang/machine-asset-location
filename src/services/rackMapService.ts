/**
 * Service Mapping Rak Gudang WH2.
 * Format Lokasi: WH2-{RAK}-{TINGKAT}{KOLOM}-S{SLOT}, contoh WH2-R4-B12-S2.
 *
 * DIGANTI dari pemanggilan postGasApi langsung menjadi storageService (Supabase):
 *   - getRackMap        -> view public.v_rack_slots (langkah 5-1)
 *   - searchMachine      -> cache lokal yang sudah disinkronkan (storageService.getMachineByCode)
 *   - assignRackSlot     -> storageService.moveMachine (fungsi move_machine, langkah 5-1)
 *   - removeMachineFromRack / undoMove -> storageService.moveMachine / undoLastMove
 *
 * Nama dan bentuk setiap metode publik di objek rackMapService DIPERTAHANKAN SAMA
 * dengan versi lama, sehingga RackMapView.tsx dan SlotPanel.tsx tidak perlu diubah.
 *
 * "issues" (dulu: slot duplikat/format salah) selalu kosong di sini. Ini BUKAN
 * disembunyikan: constraint database (unique index per slot) membuat duplikat slot
 * mustahil terjadi, jadi tidak ada lagi yang perlu dilaporkan di titik ini.
 */

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

export const rackMapService = {
  /** Diambil langsung dari cache mesin yang sudah disinkronkan (tidak perlu round-trip server terpisah). */
  async getRackMap(): Promise<{
    success: boolean;
    slots: RackSlotItem[];
    issues: RackIssue[];
    message?: string;
  }> {
    const slots: RackSlotItem[] = [];
    for (const m of storageService.getAllMachines()) {
      const p = parseSlotLocationId(m.locationId);
      if (!p) continue;
      slots.push({
        assetCode: m.assetCode,
        barcode: m.barcode,
        serial: m.serial,
        name: m.standardMachineName,
        localName: m.localName,
        site: 'WH2',
        rak: p.rak,
        tingkat: p.tingkat,
        kolom: p.kolom,
        slot: p.slot,
        model: m.model,
        manufacturer: m.manufacturer,
        status: m.status,
      });
    }
    return { success: true, slots, issues: [] };
  },

  /** query = kode aset / barcode / serial. Dicari di cache lokal (sudah tersinkron dari server). */
  async searchMachine(query: string): Promise<{ success: boolean; machine?: MachineSearchResult; message?: string }> {
    const cleanQuery = (query || '').trim();
    if (!cleanQuery) {
      return { success: false, message: 'Masukkan kode aset, barcode, atau nomor seri.' };
    }
    const { machine } = storageService.getMachineByCode(cleanQuery);
    if (!machine) {
      return { success: false, message: `Mesin dengan kata kunci "${cleanQuery}" tidak ditemukan.` };
    }
    return {
      success: true,
      machine: {
        assetCode: machine.assetCode,
        barcode: machine.barcode,
        serial: machine.serial,
        standardMachineName: machine.standardMachineName || machine.item,
        localName: machine.localName,
        manufacturer: machine.manufacturer,
        model: machine.model,
        locationId: machine.locationId,
        siteId: machine.siteId,
        status: machine.status,
      },
    };
  },

  /** Menempatkan mesin ke satu slot rak lewat fungsi pindah biasa (move_machine menolak slot yang sudah terisi). */
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
    const newLocationId = formatSlotLocationId(rak, tingkat, kolom, slot);

    const res = await storageService.moveMachine({
      assetCode,
      targetLocationId: newLocationId,
      username: params.byUser || 'User',
      userSiteAccess: ['WH2'],
      reason: `Penempatan di rak ${newLocationId}`,
    });

    return res.success
      ? { success: true, message: res.message || `Mesin ${assetCode} berhasil ditempatkan di posisi ${newLocationId}.` }
      : { success: false, message: res.message };
  },

  /** Mengosongkan slot (mengembalikan mesin ke WH2-UNASSIGNED). Status TIDAK dikirim: biarkan server menjaga status mesin apa adanya. */
  async removeMachineFromRack(assetCode: string, byUser: string): Promise<{ success: boolean; message: string }> {
    const res = await storageService.moveMachine({
      assetCode,
      targetLocationId: 'WH2-UNASSIGNED',
      username: byUser,
      userSiteAccess: ['WH2'],
      reason: 'Dikeluarkan dari rak',
    });

    return res.success
      ? { success: true, message: res.message || `Mesin ${assetCode} berhasil dikeluarkan dari rak.` }
      : { success: false, message: res.message };
  },

  /** Membatalkan pemindahan TERAKHIR pada mesin ini (lewat fungsi undo_move di server; sama seperti dipakai menu Riwayat). */
  async undoMove(assetCode: string, byUser: string): Promise<{ success: boolean; message: string }> {
    const res = await storageService.undoLastMove({ assetCode, username: byUser, isAdmin: false });
    return res.success
      ? { success: true, message: res.message || `Penempatan mesin ${assetCode} berhasil dibatalkan.` }
      : { success: false, message: res.message };
  },
};
