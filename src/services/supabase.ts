/**
 * Klien Supabase tunggal untuk seluruh aplikasi.
 *
 * Kunci yang dipakai di sini adalah PUBLISHABLE key (atau anon key lama): memang
 * dirancang publik. Keamanan data dijaga oleh RLS di database, bukan oleh kunci ini.
 * JANGAN PERNAH memasukkan secret key / service_role key ke kode frontend atau .env VITE_.
 */
import { createClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim();

export const isSupabaseConfigured = Boolean(url && key);

// Nilai pengganti mencegah aplikasi crash saat .env belum diisi;
// authService.login() menampilkan pesan konfigurasi yang jelas.
export const supabase = createClient(url || 'http://localhost:54321', key || 'belum-dikonfigurasi', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    // Sesi hilang saat tab ditutup (cocok untuk PC bersama di pabrik),
    // sama seperti perilaku aplikasi lama.
    storage: window.sessionStorage,
  },
});
