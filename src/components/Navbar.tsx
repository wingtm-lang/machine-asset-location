import React, { useState } from 'react';
import {
  QrCode,
  Zap,
  Languages,
  UserCheck,
  LogOut,
  Menu,
  X,
  Building2,
  Boxes,
  ArrowRightLeft,
  ClipboardCheck,
  History,
  FileText,
  ShieldAlert,
  LayoutDashboard,
  Layers,
  Palette,
  Grid,
} from 'lucide-react';
import { useAuth } from '../services/authContext';
import { useTheme } from '../services/themeContext';
import { getTranslation } from '../services/translations';
import { storageService } from '../services/storage';

interface NavbarProps {
  currentTab?: string;
  activeTab?: string;
  setCurrentTab?: (tab: string) => void;
  onSelectTab?: (tab: string) => void;
  onOpenScanner: () => void;
  onOpenBenchmark: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  activeTab,
  setCurrentTab,
  onSelectTab,
  onOpenScanner,
  onOpenBenchmark,
}) => {
  const current = activeTab || currentTab || 'dashboard';
  const handleTabSelect = onSelectTab || setCurrentTab || (() => {});
  const { currentUser, language, setLanguage, logout, canPerformAction } = useAuth();
  const { themePreset, setThemePreset, isSkyCyan, isSageEmerald } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isSkyCyanActive = isSkyCyan || themePreset === 'sky_cyan';

  const navItems = [
    { id: 'dashboard', labelKey: 'dashboard', icon: LayoutDashboard, show: true },
    { id: 'machines', labelKey: 'machines', icon: Boxes, show: true },
    { id: 'rackmap', labelKey: 'rackmap', icon: Grid, show: true },
    { id: 'move', labelKey: 'move', icon: Layers, show: canPerformAction('MOVE') || canPerformAction('CHANGE_STATUS') },
    { id: 'transfers', labelKey: 'transfers', icon: ArrowRightLeft, show: canPerformAction('TRANSFER') },
    { id: 'opname', labelKey: 'opname', icon: ClipboardCheck, show: canPerformAction('OPNAME') },
    { id: 'history', labelKey: 'history', icon: History, show: true },
    { id: 'reports', labelKey: 'reports', icon: FileText, show: canPerformAction('REPORTS') },
    { id: 'admin', labelKey: 'admin', icon: ShieldAlert, show: canPerformAction('ADMIN') },
  ];

  const headerBgClass = isSkyCyanActive
    ? 'bg-[#0284c7] text-white border-b border-sky-600 shadow-lg'
    : isSageEmerald
    ? 'bg-[#064e3b] text-white border-b border-emerald-800/80 shadow-lg'
    : themePreset === 'clean_light'
    ? 'bg-white text-slate-800 border-b border-slate-200 shadow-md'
    : themePreset === 'midnight_navy'
    ? 'bg-[#0f172a] text-slate-100 border-b border-slate-800 shadow-xl'
    : 'bg-slate-900/95 text-slate-100 border-b border-slate-800 shadow-xl';

  const navActiveItemClass = isSkyCyanActive
    ? 'bg-white text-sky-950 font-black shadow-md shadow-sky-950/20'
    : isSageEmerald
    ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-950/40 border border-emerald-400/40'
    : themePreset === 'clean_light'
    ? 'bg-emerald-600 text-white font-bold shadow-sm'
    : 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/25';

  const navInactiveItemClass = isSkyCyanActive
    ? 'text-sky-100 hover:text-white hover:bg-sky-700/60'
    : isSageEmerald
    ? 'text-emerald-100/80 hover:text-white hover:bg-emerald-800/60'
    : themePreset === 'clean_light'
    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    : 'text-slate-300 hover:text-white hover:bg-slate-800/80';

  return (
    <header className={`sticky top-0 z-40 backdrop-blur-md ${headerBgClass}`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleTabSelect('dashboard')}
              className="flex items-center gap-2.5 text-left group focus:outline-none"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-400 to-teal-200 p-0.5 shadow-lg group-hover:scale-105 transition-transform">
                <div className="w-full h-full bg-[#064e3b] rounded-[10px] flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-emerald-300" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight text-white group-hover:text-emerald-300 transition-colors">
                    PT.WINNERS
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                    ASSET TRACKER
                  </span>
                </div>
                <p className="text-xs text-emerald-200/70 hidden sm:block">
                  PW1 • PW2 • PW3 • WH2 • SW • QA
                </p>
              </div>
            </button>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems
              .filter((item) => item.show)
              .map((item) => {
                const Icon = item.icon;
                const isActive = current === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabSelect(item.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isActive ? navActiveItemClass : navInactiveItemClass
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : isSageEmerald ? 'text-emerald-300' : 'text-slate-400'}`} />
                    <span>{getTranslation(item.labelKey, language)}</span>
                  </button>
                );
              })}
          </nav>

          {/* Action Tools & User Menu */}
          <div className="flex items-center gap-2">
            {/* Quick QR Scanner Button */}
            <button
              onClick={onOpenScanner}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-bold shadow-md shadow-emerald-950/30 transition-all hover:scale-105 active:scale-95"
              title="Buka Pemindai QR & Barcode"
            >
              <QrCode className="w-4 h-4" />
              <span className="hidden sm:inline">{getTranslation('scan', language)}</span>
            </button>

            {/* Speed Benchmark Button */}
            <button
              onClick={onOpenBenchmark}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                isSageEmerald
                  ? 'bg-emerald-950/60 hover:bg-emerald-950 text-amber-300 border border-emerald-700/60'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30'
              }`}
              title="Benchmark 5.700 Mesin (Fase 0)"
            >
              <Zap className="w-3.5 h-3.5 fill-amber-400" />
              <span className="hidden lg:inline">5.7k Benchmark</span>
            </button>

            {/* Theme Quick Switcher */}
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
              className={`p-1.5 rounded-xl border text-xs font-semibold ${
                isSageEmerald
                  ? 'bg-emerald-950/60 hover:bg-emerald-950 text-emerald-200 border-emerald-700/60'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              title={`Beralih Tema (Saat ini: ${themePreset})`}
            >
              <Palette className="w-3.5 h-3.5 text-emerald-300" />
            </button>

            {/* Language Switcher */}
            <button
              onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold ${
                isSageEmerald
                  ? 'bg-emerald-950/60 hover:bg-emerald-950 text-emerald-100 border-emerald-700/60'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              title="Ganti Bahasa (ID / EN)"
            >
              <Languages className="w-3.5 h-3.5 text-emerald-300" />
              <span>{language.toUpperCase()}</span>
            </button>

            {/* User Quick Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs text-left ${
                  isSageEmerald
                    ? 'bg-emerald-950/70 hover:bg-emerald-950 text-emerald-100 border-emerald-700/60'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                <div className="w-6 h-6 rounded-lg bg-emerald-500/30 border border-emerald-400 flex items-center justify-center text-emerald-200 font-bold text-[11px]">
                  {currentUser?.displayName?.[0] || 'U'}
                </div>
                <div className="hidden xl:block max-w-[120px] truncate">
                  <div className="font-bold truncate">{currentUser?.username}</div>
                  <div className="text-[10px] text-emerald-300/80 truncate">{currentUser?.role}</div>
                </div>
              </button>

              {userMenuOpen && (
                <div
                  className={`absolute right-0 mt-2 w-60 rounded-2xl shadow-2xl border p-2 z-50 ${
                    isSageEmerald
                      ? 'bg-emerald-950 border-emerald-700/80 text-white'
                      : 'bg-slate-900 border-slate-800 text-white'
                  }`}
                >
                  <div className="p-2 border-b border-emerald-800/60 mb-1">
                    <div className="font-bold text-xs">{currentUser?.displayName}</div>
                    <div className="text-[11px] text-emerald-300">NIK: @{currentUser?.username}</div>
                    <div className="text-[10px] text-emerald-200/70 mt-0.5">
                      Role: {currentUser?.role}
                    </div>
                    <div className="text-[10px] text-emerald-200/70">
                      Site: {currentUser?.siteAccess.join(', ')}
                    </div>
                  </div>

                  <div className="pt-1">
                    <button
                      onClick={() => {
                        logout();
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-bold text-rose-300 hover:bg-rose-950/40 hover:text-rose-200 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{getTranslation('logout', language)}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Hamburger Toggle */}
            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-1.5 rounded-lg bg-emerald-950 border border-emerald-700/60 text-white"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden px-3 pt-2 pb-4 space-y-1 border-t border-emerald-800/60 bg-emerald-950">
          {navItems
            .filter((item) => item.show)
            .map((item) => {
              const Icon = item.icon;
              const isActive = current === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    handleTabSelect(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold ${
                    isActive ? navActiveItemClass : navInactiveItemClass
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{getTranslation(item.labelKey, language)}</span>
                </button>
              );
            })}
        </div>
      )}
    </header>
  );
};
