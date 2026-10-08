/**
 * NAMA FILE DIPERTAHANKAN agar UserManagementView.tsx, LoginPage.tsx, AdminView.tsx
 * tidak perlu diubah importnya. Isinya sekarang memanggil Supabase, bukan Apps Script.
 *
 * KETERBATASAN SAAT INI: menambah pengguna dan mereset password butuh hak admin
 * (Supabase Admin API) yang TIDAK BOLEH dipanggil dari browser (perlu service_role key,
 * yang harus tetap rahasia di server). Dua aksi itu mengembalikan pesan yang jelas, bukan
 * pura-pura berhasil. Solusinya: Edge Function (langkah 6c, belum dibuat) atau sementara
 * lewat dashboard Supabase > Authentication > Users > Add user / Reset password.
 */

import { supabase } from './supabase';

export type UserServerRole = 'ADMIN_MASTER' | 'ALL_SITES' | 'FACTORY' | 'WAREHOUSE' | 'UNKNOWN';

export interface GasManagedUser {
  nik: string;
  profile: string;
  authority: string; // "admin master" | "All sites" | "PT.Winners(1)" dst, untuk tampilan lama
  role: UserServerRole;
  sites: string[];
  rackMap: boolean;
  canAddUser: boolean;
  active: boolean;
}

export interface ServerMovementRecord {
  historyId: string;
  barcode?: string;
  assetCode?: string;
  serial?: string;
  machineName?: string;
  fromLocation?: string;
  toLocation?: string;
  fromSite?: string;
  toSite?: string;
  status?: string;
  reason?: string;
  movedBy?: string;
  timestamp: string;
  notes?: string;
  isUndone?: boolean;
}

export interface GetMovementsParams {
  assetCode?: string;
  site?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export interface GetMovementsResponse {
  success: boolean;
  hasMore?: boolean;
  movements?: ServerMovementRecord[];
  message?: string;
}

function errMessage(e: unknown): string {
  const err = (e ?? {}) as { message?: string };
  const msg = String(err.message ?? '');
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(msg)) {
    return 'Tidak dapat terhubung ke server. Coba lagi.';
  }
  return msg || 'Terjadi kesalahan saat menghubungi server.';
}

function authorityText(role: UserServerRole, site: string | null): string {
  if (role === 'ADMIN_MASTER') return 'admin master';
  if (role === 'ALL_SITES') return 'All sites';
  if (role === 'FACTORY' && site) return `PT.Winners(${site.replace('PW', '')})`;
  if (role === 'WAREHOUSE') return 'Warehouse 2';
  return 'PW1';
}

function parseAuthorityInput(authority: string): { role: UserServerRole; site: string | null } | null {
  const s = authority.toLowerCase().replace(/\s+/g, '');
  if (s === 'adminmaster') return { role: 'ADMIN_MASTER', site: null };
  if (s === 'allsites') return { role: 'ALL_SITES', site: null };
  if (s === 'warehouse2' || s === 'warehouse' || s === 'wh2') return { role: 'WAREHOUSE', site: 'WH2' };
  const m = /^(?:pt\.?winners|pw)\(?([1-3])\)?$/.exec(s);
  if (m) return { role: 'FACTORY', site: `PW${m[1]}` };
  return null;
}

