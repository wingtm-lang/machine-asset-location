import React, { useState } from 'react';
import {
  QrCode,
  Zap,
  Languages,
  LogOut,
  Building2,
  Boxes,
  ArrowRightLeft,
  ClipboardCheck,
  FileText,
  ShieldAlert,
  LayoutDashboard,
  Layers,
  Palette,
  LayoutTemplate,
  ChevronRight,
  UserCheck,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../services/authContext';
import { useTheme } from '../services/themeContext';
import { getTranslation } from '../services/translations';
import { storageService } from '../services/storage';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onOpenScanner: () => void;
  onOpenBenchmark: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onOpenScanner,
  onOpenBenchmark,
}) => {
  const { currentUser, language, setLanguage, logout, switchUserQuick, canPerformAction } = useAuth();
  const { themePreset, setThemePreset, layoutStyle, setLayoutStyle, isSkyCyan, isSageEmerald } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const users = storageService.getUsers();

  const isSkyCyanActive = isSkyCyan || themePreset === 'sky_cyan';

  const navItems = [
    { id: 'dashboard', labelKey: 'dashboard', icon: LayoutDashboard, show: true, badge: 'Live' },
    { id: 'machines', labelKey: 'machines', icon: Boxes, show: true, badge: '5.7k' },
    { id: 'move', labelKey: 'move', icon: Layers, show: canPerformAction('MOVE') || canPerformAction('CHANGE_STATUS') },
    { id: 'transfers', labelKey: 'transfers', icon: ArrowRightLeft, show: canPerformAction('TRANSFER') },
    { id: 'opname', labelKey: 'opname', icon: ClipboardCheck, show: canPerformAction('OPNAME') },
    { id: 'reports', labelKey: 'reports', icon: FileText, show: canPerformAction('REPORTS') },
    { id: 'admin', labelKey: 'admin', icon: ShieldAlert, show: canPerformAction('ADMIN') },
  ];

  const sidebarThemeClass = isSkyCyanActive
    ? 'bg-[#0284c7] text-sky-50 border-r border-sky-700/60 shadow-2xl'
    : isSageEmerald
    ? 'bg-[#064e3b] text-emerald-50 border-r border-emerald-800/60 shadow-2xl'
    : themePreset === 'clean_light'
    ? 'bg-white text-slate-800 border-r border-slate-200 shadow-md'
    : themePreset === 'midnight_navy'
    ? 'bg-[#0f172a] text-slate-100 border-r border-slate-800 shadow-2xl'
    : 'bg-slate-900 text-slate-100 border-r border-slate-800 shadow-2xl';

  const brandBgClass = isSkyCyanActive
    ? 'bg-sky-950/40 border border-sky-300/40 shadow-inner backdrop-blur-sm'
    : isSageEmerald
    ? 'bg-emerald-950/80 border border-emerald-700/50 shadow-inner'
    : themePreset === 'clean_light'
    ? 'bg-slate-50 border border-slate-200'
    : 'bg-slate-950/80 border border-slate-800';

  const activeNavItemClass = isSkyCyanActive
    ? 'bg-white text-sky-950 font-black shadow-lg shadow-sky-950/20 border border-sky-200/80'
    : isSageEmerald
    ? 'bg-emerald-600/90 text-white font-bold shadow-lg shadow-emerald-950/40 border border-emerald-400/30 ring-1 ring-emerald-400/20'
    : themePreset === 'clean_light'
    ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/20'
    : 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30';

  const inactiveNavItemClass = isSkyCyanActive
    ? 'text-sky-100 hover:text-white hover:bg-sky-700/60'
    : isSageEmerald
    ? 'text-emerald-100/80 hover:text-white hover:bg-emerald-800/60'
    : themePreset === 'clean_light'
    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    : 'text-slate-300 hover:text-white hover:bg-slate-800/70';

  const handleTabClick = (tabId: string) => {
    onSelectTab(tabId);
    setMobileMenuOpen(false);
  };

  const navContent = (
    <div className="flex flex-col h-full justify-between p-4 overflow-y-auto">
      {/* Brand Header */}
      <div className="space-y-4">
        <div className={`p-3.5 rounded-2xl ${brandBgClass} transition-all`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-400 to-teal-200 p-0.5 shadow-md shrink-0">
              <div className="w-full h-full bg-[#064e3b] rounded-[10px] flex items-center justify-center">
                <Building2 className="w-5 h-5 text-emerald-300" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm tracking-tight text-white uppercase truncate">
                  PT.WINNERS
                </span>
                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 shrink-0">
                  ASSET
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/70 font-medium truncate">
                PW1 • PW2 • PW3 • WH2
              </p>
            </div>
          </div>
        </div>

        {/* Quick Action Button: Scanner */}
        <button
          onClick={onOpenScanner}
          className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-black shadow-lg shadow-emerald-950/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <QrCode className="w-4 h-4" />
          <span>{getTranslation('scan', language)} QR / BARCODE</span>
        </button>

        {/* Navigation Items */}
        <div className="space-y-1 pt-1">
          <div className="px-2 text-[10px] font-black uppercase tracking-wider text-emerald-300/60 mb-2">
            Menu Navigasi
          </div>
          {navItems
            .filter((item) => item.show)
            .map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                    isActive ? activeNavItemClass : inactiveNavItemClass
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                        isActive
                          ? 'text-white'
                          : isSageEmerald
                          ? 'text-emerald-300'
                          : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{getTranslation(item.labelKey, language)}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : isSageEmerald
                          ? 'bg-emerald-900/60 text-emerald-300'
                          : 'bg-slate-800 text-slate-300'
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

      {/* Footer Controls & User Profile */}
      <div className="space-y-3 pt-4 border-t border-emerald-800/40">
        {/* Quick Tools Row: Benchmark, Language, Theme Quick Toggle */}
        <div className="grid grid-cols-3 gap-1.5 text-xs">
          <button
            onClick={onOpenBenchmark}
            className={`p-2 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-bold border transition-all ${
              isSageEmerald
                ? 'bg-emerald-950/40 border-emerald-700/40 text-amber-300 hover:bg-emerald-900/60'
                : 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700'
            }`}
            title="Benchmark 5.700 Mesin (Fase 0)"
          >
            <Zap className="w-3.5 h-3.5 fill-amber-300" />
            <span>5.7k</span>
          </button>

          <button
            onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
            className={`p-2 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-bold border transition-all ${
              isSageEmerald
                ? 'bg-emerald-950/40 border-emerald-700/40 text-emerald-200 hover:bg-emerald-900/60'
                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
            }`}
            title="Ganti Bahasa (ID / EN)"
          >
            <Languages className="w-3.5 h-3.5 text-emerald-400" />
            <span>{language.toUpperCase()}</span>
          </button>

          <button
            onClick={() => {
              const presets: ('sky_cyan' | 'sage_emerald' | 'dark_slate' | 'clean_light' | 'midnight_navy')[] = [
                'sky_cyan',
                'sage_emerald',
                'dark_slate',
                'clean_light',
                'midnight_navy',
              ];
              const next = presets[(presets.indexOf(themePreset) + 1) % presets.length];
              setThemePreset(next);
            }}
            className={`p-2 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-bold border transition-all ${
              isSageEmerald
                ? 'bg-emerald-950/40 border-emerald-700/40 text-emerald-200 hover:bg-emerald-900/60'
                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
            }`}
            title={`Tema: ${themePreset}. Klik untuk beralih mode tema.`}
          >
            <Palette className="w-3.5 h-3.5 text-emerald-300" />
            <span className="truncate max-w-[45px]">Tema</span>
          </button>
        </div>

        {/* User Card */}
        <div className="relative">
          <div
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={`p-2.5 rounded-2xl cursor-pointer border transition-all flex items-center justify-between ${
              isSageEmerald
                ? 'bg-emerald-950/60 hover:bg-emerald-950/90 border-emerald-700/50'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-400 to-teal-200 flex items-center justify-center text-emerald-950 font-black text-xs shadow shrink-0">
                {currentUser?.displayName?.[0] || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-black text-xs text-white truncate">
                  {currentUser?.displayName || currentUser?.username}
                </div>
                <div className="text-[10px] font-bold text-emerald-300 truncate">
                  {currentUser?.role}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-emerald-300/60" />
          </div>

          {/* User Popover Menu */}
          {userMenuOpen && (
            <div
              className={`absolute bottom-full left-0 mb-2 w-64 rounded-2xl shadow-2xl border p-2.5 z-50 ${
                isSageEmerald
                  ? 'bg-emerald-950 border-emerald-700/80 text-white'
                  : 'bg-slate-900 border-slate-700 text-white'
              }`}
            >
              <div className="p-2 border-b border-emerald-800/60 mb-2">
                <div className="text-xs font-bold text-white">{currentUser?.displayName}</div>
                <div className="text-[11px] text-emerald-300 font-mono">@{currentUser?.username}</div>
                <div className="text-[10px] text-emerald-200/70 mt-0.5">
                  Akses Site: {currentUser?.siteAccess.join(', ')}
                </div>
              </div>

              <div className="text-[10px] font-bold uppercase text-emerald-300/60 px-2 mb-1">
                Ganti Akun Cepat:
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {users.map((u) => (
                  <button
                    key={u.username}
                    onClick={() => {
                      switchUserQuick(u.username);
                      setUserMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      u.username === currentUser?.username
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'text-emerald-100 hover:bg-emerald-900/60'
                    }`}
                  >
                    <div className="truncate text-left">
                      <div className="font-semibold text-[11px] truncate">{u.displayName}</div>
                      <div className="text-[9px] text-emerald-300 truncate">{u.role}</div>
                    </div>
                    {u.username === currentUser?.username && <UserCheck className="w-3 h-3 text-white shrink-0" />}
                  </button>
                ))}
              </div>

              <div className="mt-2 pt-2 border-t border-emerald-800/60">
                <button
                  onClick={() => {
                    logout();
                    setUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-300 hover:bg-rose-950/40 hover:text-rose-200"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{getTranslation('logout', language)}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className={`hidden md:flex flex-col w-64 shrink-0 h-screen sticky top-0 ${sidebarThemeClass}`}>
        {navContent}
      </aside>

      {/* Mobile Top Header with Hamburger */}
      <div className={`md:hidden sticky top-0 z-40 px-4 py-3 flex items-center justify-between ${sidebarThemeClass}`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-400 to-teal-200 p-0.5">
            <div className="w-full h-full bg-[#064e3b] rounded-[6px] flex items-center justify-center">
              <Building2 className="w-4 h-4 text-emerald-300" />
            </div>
          </div>
          <div>
            <div className="font-black text-xs text-white">PT.WINNERS</div>
            <div className="text-[9px] text-emerald-200/70 font-mono">ASSET TRACKER</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenScanner}
            className="p-2 rounded-lg bg-emerald-600 text-white shadow"
            title="Scan QR"
          >
            <QrCode className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-emerald-950 border border-emerald-700/60 text-white"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex">
          <div className={`w-72 h-full ${sidebarThemeClass}`}>
            {navContent}
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}
    </>
  );
};
