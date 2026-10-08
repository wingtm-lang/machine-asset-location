/**
 * Autentikasi lewat Supabase Auth.
 * Login memakai NIK + password; NIK dipetakan ke email sintetis <nik>@sae-a.com.
 * Hak akses (role, site) TIDAK dihitung di sini: dibaca dari view v_me di database.
 */
import { supabase, isSupabaseConfigured } from './supabase';

export type ServerRole = 'ADMIN_MASTER' | 'ALL_SITES' | 'FACTORY' | 'WAREHOUSE';

export interface AuthUser {
  username: string; // NIK
  displayName: string;
  role: ServerRole;
  siteAccess: string[];
  canAddUser: boolean;
  canUseRackMap: boolean;
}

export const NIK_EMAIL_DOMAIN = 'sae-a.com';

export function nikToEmail(nik: string): string {
  return `${nik.trim().toLowerCase()}@${NIK_EMAIL_DOMAIN}`;
}

// ---------- Callback global (dipakai juga oleh lapisan data di langkah 6b) ----------
type UnauthorizedCallback = () => void;
type ForbiddenCallback = (message: string) => void;

let onUnauthorizedCb: UnauthorizedCallback | null = null;
let onForbiddenCb: ForbiddenCallback | null = null;

export function registerAuthCallbacks(onUnauthorized: UnauthorizedCallback, onForbidden: ForbiddenCallback): void {
  onUnauthorizedCb = onUnauthorized;
  onForbiddenCb = onForbidden;
}

export function emitUnauthorized(): void {
  if (onUnauthorizedCb) onUnauthorizedCb();
}

export function emitForbidden(message: string): void {
  if (onForbiddenCb) onForbiddenCb(message);
}

// ---------- Pembantu ----------
interface ErrorLike {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
}

function isNetworkError(e: unknown): boolean {
  const err = (e ?? {}) as ErrorLike;
  const msg = String(err.message ?? '').toLowerCase();
  return (
    err.name === 'AuthRetryableFetchError' ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed')
  );
}

function mapAuthError(e: unknown): string {
  const err = (e ?? {}) as ErrorLike;
  if (isNetworkError(e)) return 'Tidak dapat terhubung ke server. Coba lagi.';
  switch (err.code) {
    case 'invalid_credentials':
      return 'NIK atau password salah.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.';
    case 'user_banned':
      return 'Akun dinonaktifkan. Hubungi admin.';
    case 'weak_password':
      return 'Password terlalu lemah. Gunakan minimal 10 karakter dengan kombinasi huruf dan angka.';
    case 'same_password':
      return 'Password baru tidak boleh sama dengan password lama.';
    default:
      break;
  }
  if (err.status === 429) return 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.';
  if (err.status === 400) return 'NIK atau password salah.';
  return err.message || 'Terjadi kesalahan. Coba lagi.';
}

/**
 * Baca profil + hak akses dari server (view v_me).
 * - null  : tidak ada profil aktif (akun belum terdaftar, nonaktif, atau token tidak valid)
 * - throw : gangguan jaringan / server
 */
async function fetchMe(): Promise<AuthUser | null> {
  const { data, error } = await supabase.from('v_me').select('*').maybeSingle();
  if (error) {
    const code = (error as ErrorLike).code;
    if (code === 'PGRST301' || code === 'PGRST303' || (error as ErrorLike).status === 401) return null;
    throw error;
  }
  if (!data) return null;
  return {
    username: String(data.nik),
    displayName: String(data.display_name ?? data.nik),
    role: data.role as ServerRole,
    siteAccess: Array.isArray(data.site_access) ? (data.site_access as string[]) : [],
    canAddUser: Boolean(data.can_add_user),
    canUseRackMap: Boolean(data.can_use_rack_map),
  };
}

// ---------- API ----------
export const authService = {
  async login(
    nik: string,
    password: string
  ): Promise<{ success: boolean; message: string; token: string | null; user?: AuthUser }> {
    if (!isSupabaseConfigured) {
      return {
        success: false,
        token: null,
        message: 'Konfigurasi Supabase belum diisi (VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY di file .env).',
      };
    }
    const cleanNik = (nik || '').trim();
    if (!cleanNik || !password) {
      return { success: false, token: null, message: 'NIK dan password wajib diisi.' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: nikToEmail(cleanNik),
      password,
    });
    if (error) return { success: false, token: null, message: mapAuthError(error) };

    let user: AuthUser | null;
    try {
      user = await fetchMe();
    } catch {
      await supabase.auth.signOut();
      return { success: false, token: null, message: 'Tidak dapat terhubung ke server. Coba lagi.' };
    }
    if (!user) {
      await supabase.auth.signOut();
      return { success: false, token: null, message: 'Akun belum terdaftar atau dinonaktifkan. Hubungi admin.' };
    }
    return {
      success: true,
      token: data.session?.access_token ?? null,
      user,
      message: `Selamat datang, ${user.displayName}!`,
    };
  },

  /**
   * Pulihkan sesi saat aplikasi dibuka, lalu verifikasi ke server.
   * 'OFFLINE' = tidak bisa memverifikasi karena jaringan; sesi TIDAK dihapus.
   */
  async restore(): Promise<AuthUser | null | 'OFFLINE'> {
    const { data, error } = await supabase.auth.getSession();
    if (error) return isNetworkError(error) ? 'OFFLINE' : null;
    if (!data.session) return null;
    try {
      return await fetchMe();
    } catch {
      return 'OFFLINE';
    }
  },

  async getAccessToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },

  async logout(): Promise<void> {
    await supabase.auth.signOut();
  },

  /** Ganti password: verifikasi password lama dulu (login ulang), lalu simpan yang baru. */
  async changePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const { data } = await supabase.auth.getSession();
    const email = data.session?.user.email;
    if (!email) return { success: false, message: 'Sesi tidak valid. Silakan login ulang.' };

    const re = await supabase.auth.signInWithPassword({ email, password: oldPassword });
    if (re.error) {
      const err = re.error as ErrorLike;
      if (err.code === 'invalid_credentials' || err.status === 400) {
        return { success: false, message: 'Password lama salah.' };
      }
      return { success: false, message: mapAuthError(re.error) };
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, message: mapAuthError(error) };
    return { success: true, message: 'Password berhasil diubah.' };
  },

  /** Dipanggil saat sesi berakhir/keluar. Mengembalikan fungsi untuk berhenti berlangganan. */
  onSignedOut(cb: () => void): () => void {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') cb();
    });
    return () => data.subscription.unsubscribe();
  },
};
