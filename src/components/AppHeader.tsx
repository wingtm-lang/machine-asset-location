import React, { useState } from 'react';
import { useAuth } from '../services/authContext';
import {
  Menu,
  QrCode,
  Zap,
  KeyRound,
  LogOut,
  ChevronDown,
  Building2,
  LayoutGrid,
  LayoutDashboard,
  Boxes,
  Grid,
  Layers,
  ArrowRightLeft,
  ClipboardCheck,
  FileText,
  Users,
  ShieldAlert,
} from 'lucide-react';

interface AppHeaderProps {
  activeTab: string;
  onOpenMobileSidebar: () => void;
  onOpenScanner: () => void;
  onOpenBenchmark: () => void;
  onOpenChangePassword: () => void;
  onOpenLogout?: () => void;
}

const TAB_TITLES: Record<string, { title: string; subtitle: string; icon: any }> = {
  home: { title: 'Beranda', subtitle: 'Ringkasan Sistem & Modul Asset', icon: LayoutGrid },
  dashboard: { title: 'Dashboard Asset', subtitle: 'Metrik & Distribusi Mesin Pabrik', icon: LayoutDashboard },
  machines: { title: 'Data Mesin', subtitle: 'Inventaris 5.700+ Mesin Jahit', icon: Boxes },
  rackmap: { title: 'WH2 Rack Map', subtitle: 'Denah Visual Rak R1–R6 Warehouse 2', icon: Grid },
  move: { title: 'Pindahkan Lokasi', subtitle: 'Mutasi Posisi Line & Rak', icon: Layers },
  transfers: { title: 'Transfer Antar Site', subtitle: 'Kirim & Terima Antar Pabrik', icon: ArrowRightLeft },
  opname: { title: 'Stok Opname', subtitle: 'Rekonsiliasi Fisik Mesin', icon: ClipboardCheck },
  reports: { title: 'Laporan & Riwayat', subtitle: 'Log Mutasi & Riwayat Transfer', icon: FileText },
  users: { title: 'Kelola Pengguna', subtitle: 'Manajemen Akun & Otoritas', icon: Users },
  admin: { title: 'Admin & Integrasi GAS', subtitle: 'Sinkronisasi Backend Google Sheet', icon: ShieldAlert },
};

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeTab,
  onOpenMobileSidebar,
  onOpenScanner,
  onOpenBenchmark,
  onOpenChangePassword,
  onOpenLogout,
}) => {
  const { currentUser, logout } = useAuth();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const currentInfo = TAB_TITLES[activeTab] || {
    title: 'Machine Asset Management',
    subtitle: 'PT. WINNERS INTERNATIONAL',
    icon: Building2,
  };
  const CurrentIcon = currentInfo.icon;

  const handleLogout = () => {
    if (onOpenLogout) {
      onOpenLogout();
    } else {
      logout();
    }
  };

  return (
    <header className="sticky top-0 z-20 border-b border-[#1b4377] bg-gradient-to-r from-[#0c2e57] via-[#0e3360] to-[#0a2547] text-white shadow-sm h-16 flex items-center px-4 sm:px-6">
      <div className="w-full flex items-center justify-between gap-3">
        {/* Sisi Kiri: Tombol Hamburger Mobile + Judul Tab Aktif */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Tombol Hamburger di layar mobile/tablet untuk membuka Sidebar */}
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="md:hidden p-2 rounded-xl border border-[#2b5993]/80 bg-[#103561]/80 hover:bg-[#164883] text-[#cfe6ff] transition-colors cursor-pointer shrink-0"
            title="Buka Menu Navigasi Sidebar"
            aria-label="Buka Menu Navigasi Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Info Halaman / Breadcrumbs Modul */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#143e70] text-[#ffd23f] border border-[#2b5993]/70 flex items-center justify-center shrink-0 shadow-inner">
              <CurrentIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-sm sm:text-base tracking-tight leading-tight truncate text-white">
                {currentInfo.title}
              </div>
              <div className="text-[11px] text-[#cfe6ff]/75 font-mono truncate hidden sm:block">
                {currentInfo.subtitle}
              </div>
            </div>
          </div>
        </div>

        {/* Sisi Kanan: Action Buttons & Profil User */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Tombol Scan QR / Barcode Cepat Aksen Emas Blueprint */}
          <button
            type="button"
            onClick={onOpenScanner}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#ffd23f] to-[#f59e0b] hover:from-[#ffe066] hover:to-[#fbbf24] text-[#0c2e57] text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer"
            title="Pindai QR / Barcode Mesin"
          >
            <QrCode className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="hidden sm:inline">Scan</span>
          </button>

          {/* Tombol Uji Kecepatan 5.7k */}
          <button
            type="button"
            onClick={onOpenBenchmark}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-[#ffd23f]/30 bg-[#ffd23f]/10 text-[#ffd23f] hover:bg-[#ffd23f]/20 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Speed Benchmark 5.700 Mesin"
          >
            <Zap className="w-3.5 h-3.5 fill-[#ffd23f] text-[#ffd23f]" />
            <span className="hidden lg:inline">5.7k Test</span>
          </button>

          {/* User Profile Pill & Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-xl border border-[#2b5993]/70 bg-[#103561]/70 hover:bg-[#164883]/80 text-white text-xs cursor-pointer transition-colors shadow-2xs"
            >
              <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-[#ffd23f] to-[#f59e0b] text-[#0c2e57] flex items-center justify-center font-black text-[11px] shrink-0">
                {currentUser?.displayName?.[0] || 'U'}
              </div>
              <div className="hidden sm:block text-left max-w-[120px] truncate leading-tight">
                <div className="font-bold truncate text-xs text-white">{currentUser?.displayName}</div>
                <div className="text-[9px] text-[#ffd23f] font-mono uppercase">{currentUser?.role}</div>
              </div>
              <ChevronDown className="w-3 h-3 text-[#7fb2e8] opacity-80" />
            </button>

            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl shadow-2xl border bg-gradient-to-b from-[#0e2c52] to-[#07182f] border-[#2b5993] p-2 z-50 text-white animate-in fade-in slide-in-from-top-2">
                <div className="p-2 border-b border-[#1f487a] mb-1">
                  <div className="font-bold text-xs text-white">{currentUser?.displayName}</div>
                  <div className="text-[11px] text-[#7fb2e8] font-mono">NIK: {currentUser?.username}</div>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#ffd23f]/20 text-[#ffd23f] border border-[#ffd23f]/30 font-semibold uppercase">
                      {currentUser?.role}
                    </span>
                    <span className="text-[9px] text-[#cfe6ff]/70 font-mono">
                      Site: {currentUser?.siteAccess?.join(', ')}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setUserDropdownOpen(false);
                    onOpenChangePassword();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-[#cfe6ff] hover:text-white hover:bg-white/10 cursor-pointer text-left transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5 text-[#ffd23f]" />
                  <span>Ubah Password</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUserDropdownOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:text-rose-100 hover:bg-rose-950/50 cursor-pointer text-left transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Keluar dari Sistem</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
