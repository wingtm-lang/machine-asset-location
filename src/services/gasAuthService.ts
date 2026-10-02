/**
 * Service Pemanggil Google Apps Script (GAS) Web App untuk Autentikasi,
 * Sesi (sessionStorage), dan Manajemen Pengguna.
 * Backend (Google Apps Script) adalah SATU-SATUNYA sumber kebenaran.
 */

export interface GasAuthUser {
  username: string; // NIK
  displayName: string; // Profile / Nama
  role: string; // authority ("admin master" | "all sites" | "PW1" | "PW2" | "PW3")
  siteAccess: string[];
  canAddUser: boolean;
  canUseRackMap: boolean;
}

export type UserServerRole = 'ADMIN_MASTER' | 'ALL_SITES' | 'FACTORY' | 'UNKNOWN';

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
  timestamp: string; // "yyyy-MM-dd HH:mm:ss"
  notes?: string;
  isUndone?: boolean;
}

export interface GetMovementsParams {
  assetCode?: string;
  site?: string;
  from?: string; // "yyyy-MM-dd"
  to?: string;   // "yyyy-MM-dd"
  limit?: number; // default 200, max 1000
}

export interface GetMovementsResponse {
  success: boolean;
  hasMore?: boolean;
  movements?: ServerMovementRecord[];
  message?: string;
}

export interface GasManagedUser {
  nik: string;
  profile: string;
  authority: string;
  role: UserServerRole;
  sites: string[];
  rackMap: boolean;
  canAddUser: boolean;
  active: boolean;
}

/**
 * Memetakan respons pengguna dari server ke format GasManagedUser.
 * Mengikuti data server apa adanya tanpa tebak-tebakan alias di sisi klien.
 */
export function mapUserToManaged(u: any): GasManagedUser {
  const rawActive = u.active;
  const isActive =
    typeof rawActive === 'boolean'
      ? rawActive
      : typeof rawActive === 'string'
      ? !['false', '0', 'nonaktif', 'no', 'inactive'].includes(rawActive.trim().toLowerCase())
      : rawActive !== 0;

  return {
    nik: String(u.nik || u.username || '').trim(),
    profile: String(u.profile || u.displayName || u.nama || u.name || u.nik || '').trim(),
    authority: String(u.authority || u.role || 'PW1').trim(),
    role: (u.role || 'UNKNOWN') as UserServerRole,
    sites: Array.isArray(u.sites) ? u.sites : (Array.isArray(u.siteAccess) ? u.siteAccess : []),
    rackMap: typeof u.rackMap === 'boolean' ? u.rackMap : Boolean(u.canUseRackMap),
    canAddUser: typeof u.canAddUser === 'boolean' ? u.canAddUser : false,
    active: isActive,
  };
}

const SESSION_TOKEN_KEY = 'ptwinners_gas_token';
const SESSION_USER_KEY = 'ptwinners_gas_user';

// Callbacks for global events
type UnauthorizedCallback = () => void;
type ForbiddenCallback = (message: string) => void;

let onUnauthorizedCb: UnauthorizedCallback | null = null;
let onForbiddenCb: ForbiddenCallback | null = null;

export function registerAuthCallbacks(
  onUnauthorized: UnauthorizedCallback,
  onForbidden: ForbiddenCallback
) {
  onUnauthorizedCb = onUnauthorized;
  onForbiddenCb = onForbidden;
}

/**
 * Mendapatkan base URL GAS HANYA dari environment variable (VITE_GAS_URL / GAS_URL)
 */
export function getGasBaseUrl(): string {
  const metaEnv = (import.meta as any).env || {};
  const procEnv = typeof process !== 'undefined' ? (process.env || {}) : {};

  return (
    metaEnv.VITE_GAS_URL ||
    metaEnv.GAS_URL ||
    procEnv.VITE_GAS_URL ||
    procEnv.GAS_URL ||
    ''
  ).trim();
}

/**
 * Manajemen Token & Sesi di sessionStorage
 */
export function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): GasAuthUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: GasAuthUser): void {
  try {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.error('Gagal menyimpan sesi ke sessionStorage:', e);
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);
  } catch (e) {
    console.error('Gagal menghapus sesi dari sessionStorage:', e);
  }
}

/**
 * Pemanggil universal POST ke GAS Web App
 * Header: Content-Type: "text/plain;charset=utf-8" (agar tidak terkena CORS preflight)
 * Body: { token, action, params }
 */
