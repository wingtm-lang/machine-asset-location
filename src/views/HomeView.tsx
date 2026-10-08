import React from 'react';
import { useAuth } from '../services/authContext';
import {
  LayoutDashboard,
  Boxes,
  Grid,
  Layers,
  ArrowRightLeft,
  ClipboardCheck,
  History,
  FileText,
  Users,
  ShieldAlert,
  Building2,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Lock,
  QrCode,
} from 'lucide-react';

interface HomeViewProps {
  onNavigateTab: (tab: string) => void;
  onOpenScanner?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onNavigateTab,
  onOpenScanner,
}) => {
  const { currentUser, canUseRackMap, canAddUser, canPerformAction } = useAuth();
  const siteList = currentUser?.siteAccess || [];

  const modules = [
    {
      id: 'dashboard',
      title: 'Dashboard Asset',
      desc: 'Ringkasan metrik total mesin, distribusi per site/pabrik, dan status operasional.',
      icon: LayoutDashboard,
      allowed: true,
      badge: 'Live Metrik',
    },
    {
      id: 'machines',
      title: 'Data Mesin',
      desc: 'Pencarian & inventaris mesin jahit, detail serial, mutasi batch, dan filter status.',
      icon: Boxes,
      allowed: true,
      badge: 'Inventaris',
    },
    {
      id: 'rackmap',
      title: 'WH2 Rack Map',
      desc: 'Denah interaktif rak Warehouse 2 (R1–R6, tingkat A–C) dengan slot mesin per kolom.',
      icon: Grid,
      allowed: canUseRackMap,
      badge: 'WH2 Denah',
      lockedNote: 'Khusus Warehouse 2 / All Sites / Admin',
    },
    {
      id: 'move',
      title: 'Pindahkan Lokasi',
      desc: 'Mutasi posisi mesin ke line atau rak tertentu secara individual maupun batch.',
      icon: Layers,
      allowed: canPerformAction('MOVE') || canPerformAction('CHANGE_STATUS'),
      badge: 'Mutasi Cepat',
      lockedNote: 'Perlu hak akses pemindahan',
    },
    {
      id: 'transfers',
      title: 'Transfer Antar Site',
      desc: 'Alur kirim dan terima mesin antar pabrik (PW1, PW2, PW3, WH2, SW, QA) via In-Transit.',
      icon: ArrowRightLeft,
      allowed: canPerformAction('TRANSFER'),
      badge: 'Antar Pabrik',
      lockedNote: 'Perlu hak akses transfer',
    },
    {
      id: 'opname',
      title: 'Weekly Machine List',
      desc: 'Rekonsiliasi berkala fisik mesin dengan pemindai barcode / QR dan catat selisih lokasi.',
      icon: ClipboardCheck,
      allowed: canPerformAction('OPNAME'),
      badge: 'Audit Fisik',
      lockedNote: 'Perlu hak akses audit opname',
    },
    {
      id: 'history',
      title: 'Riwayat Mesin',
      desc: 'Lihat riwayat pemindahan mesin di site Anda.',
      icon: History,
      allowed: true,
      badge: 'Riwayat',
    },
    {
      id: 'reports',
      title: 'Laporan Harian',
      desc: 'Laporan harian, rekapitulasi pergerakan mesin, dan penerima email.',
      icon: FileText,
      allowed: canPerformAction('REPORTS'),
      badge: 'Laporan',
      lockedNote: 'Khusus Admin Master & All Sites',
    },
    {
      id: 'users',
      title: 'Kelola Pengguna',
      desc: 'Manajemen akun user, penambahan NIK baru, dan pengaturan hak akses otoritas.',
      icon: Users,
      allowed: canAddUser,
      badge: 'Admin Master',
      lockedNote: 'Hanya Admin Master',
    },
    {
      id: 'admin',
      title: 'Admin & Integrasi GAS',
      desc: 'Sinkronisasi Google Spreadsheet, generator backend Code.gs, dan audit konsistensi data.',
      icon: ShieldAlert,
      allowed: canPerformAction('ADMIN') || canAddUser,
      badge: 'Backend GAS',
      lockedNote: 'Khusus Admin Master',
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      {/* Kartu Sambutan & Sapaan Pengguna dengan Palette Blueprint Navy & Gold */}
      <div className="bg-gradient-to-r from-[#0c2e57] via-[#0f3869] to-[#081d36] text-white border border-[#234b7f]/80 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        {/* Dekorasi Garis Grid Blueprint Halus */}
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage:
              'linear-gradient(#cfe6ff 1px, transparent 1px), linear-gradient(90deg, #cfe6ff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#ffd23f]/15 border border-[#ffd23f]/40 text-[#ffd23f] text-xs font-mono font-bold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Otoritas: {currentUser?.role || 'User'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Halo, {currentUser?.displayName || 'Pengguna'}!
            </h1>
            <p className="text-xs sm:text-sm text-[#cfe6ff]/85 mt-1.5 max-w-2xl leading-relaxed">
              Selamat datang di sistem <strong>MACHINE ASSET MANAGEMENT</strong> PT. WINNERS INTERNATIONAL.
              Seluruh modul pelacakan, mutasi, denah rak, dan transfer mesin siap digunakan sesuai hak akses Anda.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-3">
            {onOpenScanner && (
              <button
                type="button"
                onClick={onOpenScanner}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#ffd23f] to-[#f59e0b] hover:from-[#ffe066] hover:to-[#fbbf24] text-[#0c2e57] font-black text-xs flex items-center gap-2 shadow-lg shadow-black/30 transition-transform active:scale-95 cursor-pointer"
              >
                <QrCode className="w-4 h-4 stroke-[2.5]" />
                <span>Scan Barcode</span>
              </button>
            )}

            <div className="bg-[#081f3c]/90 px-3.5 py-2.5 rounded-xl border border-[#234d82]/70 text-right">
              <div className="text-[10px] text-[#7fb2e8] font-mono">NIK Akun</div>
              <div className="text-sm font-mono font-bold text-white">
                {currentUser?.username}
              </div>
            </div>
          </div>
        </div>

        {/* Info Site yang Dapat Diakses */}
        <div className="relative z-10 mt-6 pt-5 border-t border-[#1e4676]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#cfe6ff]/80">
            <Building2 className="w-4 h-4 text-[#ffd23f]" />
            <span>Site Aktif yang Dapat Anda Akses:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {siteList.map((site) => (
              <span
                key={site}
                className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-[#113967]/70 text-[#cfe6ff] border border-[#285791]/60 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#ffd23f]" />
                <span>{site}</span>
              </span>
            ))}
            {siteList.length === 0 && (
              <span className="text-xs text-[#cfe6ff]/60">Tidak ada site terdaftar</span>
            )}
          </div>
        </div>
      </div>

      {/* Grid Seluruh Modul Aplikasi */}
      <div>
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-xs font-bold font-mono text-[#0c2e57] dark:text-[#7fb2e8] uppercase tracking-wider">
            Daftar Modul Sistem Mesin
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Pilih modul untuk mulai bekerja
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((mod) => {
            const Icon = mod.icon;
            if (mod.allowed) {
              return (
                <div
                  key={mod.id}
                  onClick={() => onNavigateTab(mod.id)}
                  className="bg-white dark:bg-[#0c2445]/90 border border-slate-200/90 dark:border-[#1b3d68] hover:border-[#ffd23f] dark:hover:border-[#ffd23f] rounded-2xl p-5 shadow-xs hover:shadow-xl hover:shadow-[#0c2e57]/10 transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#0c2e57] via-[#103b6d] to-[#15467e] text-[#ffd23f] border border-[#254f85]/50 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-[#0c2e57]/5 dark:bg-[#ffd23f]/15 text-[#0c2e57] dark:text-[#ffd23f] border border-[#0c2e57]/15 dark:border-[#ffd23f]/30">
                        {mod.badge}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight group-hover:text-[#0c2e57] dark:group-hover:text-[#ffd23f] transition-colors">
                      {mod.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-[#cfe6ff]/70 mt-1.5 leading-relaxed">
                      {mod.desc}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#1a385f] flex items-center justify-between text-xs font-bold text-[#0c2e57] dark:text-[#ffd23f]">
                    <span>Buka Modul</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            }

            // Kartu Modul Terkunci
            return (
              <div
                key={mod.id}
                className="bg-slate-50 dark:bg-[#07172c]/50 border border-dashed border-slate-200 dark:border-[#193252] rounded-2xl p-5 opacity-60 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-200 dark:bg-[#0a1f38] text-slate-400 dark:text-slate-500 flex items-center justify-center">
                      <Lock className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-200 dark:bg-[#0c223c] text-slate-500">
                      Terkunci
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 tracking-tight">
                    {mod.title}
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 leading-relaxed">
                    {mod.desc}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/50 dark:border-[#142841] text-[11px] font-mono text-slate-400 dark:text-slate-500">
                  {mod.lockedNote || 'Akses dibatasi untuk otoritas Anda'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HomeView;