export const gasAuthService = {
  /** Dulu menguji koneksi Apps Script. Sekarang: koneksi ke Supabase berhasil bila tidak melempar error jaringan. */
  async ping(): Promise<{ success: boolean; version?: string; message?: string; timestamp?: string }> {
    try {
      const { error } = await supabase.from('sites').select('site_id').limit(1);
      if (error && !/jwt|401/i.test(String(error.message ?? ''))) {
        return { success: false, message: errMessage(error) };
      }
      return { success: true, version: 'supabase-v1', message: 'Koneksi ke Supabase berhasil', timestamp: new Date().toISOString() };
    } catch (e) {
      return { success: false, message: errMessage(e) };
    }
  },

  async listUsers(): Promise<{ success: boolean; users?: GasManagedUser[]; message?: string }> {
    const { data, error } = await supabase
      .from('profiles')
      .select('nik, display_name, role, factory_site, active')
      .order('nik');
    if (error) return { success: false, users: [], message: errMessage(error) };
    const users: GasManagedUser[] = (data ?? []).map((r) => {
      const role = r.role as UserServerRole;
      const site = r.factory_site as string | null;
      return {
        nik: String(r.nik),
        profile: String(r.display_name),
        authority: authorityText(role, site),
        role,
        sites: (role === 'FACTORY' || role === 'WAREHOUSE') && site ? [site] : ['PW1', 'PW2', 'PW3', 'WH2', 'SW', 'QA'],
        rackMap: role !== 'FACTORY',
        canAddUser: role === 'ADMIN_MASTER',
        active: Boolean(r.active),
      };
    });
    return { success: true, users };
  },

  async addUser(params: { nik: string; password: string; profile: string; authority: string }): Promise<{ success: boolean; message: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'ADD_USER', ...params },
      });
      if (error) return { success: false, message: errMessage(error) };
      const r = (data ?? {}) as { success?: boolean; message?: string };
      return r.success
        ? { success: true, message: r.message || `User ${params.nik} berhasil ditambahkan.` }
        : { success: false, message: r.message || 'Gagal menambahkan pengguna.' };
    } catch (e) {
      return { success: false, message: errMessage(e) };
    }
  },

  async resetPassword(params: { nik: string; newPassword: string }): Promise<{ success: boolean; message: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'RESET_PASSWORD', ...params },
      });
      if (error) return { success: false, message: errMessage(error) };
      const r = (data ?? {}) as { success?: boolean; message?: string };
      return r.success
        ? { success: true, message: r.message || `Password pengguna ${params.nik} berhasil direset.` }
        : { success: false, message: r.message || 'Gagal mereset password.' };
    } catch (e) {
      return { success: false, message: errMessage(e) };
    }
  },

  async updateUser(params: { nik: string; profile?: string; authority?: string; active?: boolean }): Promise<{ success: boolean; message: string }> {
    let role: string | null = null;
    let site: string | null = null;
    if (params.authority) {
      const parsed = parseAuthorityInput(params.authority);
      if (!parsed) return { success: false, message: 'Authority tidak valid.' };
      role = parsed.role;
      site = parsed.site;
    }
    const { data, error } = await supabase.rpc('admin_update_profile', {
      p_nik: params.nik,
      p_display_name: params.profile ?? null,
      p_role: role,
      p_factory_site: site,
      p_active: typeof params.active === 'boolean' ? params.active : null,
    });
    if (error) return { success: false, message: errMessage(error) };
    const r = (data ?? {}) as { success?: boolean; message?: string };
    if (!r.success) return { success: false, message: r.message || 'Gagal memperbarui pengguna.' };
    return { success: true, message: r.message || `Pengguna ${params.nik} berhasil diperbarui.` };
  },

  /** Riwayat lengkap (melebihi 300 baris cache storage.ts), dengan filter dari server. */
  async getMovements(params: GetMovementsParams = {}): Promise<GetMovementsResponse> {
    try {
      const limit = Math.min(Math.max(1, params.limit ?? 200), 1000);
      let q = supabase
        .from('movements')
        .select(
          'id, asset_code, barcode, serial, machine_name, from_location, to_location, from_site_id, to_site_id, status_after, reason, moved_by_nik, moved_at, notes, movement_type, undoes_movement_id'
        )
        .order('id', { ascending: false })
        .limit(limit + 1);
      if (params.assetCode) q = q.eq('asset_code', params.assetCode.trim().toUpperCase());
      if (params.from) q = q.order('moved_at', { ascending: false });
      const { data, error } = await q;
      if (error) return { success: false, hasMore: false, movements: [], message: errMessage(error) };
      const rows = data ?? [];
      const hasMore = rows.length > limit;
      const page = rows.slice(0, limit);
      return {
        success: true,
        hasMore,
        movements: page.map((r) => ({
          historyId: String(r.id),
          barcode: r.barcode ?? undefined,
          assetCode: r.asset_code ?? undefined,
          serial: r.serial ?? undefined,
          machineName: r.machine_name ?? undefined,
          fromLocation: r.from_location ?? undefined,
          toLocation: r.to_location ?? undefined,
          fromSite: r.from_site_id ?? undefined,
          toSite: r.to_site_id ?? undefined,
          status: r.status_after ?? undefined,
          reason: r.reason ?? undefined,
          movedBy: r.moved_by_nik ?? undefined,
          timestamp: String(r.moved_at),
          notes: r.notes ?? undefined,
          isUndone: r.movement_type === 'TRANSFER_CANCEL' || r.undoes_movement_id != null,
        })),
      };
    } catch (e) {
      return { success: false, hasMore: false, movements: [], message: errMessage(e) };
    }
  },

  async changePassword(oldPasswordPlain: string, newPasswordPlain: string): Promise<{ success: boolean; message: string }> {
    const { authService } = await import('./authService');
    return authService.changePassword(oldPasswordPlain, newPasswordPlain);
  },

  /** Dipertahankan untuk kompatibilitas pemanggil lama; logout sesungguhnya ada di authContext/authService. */
  logout(): void {
    /* no-op: lihat authService.logout() */
  },
};

/** Dulu membaca VITE_GAS_URL. Sekarang: tidak ada satu "base URL" tunggal untuk ditampilkan; pakai status ping. */
export function getGasBaseUrl(): string {
  return (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
}