export async function postGasApi<T>(action: string, params: Record<string, any> = {}): Promise<T> {
  const url = getGasBaseUrl();
  const token = getStoredToken() || '';

  if (!url) {
    throw new Error('URL Google Apps Script belum dikonfigurasi.');
  }

  const payload = {
    token,
    action,
    params,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const text = await response.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Respons server tidak valid: ${text.slice(0, 120)}`);
    }

    // Cek error UNAUTHORIZED dari server
    if (
      json.error === 'UNAUTHORIZED' ||
      (json.message && json.message.toUpperCase().includes('UNAUTHORIZED')) ||
      (json.message && json.message.toUpperCase().includes('TOKEN TIDAK VALID'))
    ) {
      clearSession();
      if (onUnauthorizedCb) {
        onUnauthorizedCb();
      }
      return {
        success: false,
        message: 'Sesi berakhir, silakan login kembali',
      } as any;
    }

    // Cek error FORBIDDEN dari server
    if (
      json.error === 'FORBIDDEN' ||
      (json.message && json.message.toUpperCase().includes('FORBIDDEN'))
    ) {
      if (onForbiddenCb) {
        onForbiddenCb(json.message || 'Akses ditolak (FORBIDDEN)');
      }
    }

    return json as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Koneksi ke server timeout (lebih dari 20 detik)');
    }
    throw err;
  }
}

// ============================================================
// SERVICE API UTAMA
// ============================================================

export const gasAuthService = {
  /**
   * 1) LOGIN { username, password }
   * Memanggil aksi LOGIN pada server GAS.
   * Sukses -> simpan token & user dari respons server apa adanya.
   * Gagal -> kembalikan pesan error server.
   */
  async login(username: string, passwordPlain: string): Promise<{
    success: boolean;
    token?: string;
    user?: GasAuthUser;
    message?: string;
  }> {
    const cleanNik = (username || '').trim();
    if (!cleanNik || !passwordPlain) {
      return { success: false, message: 'NIK dan Password wajib diisi.' };
    }

    try {
      const res = await postGasApi<{
        success: boolean;
        token?: string;
        user?: GasAuthUser;
        message?: string;
      }>('LOGIN', { username: cleanNik, password: passwordPlain });

      if (res && res.success && res.token && res.user) {
        saveSession(res.token, res.user);
        return {
          success: true,
          token: res.token,
          user: res.user,
          message: res.message || `Selamat datang, ${res.user.displayName || res.user.username}!`,
        };
      }

      return {
        success: false,
        message: res?.message || 'NIK atau password salah.',
      };
    } catch {
      return {
        success: false,
        message: 'Tidak dapat terhubung ke server. Coba lagi.',
      };
    }
  },

  /**
   * 2) ME
   * Memeriksa keabsahan sesi aktif ke server.
   * Jika tidak ada sesi atau server menolak -> clearSession.
   */
  async checkMe(): Promise<{ success: boolean; user?: GasAuthUser; message?: string }> {
    const token = getStoredToken();
    if (!token) {
      clearSession();
      return { success: false, message: 'Tidak ada sesi aktif' };
    }

    try {
      const res = await postGasApi<{ success: boolean; user?: GasAuthUser; message?: string }>('ME');
      if (res && res.success && res.user) {
        saveSession(token, res.user);
        return { success: true, user: res.user };
      }
      clearSession();
      return { success: false, message: res?.message || 'Sesi berakhir' };
    } catch {
      clearSession();
      return { success: false, message: 'Tidak dapat memverifikasi sesi ke server' };
    }
  },

  /**
   * 3) PING
   * Menguji konektivitas ke server dan membaca version/timestamp.
   */
  async ping(): Promise<{ success: boolean; version?: string; message?: string; timestamp?: string }> {
    try {
      return await postGasApi<{ success: boolean; version?: string; message?: string; timestamp?: string }>('PING');
    } catch (e: any) {
      return { success: false, message: e.message || 'Server tidak terhubung' };
    }
  },

  /**
   * 4) CHANGE_PASSWORD { oldPassword, newPassword }
   */
  async changePassword(oldPasswordPlain: string, newPasswordPlain: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await postGasApi<{ success: boolean; message?: string }>('CHANGE_PASSWORD', {
        oldPassword: oldPasswordPlain,
        newPassword: newPasswordPlain,
      });
      if (res && res.success) {
        return {
          success: true,
          message: res.message || 'Password berhasil diubah.',
        };
      }
      return {
        success: false,
        message: res?.message || 'Gagal mengubah password.',
      };
    } catch {
      return {
        success: false,
        message: 'Tidak dapat terhubung ke server. Coba lagi.',
      };
    }
  },

  /**
   * 5) ADD_USER { nik, password, profile, authority }
   */
  async addUser(params: {
    nik: string;
    password: string;
    profile: string;
    authority: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const res = await postGasApi<{ success: boolean; message?: string }>('ADD_USER', params);
      if (res && res.success) {
        return {
          success: true,
          message: res.message || `Pengguna ${params.nik} berhasil ditambahkan.`,
        };
      }
      return {
        success: false,
        message: res?.message || 'Gagal menambahkan pengguna.',
      };
    } catch {
      return {
        success: false,
        message: 'Tidak dapat terhubung ke server. Coba lagi.',
      };
    }
  },

  /**
   * 6) UPDATE_USER { nik, profile?, authority?, active? }
   */
  async updateUser(params: {
    nik: string;
    profile?: string;
    authority?: string;
    active?: boolean;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const res = await postGasApi<{ success: boolean; message?: string }>('UPDATE_USER', params);
      if (res && res.success) {
        return {
          success: true,
          message: res.message || `Pengguna ${params.nik} berhasil diperbarui.`,
        };
      }
      return {
        success: false,
        message: res?.message || 'Gagal memperbarui pengguna.',
      };
    } catch {
      return {
        success: false,
        message: 'Tidak dapat terhubung ke server. Coba lagi.',
      };
    }
  },

  /**
   * 7) RESET_PASSWORD { nik, newPassword }
   */
  async resetPassword(params: {
    nik: string;
    newPassword: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const res = await postGasApi<{ success: boolean; message?: string }>('RESET_PASSWORD', params);
      if (res && res.success) {
        return {
          success: true,
          message: res.message || `Password pengguna ${params.nik} berhasil direset.`,
        };
      }
      return {
        success: false,
        message: res?.message || 'Gagal mereset password.',
      };
    } catch {
      return {
        success: false,
        message: 'Tidak dapat terhubung ke server. Coba lagi.',
      };
    }
  },

  /**
   * 8) LIST_USERS
   */
  async listUsers(): Promise<{ success: boolean; users?: GasManagedUser[]; message?: string }> {
    try {
      const res = await postGasApi<{
        success: boolean;
        users?: any[];
        message?: string;
      }>('LIST_USERS');

      if (res && res.success && Array.isArray(res.users)) {
        return {
          success: true,
          users: res.users.map(mapUserToManaged),
        };
      }

      return {
        success: false,
        users: [],
        message: res?.message || 'Gagal mengambil daftar pengguna dari server.',
      };
    } catch {
      return {
        success: false,
        users: [],
        message: 'Tidak dapat terhubung ke server. Coba lagi.',
      };
    }
  },

  /**
   * 9) GET_MOVEMENTS { assetCode?, site?, from?, to?, limit? }
   * Mengambil riwayat mutasi/perpindahan mesin langsung dari server GAS.
   * from/to berformat "yyyy-MM-dd"; limit default 200, maks 1000.
   */
  async getMovements(params: GetMovementsParams = {}): Promise<GetMovementsResponse> {
    try {
      const cleanParams: Record<string, any> = {};
      if (params.assetCode && params.assetCode.trim()) {
        cleanParams.assetCode = params.assetCode.trim();
      }
      if (params.site && params.site.trim() && params.site !== 'ALL' && params.site !== 'Semua') {
        cleanParams.site = params.site.trim();
      }
      if (params.from && params.from.trim()) {
        cleanParams.from = params.from.trim();
      }
      if (params.to && params.to.trim()) {
        cleanParams.to = params.to.trim();
      }
      cleanParams.limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 1000) : 200;

      const res = await postGasApi<GetMovementsResponse>('GET_MOVEMENTS', cleanParams);
      if (res && res.success) {
        return {
          success: true,
          hasMore: Boolean(res.hasMore),
          movements: Array.isArray(res.movements) ? res.movements : [],
          message: res.message,
        };
      }

      return {
        success: false,
        hasMore: false,
        movements: [],
        message: res?.message || 'Gagal mengambil riwayat pemindahan dari server.',
      };
    } catch (err: any) {
      return {
        success: false,
        hasMore: false,
        movements: [],
        message: err.message || 'Tidak dapat terhubung ke server untuk mengambil riwayat mesin.',
      };
    }
  },

  /**
   * Logout
   */
  logout(): void {
    clearSession();
  },
};
