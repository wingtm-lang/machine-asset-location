import React from 'react';
import { useAuth } from '../services/authContext';
import { makeT } from '../services/translations';
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
  onOpenBenchmark?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onNavigateTab,
  onOpenScanner,
}) => {
  const { currentUser, canUseRackMap, canAddUser, canPerformAction, language } = useAuth();
  const t = makeT(language);
  const siteList = currentUser?.siteAccess || [];

  const modules = [
    {
      id: 'dashboard',
      title: t('home_mod_dashboard_title'),
      desc: t('home_mod_dashboard_desc'),
      icon: LayoutDashboard,
      allowed: true,
      badge: t('home_mod_dashboard_badge'),
    },
    {
      id: 'machines',
      title: t('home_mod_machines_title'),
      desc: t('home_mod_machines_desc'),
      icon: Boxes,
      allowed: true,
      badge: t('home_mod_machines_badge'),
    },
    {
      id: 'rackmap',
      title: t('home_mod_rackmap_title'),
      desc: t('home_mod_rackmap_desc'),
      icon: Grid,
      allowed: canUseRackMap,
      badge: t('home_mod_rackmap_badge'),
      lockedNote: t('home_mod_rackmap_locked'),
    },
    {
      id: 'move',
      title: t('home_mod_move_title'),
      desc: t('home_mod_move_desc'),
      icon: Layers,
      allowed: canPerformAction('MOVE') || canPerformAction('CHANGE_STATUS'),
      badge: t('home_mod_move_badge'),
      lockedNote: t('home_mod_move_locked'),
    },
    {
      id: 'transfers',
      title: t('home_mod_transfers_title'),
      desc: t('home_mod_transfers_desc'),
      icon: ArrowRightLeft,
      allowed: canPerformAction('TRANSFER'),
      badge: t('home_mod_transfers_badge'),
      lockedNote: t('home_mod_transfers_locked'),
    },
    {
      id: 'opname',
      title: t('home_mod_opname_title'),
      desc: t('home_mod_opname_desc'),
      icon: ClipboardCheck,
      allowed: canPerformAction('OPNAME'),
      badge: t('home_mod_opname_badge'),
      lockedNote: t('home_mod_opname_locked'),
    },
    {
      id: 'history',
      title: t('home_mod_history_title'),
      desc: t('home_mod_history_desc'),
      icon: History,
      allowed: true,
      badge: t('home_mod_history_badge'),
    },
    {
      id: 'reports',
      title: t('home_mod_reports_title'),
      desc: t('home_mod_reports_desc'),
      icon: FileText,
      allowed: canPerformAction('REPORTS'),
      badge: t('home_mod_reports_badge'),
      lockedNote: t('home_mod_reports_locked'),
    },
    {
      id: 'users',
      title: t('home_mod_users_title'),
      desc: t('home_mod_users_desc'),
      icon: Users,
      allowed: canAddUser,
      badge: t('home_mod_users_badge'),
      lockedNote: t('home_mod_users_locked'),
    },
    {
      id: 'admin',
      title: t('home_mod_admin_title'),
      desc: t('home_mod_admin_desc'),
      icon: ShieldAlert,
      allowed: canPerformAction('ADMIN') || canAddUser,
      badge: t('home_mod_admin_badge'),
      lockedNote: t('home_mod_admin_locked'),
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
              <span>{t('home_authority', { role: currentUser?.role || 'User' })}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {t('home_hello', { name: currentUser?.displayName || t('home_user_fallback') })}
            </h1>
            <p className="text-xs sm:text-sm text-[#cfe6ff]/85 mt-1.5 max-w-2xl leading-relaxed">
              {t('home_welcome_pre')} <strong>MACHINE ASSET MANAGEMENT</strong> {t('home_welcome_post')}
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
                <span>{t('home_scan_barcode')}</span>
              </button>
            )}

            <div className="bg-[#081f3c]/90 px-3.5 py-2.5 rounded-xl border border-[#234d82]/70 text-right">
              <div className="text-[10px] text-[#7fb2e8] font-mono">{t('home_nik')}</div>
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
            <span>{t('home_active_sites')}</span>
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
              <span className="text-xs text-[#cfe6ff]/60">{t('home_no_sites')}</span>
            )}
          </div>
        </div>
      </div>

      {/* Grid Seluruh Modul Aplikasi */}
      <div>
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-xs font-bold font-mono text-[#0c2e57] dark:text-[#7fb2e8] uppercase tracking-wider">
            {t('home_modules_heading')}
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {t('home_pick_module')}
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
                    <span>{t('home_open_module')}</span>
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
                      {t('home_locked')}
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
                  {mod.lockedNote || t('home_restricted')}
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
