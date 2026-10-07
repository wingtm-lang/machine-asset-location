// =============================================================================
// PT.WINNERS - Edge Function: admin-users
// Langkah 6c. Satu-satunya tempat yang boleh memakai SUPABASE_SERVICE_ROLE_KEY
// (Admin API). Kunci ini TIDAK PERNAH ada di browser/bundle frontend.
//
// Dipanggil lewat: supabase.functions.invoke('admin-users', { body: {...} })
// Aksi: 'ADD_USER' { nik, password, profile, authority }
//       'RESET_PASSWORD' { nik, newPassword }
//
// Keamanan berlapis (bukan hanya mengandalkan RLS tabel profiles):
//   1. Token pemanggil diverifikasi ke Supabase Auth (siapa dia).
//   2. Baris profiles pemanggil dicek: harus role = ADMIN_MASTER dan active.
//   3. Baru setelah itu Admin API dipanggil.
// =============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const NIK_EMAIL_DOMAIN = 'sae-a.com'; // HARUS SAMA PERSIS dengan authService.ts di frontend

// CORS wajib ada: browser mengirim preflight OPTIONS sebelum POST sungguhan.
// Tanpa header ini, browser memblokir permintaan sebelum sampai ke kode di bawah,
// dan supabase-js hanya melaporkan "Failed to send a request to the Edge Function".
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const JSON_HEADERS = { 'Content-Type': 'application/json', ...CORS_HEADERS };

function respond(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function nikToEmail(nik: string): string {
  return `${nik.trim().toLowerCase()}@${NIK_EMAIL_DOMAIN}`;
}

function canonicalAuthority(input: string): { text: string; role: string; site: string | null } | null {
  const s = String(input || '').toLowerCase().replace(/\s+/g, '');
  if (s === 'adminmaster') return { text: 'admin master', role: 'ADMIN_MASTER', site: null };
  if (s === 'allsites') return { text: 'All sites', role: 'ALL_SITES', site: null };
  const m = /^(?:pt\.?winners|pw)\(?([1-3])\)?$/.exec(s);
  if (m) return { text: `PT.Winners(${m[1]})`, role: 'FACTORY', site: `PW${m[1]}` };
  return null;
}

// Admin client (service_role): hanya dipakai SETELAH pemanggil terverifikasi admin master.
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

Deno.serve(async (req: Request) => {
  // Preflight CORS: browser mengirim ini duluan untuk POST lintas origin. Harus dibalas
  // 2xx dengan header CORS, tanpa autentikasi (browser belum mengirim body/Authorization di sini).
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return respond({ success: false, message: 'Method tidak didukung.' }, 405);
  }

  // ---------- 1. Siapa pemanggilnya? ----------
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return respond({ success: false, error: 'UNAUTHORIZED', message: 'Sesi tidak valid.' }, 401);
  }

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) {
    return respond({ success: false, error: 'UNAUTHORIZED', message: 'Sesi tidak valid atau sudah berakhir.' }, 401);
  }

  // ---------- 2. Apakah dia admin master aktif? ----------
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('role, active, nik')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileErr || !profile || !profile.active || profile.role !== 'ADMIN_MASTER') {
    return respond({ success: false, error: 'FORBIDDEN', message: 'Hanya admin master yang dapat melakukan aksi ini.' }, 403);
  }

  // ---------- 3. Baca body ----------
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return respond({ success: false, message: 'Isi permintaan tidak valid.' }, 400);
  }
  const action = String(body.action ?? '');

  // ---------- 4. ADD_USER ----------
  if (action === 'ADD_USER') {
    const nik = String(body.nik ?? '').trim();
    const password = String(body.password ?? '');
    const profileName = String(body.profile ?? '').trim();
    const authorityInput = String(body.authority ?? '');

    if (!/^[A-Za-z0-9._-]{3,20}$/.test(nik)) {
      return respond({ success: false, message: 'NIK harus 3-20 karakter (huruf/angka/._-).' });
    }
    if (password.length < 10) {
      return respond({ success: false, message: 'Password minimal 10 karakter.' });
    }
    if (!profileName) {
      return respond({ success: false, message: 'Nama (profile) wajib diisi.' });
    }
    const auth = canonicalAuthority(authorityInput);
    if (!auth) {
      return respond({ success: false, message: 'Authority tidak valid (admin master / all sites / PW1 / PW2 / PW3).' });
    }

    const { data: existing } = await admin.from('profiles').select('nik').ilike('nik', nik).maybeSingle();
    if (existing) {
      return respond({ success: false, message: `NIK ${nik} sudah terdaftar.` });
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: nikToEmail(nik),
      password,
      email_confirm: true,
    });
    if (createErr || !created.user) {
      const msg = String(createErr?.message ?? '');
      if (/already.*registered|duplicate/i.test(msg)) {
        return respond({ success: false, message: `NIK ${nik} sudah terdaftar (akun auth sudah ada).` });
      }
      return respond({ success: false, message: msg || 'Gagal membuat akun.' });
    }

    const { error: insertErr } = await admin.from('profiles').insert({
      id: created.user.id,
      nik,
      display_name: profileName,
      role: auth.role,
      factory_site: auth.site,
      active: true,
    });
    if (insertErr) {
      // Rollback: jangan tinggalkan akun auth tanpa profil (tidak bisa login tapi "ada").
      await admin.auth.admin.deleteUser(created.user.id);
      return respond({ success: false, message: 'Gagal menyimpan profil pengguna: ' + insertErr.message });
    }

    await admin.from('audit_log').insert({
      actor: userData.user.id,
      actor_nik: profile.nik,
      action: 'ADD_USER',
      detail: { nik, profile: profileName, authority: auth.text },
    });

    return respond({ success: true, message: `User ${nik} (${profileName}) berhasil ditambahkan.` });
  }

  // ---------- 5. RESET_PASSWORD ----------
  if (action === 'RESET_PASSWORD') {
    const nik = String(body.nik ?? '').trim();
    const newPassword = String(body.newPassword ?? '');

    if (!nik) return respond({ success: false, message: 'NIK wajib diisi.' });
    if (newPassword.length < 10) {
      return respond({ success: false, message: 'Password minimal 10 karakter.' });
    }

    const { data: target } = await admin.from('profiles').select('id, nik').ilike('nik', nik).maybeSingle();
    if (!target) {
      return respond({ success: false, message: `NIK ${nik} tidak ditemukan.` });
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(target.id, { password: newPassword });
    if (updErr) {
      return respond({ success: false, message: updErr.message || 'Gagal mereset password.' });
    }

    await admin.from('audit_log').insert({
      actor: userData.user.id,
      actor_nik: profile.nik,
      action: 'RESET_PASSWORD',
      detail: { nik: target.nik },
    });

    return respond({ success: true, message: `Password pengguna ${target.nik} berhasil direset.` });
  }

  return respond({ success: false, message: `Aksi tidak dikenal: ${action}` }, 400);
});
