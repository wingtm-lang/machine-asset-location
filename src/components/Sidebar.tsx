import React, { useState } from 'react';
import {
  LayoutGrid,
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
  QrCode,
  Zap,
  Languages,
  KeyRound,
  LogOut,
  Building2,
  ChevronRight,
  X,
  Compass,
} from 'lucide-react';
import { useAuth } from '../services/authContext';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onOpenScanner: () => void;
  onOpenBenchmark: () => void;
  onOpenChangePassword: () => void;
  onOpenLogout?: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onOpenScanner,
  onOpenBenchmark,
  onOpenChangePassword,
  onOpenLogout,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const {
    currentUser,
    logout,
    canAddUser,
    canUseRackMap,
    canPerformAction,
    language,
    setLanguage,
  } = useAuth();

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const handleLogout = () => {
    if (onOpenLogout) {
      onOpenLogout();
    } else {
      logout();
    }
  };

  const navItems = [
    { id: 'home', label: 'Beranda', icon: LayoutGrid, show: true, badge: 'Home' },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true, badge: 'Live' },
    { id: 'machines', label: 'Data Mesin', icon: Boxes, show: true, badge: '5.7k' },
    { id: 'rackmap', label: 'WH2 Rack Map', icon: Grid, show: canUseRackMap, badge: 'WH2' },
    {
      id: 'move',
      label: 'Pindahkan Lokasi',
      icon: Layers,
      show: canPerformAction('MOVE') || canPerformAction('CHANGE_STATUS'),
    },
    {
      id: 'transfers',
      label: 'Transfer Site',
      icon: ArrowRightLeft,
      show: canPerformAction('TRANSFER'),
    },
    {
      id: 'opname',
      label: 'Stok Opname',
      icon: ClipboardCheck,
      show: canPerformAction('OPNAME'),
    },
    {
      id: 'history',
      label: 'Riwayat Mesin',
      icon: History,
      show: true,
      badge: 'Live',
    },
    {
      id: 'reports',
      label: 'Laporan Harian',
      icon: FileText,
      show: canPerformAction('REPORTS'),
    },
    {
      id: 'users',
      label: 'Kelola Pengguna',
      icon: Users,
      show: canAddUser,
      badge: 'Admin',
    },
    {
      id: 'admin',
      label: 'Admin GAS',
      icon: ShieldAlert,
      show: canPerformAction('ADMIN') || canAddUser,
    },
  ];

  const handleNavClick = (tabId: string) => {
    onSelectTab(tabId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const content = (
    <div className="flex flex-col h-full justify-between p-4 overflow-y-auto no-scrollbar">
      {/* Bagian Atas: Branding & Action Scan */}
      <div className="space-y-4">
        {/* Brand Header Blueprint Card */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#113867]/90 via-[#0d2d53]/90 to-[#092240]/90 border border-[#285791]/60 shadow-inner backdrop-blur-xs transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#0c2e57] text-[#ffd23f] flex items-center justify-center font-bold text-base shadow-md border border-[#ffd23f]/40 shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm tracking-tight leading-tight uppercase font-sans text-white truncate">
                    PT.WINNERS
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#ffd23f]/20 text-[#ffd23f] border border-[#ffd23f]/40 shrink-0">
                    ASSET
                  </span>
                </div>
                <div className="text-[10px] text-[#cfe6ff]/80 font-mono tracking-wider truncate">
                  PW1 • PW2 • PW3 • WH2
                </div>
              </div>
            </div>

            {/* Tombol Tutup pada Drawer Mobile */}
            {onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="md:hidden p-1.5 rounded-lg text-[#cfe6ff] hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Action: Scan Barcode / QR dengan Aksen Emas Blueprint */}
        <button
          type="button"
          onClick={() => {
            onOpenScanner();
            if (onCloseMobile) onCloseMobile();
          }}
          className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#ffd23f] via-[#ffc720] to-[#f59e0b] hover:from-[#ffe066] hover:to-[#fbbf24] active:scale-98 text-[#0c2e57] text-xs font-black shadow-lg shadow-[#051324]/50 transition-all cursor-pointer"
        >
          <QrCode className="w-4 h-4 stroke-[2.5]" />
          <span>Scan QR / Barcode</span>
        </button>

        {/* Navigation Menu Links */}
        <div className="space-y-1 pt-1">
          <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-[#7fb2e8]/80 mb-2 font-mono flex items-center justify-between">
            <span>Navigation Menu</span>
            <Compass className="w-3 h-3 text-[#7fb2e8]/60" />
          </div>
          {navItems
            .filter((item) => item.show)
            .map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                    isActive
                      ? 'bg-gradient-to-r from-[#194c86] via-[#133e70] to-[#0c2e57] text-white border-l-4 border-[#ffd23f] shadow-md shadow-[#051324]/40 font-bold'
                      : 'text-[#cfe6ff]/80 hover:text-white hover:bg-white/8 hover:translate-x-0.5'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                        isActive ? 'text-[#ffd23f]' : 'text-[#7fb2e8] group-hover:text-white'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-[#ffd23f] text-[#0c2e57] font-bold'
                          : 'bg-[#0f3460]/60 text-[#cfe6ff]/90 border border-[#234b7e]/60'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
        </div>
      </div>

      {/* Bagian Bawah: Profile Card, Quick Tools & Logout */}
      <div className="space-y-3 pt-4 border-t border-[#1d477c]/60 mt-4">
        {/* Quick Tools Row (5.7k Test & Bahasa ID/EN) */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={onOpenBenchmark}
            className="p-2 rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-semibold border border-[#ffd23f]/30 bg-[#ffd23f]/10 hover:bg-[#ffd23f]/20 text-[#ffd23f] transition-all cursor-pointer shadow-2xs"
            title="Speed Benchmark 5.7k Mesin"
          >
            <Zap className="w-3.5 h-3.5 fill-[#ffd23f] text-[#ffd23f]" />
            <span>5.7k Test</span>
          </button>

          <button
            type="button"
            onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
            className="p-2 rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-semibold border border-[#285791]/60 bg-[#0f3460]/50 hover:bg-[#184882]/70 text-[#cfe6ff] transition-all cursor-pointer shadow-2xs"
            title="Ganti Bahasa (ID / EN)"
          >
            <Languages className="w-3.5 h-3.5 text-[#7fb2e8]" />
            <span>{language.toUpperCase()}</span>
          </button>
        </div>

        {/* User Profile Card */}
        <div className="relative">
          <div
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="p-2.5 rounded-2xl cursor-pointer border border-[#234e83]/70 bg-gradient-to-r from-[#0d2a4f]/90 to-[#081e3a]/90 hover:from-[#113766]/90 hover:to-[#0c274b]/90 transition-all flex items-center justify-between shadow-xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#ffd23f] to-[#f59e0b] text-[#0c2e57] flex items-center justify-center font-black text-xs shadow-xs shrink-0">
                {currentUser?.displayName?.[0] || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-xs text-white truncate">
                  {currentUser?.displayName || currentUser?.username}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#ffd23f]/20 text-[#ffd23f] font-semibold uppercase">
                    {currentUser?.role}
                  </span>
                  <span className="text-[9px] text-[#cfe6ff]/60 font-mono truncate">
                    ({currentUser?.username})
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Keluar dari sistem"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLogout();
                }}
                className="p-1 rounded-lg text-rose-300 hover:text-rose-100 hover:bg-rose-900/40 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
              <ChevronRight
                className={`w-4 h-4 text-[#7fb2e8] transition-transform ${
                  userDropdownOpen ? 'rotate-90' : ''
                }`}
              />
            </div>
          </div>

          {/* User Popover Actions */}
          {userDropdownOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-full rounded-2xl shadow-2xl border bg-gradient-to-b from-[#0e2c52] to-[#07182f] border-[#2b5993] p-2 z-50 text-white animate-in fade-in slide-in-from-bottom-2">
              <div className="p-2 border-b border-[#1f487a] mb-1">
                <div className="font-bold text-xs text-white">{currentUser?.displayName}</div>
                <div className="text-[10px] text-[#7fb2e8] font-mono">
                  Site: {currentUser?.siteAccess?.join(', ')}
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
  );

  return (
    <>
      {/* Desktop Persistent Sidebar (Sticky kiri layar) */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 h-screen sticky top-0 z-30 bg-gradient-to-b from-[#0c2e57] via-[#092342] to-[#06182f] text-slate-100 border-r border-[#1a3d6e]/80 shadow-2xl">
        {content}
      </aside>

      {/* Mobile Drawer (Muncul saat tombol menu mobile diklik) */}
      {isOpenMobile && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex animate-in fade-in duration-200">
          <div className="w-72 h-full max-w-[85vw] bg-gradient-to-b from-[#0c2e57] via-[#092342] to-[#06182f] text-slate-100 border-r border-[#1a3d6e] shadow-2xl">
            {content}
          </div>
          <div className="flex-1" onClick={onCloseMobile} />
        </div>
      )}
    </>
  );
};

export default Sidebar;
