import React, { useState, useEffect } from 'react';
import { useAuth } from './services/authContext';
import { storageService } from './services/storage';
import { AppHeader } from './components/AppHeader';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './components/LoginPage';
import { HomeView } from './views/HomeView';
import { RackMapView } from './views/RackMapView';
import { UserManagementView } from './views/UserManagementView';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { LogoutModal } from './components/LogoutModal';
import { ScannerModal } from './components/ScannerModal';
import { MachineDetailModal } from './components/MachineDetailModal';
import { SpeedBenchmarkModal } from './components/SpeedBenchmarkModal';
import { DashboardView } from './views/DashboardView';
import { MachinesListView } from './views/MachinesListView';
import { MoveView } from './views/MoveView';
import { TransfersView } from './views/TransfersView';
import { OpnameView } from './views/OpnameView';
import { HistoryView } from './views/HistoryView';
import { ReportsView } from './views/ReportsView';
import { AdminView } from './views/AdminView';
import { Machine } from './types';
import {
  ShieldAlert,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';

const MainAppInner: React.FC = () => {
  const {
    currentUser,
    isLoadingSession,
    authToast,
    clearAuthToast,
    canAddUser,
    canUseRackMap,
    canPerformAction,
  } = useAuth();

  // Navigation state: Default to 'home' (Beranda)
  const [activeTab, setActiveTab] = useState<string>('home');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [, setSyncTick] = useState<number>(0);

  // Auto-subscribe to storage database changes and sync status
  useEffect(() => {
    const unsubStorage = storageService.subscribe(() => {
      setSyncTick((prev) => prev + 1);
    });
    const unsubSync = storageService.subscribeSyncStatus((syncing) => {
      setIsSyncing(syncing);
    });
    return () => {
      unsubStorage();
      unsubSync();
    };
  }, []);

  // Sync data otomatis setelah login atau setelah sesi dipulihkan (dengan parameter force = true)
  useEffect(() => {
    if (!isLoadingSession && currentUser) {
      storageService.triggerAutoBackgroundSync(true);
    }
  }, [isLoadingSession, currentUser?.username]);

  // Modals state
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState<boolean>(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState<boolean>(false);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState<boolean>(false);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);

  // Move / Transfer batches
  const [movePreselectedMachine, setMovePreselectedMachine] = useState<Machine | null>(null);
  const [moveBatchMachines, setMoveBatchMachines] = useState<Machine[]>([]);
  const [transferBatchMachines, setTransferBatchMachines] = useState<Machine[]>([]);

  const handleOpenDetail = (machine: Machine) => {
    setSelectedMachine(machine);
    setIsDetailOpen(true);
  };

  const handleMoveSingle = (machine: Machine) => {
    setMovePreselectedMachine(machine);
    setMoveBatchMachines([]);
    setActiveTab('move');
  };

  const handleMoveBatch = (machines: Machine[]) => {
    setMovePreselectedMachine(null);
    setMoveBatchMachines(machines);
    setActiveTab('move');
  };

  const handleTransferBatch = (machines: Machine[]) => {
    setTransferBatchMachines(machines);
    setActiveTab('transfers');
  };

  // 1. Tampilkan loading spinner jika sedang memeriksa sesi ME
  if (isLoadingSession) {
    return (
      <div className="min-h-screen bg-[#0c2e57] flex flex-col items-center justify-center text-white space-y-3 font-mono">
        <Loader2 className="w-8 h-8 animate-spin text-[#ffd23f]" />
        <div className="text-sm font-semibold tracking-wider">Memeriksa sesi...</div>
      </div>
    );
  }

  // 2. Jika tidak ada user login, tampilkan halaman Login Blueprint
  if (!currentUser) {
    return (
      <>
        <LoginPage />
        {/* Toast Pesan Global jika ada sesi berakhir */}
        {authToast && (
          <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
            <div
              className={`px-4 py-2.5 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 max-w-sm ${
                authToast.type === 'error'
                  ? 'bg-rose-900 text-white border-rose-700'
                  : 'bg-slate-900 text-white border-slate-700'
              }`}
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="flex-1">{authToast.text}</span>
              <button
                type="button"
                onClick={clearAuthToast}
                className="opacity-70 hover:opacity-100 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // 3. Tampilan Terotentikasi (Sidebar Navigation + Topbar + Konten Modul)
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#edf3fa] via-[#e5eef9] to-[#d8e6f7] dark:from-[#061529] dark:via-[#09203d] dark:to-[#0c2a4f] text-[#0c2e57] dark:text-slate-100 flex antialiased selection:bg-[#ffd23f] selection:text-[#0c2e57]">
      {/* Sidebar Navigation Menu */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenBenchmark={() => setIsBenchmarkOpen(true)}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
        onOpenLogout={() => setIsLogoutOpen(true)}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Area Konten Utama dengan Topbar */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Sleek Topbar Header */}
        <AppHeader
          activeTab={activeTab}
          isSyncing={isSyncing}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenScanner={() => setIsScannerOpen(true)}
          onOpenBenchmark={() => setIsBenchmarkOpen(true)}
          onOpenChangePassword={() => setIsChangePasswordOpen(true)}
          onOpenLogout={() => setIsLogoutOpen(true)}
        />

        {/* Konten Modul */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 overflow-x-hidden">
        {/* Modul 1: Beranda */}
        {activeTab === 'home' && (
          <HomeView
            onNavigateTab={setActiveTab}
            onOpenScanner={() => setIsScannerOpen(true)}
            onOpenBenchmark={() => setIsBenchmarkOpen(true)}
          />
        )}

        {/* Modul 2: WH2 Rack Map (Dengan Guard canUseRackMap) */}
        {activeTab === 'rackmap' && (
          canUseRackMap ? (
            <RackMapView onOpenScanner={() => setIsScannerOpen(true)} />
          ) : (
            <div className="max-w-xl mx-auto py-16 px-4 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs my-6">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-200 dark:border-amber-800">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Anda tidak memiliki akses ke halaman ini
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
                Akun Anda ({currentUser.role}) dibatasi hanya untuk site {currentUser.siteAccess.join(', ')}.
                Modul WH2 Rack Map khusus untuk pengguna Warehouse 2 (Admin Master &amp; All Sites).
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('home')}
                className="mt-6 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                Kembali ke Beranda
              </button>
            </div>
          )
        )}

        {/* Modul 3: Kelola Pengguna (Dengan Guard canAddUser / Admin Master) */}
        {activeTab === 'users' && <UserManagementView />}

        {/* Modul Pendukung Lainnya jika dibuka melalui aksi */}
        {activeTab === 'dashboard' && (
          <DashboardView
            onNavigateTab={setActiveTab}
            onSelectMachine={handleOpenDetail}
            onOpenScanner={() => setIsScannerOpen(true)}
          />
        )}

        {activeTab === 'machines' && (
          <MachinesListView
            onSelectMachine={handleOpenDetail}
            onOpenScanner={() => setIsScannerOpen(true)}
            onMoveBatch={handleMoveBatch}
            onTransferBatch={handleTransferBatch}
          />
        )}

        {activeTab === 'move' && canPerformAction('MOVE') && (
          <MoveView
            initialMachine={movePreselectedMachine}
            batchMachines={moveBatchMachines}
            onSuccessDone={() => {
              setMovePreselectedMachine(null);
              setMoveBatchMachines([]);
              setActiveTab('machines');
            }}
          />
        )}

        {activeTab === 'transfers' && canPerformAction('TRANSFER') && (
          <TransfersView
            batchMachines={transferBatchMachines}
            onSelectMachine={handleOpenDetail}
          />
        )}

        {activeTab === 'opname' && canPerformAction('OPNAME') && (
          <OpnameView onOpenScanner={() => setIsScannerOpen(true)} />
        )}

        {/* Modul: Riwayat Mesin (Terbuka untuk semua user yang login) */}
        {activeTab === 'history' && (
          <HistoryView
            onSelectMachine={(code) => {
              const res = storageService.getMachineByCode(code);
              if (res.machine) handleOpenDetail(res.machine);
            }}
          />
        )}

        {/* Modul: Laporan Harian (Dengan Guard canPerformAction('REPORTS')) */}
        {activeTab === 'reports' && (
          canPerformAction('REPORTS') ? (
            <ReportsView />
          ) : (
            <div className="max-w-xl mx-auto py-16 px-4 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs my-6">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-200 dark:border-amber-800">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Anda tidak memiliki akses ke halaman ini
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
                Akun Anda ({currentUser.role}) dibatasi hanya untuk site {currentUser.siteAccess.join(', ')}.
                Modul Laporan Harian khusus untuk Admin Master dan All Sites.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('home')}
                className="mt-6 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                Kembali ke Beranda
              </button>
            </div>
          )
        )}

        {activeTab === 'admin' && (canAddUser || canPerformAction('ADMIN')) && <AdminView />}
      </main>
      </div>

      {/* Dialog Ubah Password */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />

      {/* Modal Konfirmasi Keluar dari Sistem */}
      <LogoutModal
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
      />

      {/* Scanner Barcode / QR Modal */}
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSelectMachine={handleOpenDetail}
        onQuickMove={handleMoveSingle}
      />

      {/* Speed Benchmark Modal */}
      <SpeedBenchmarkModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
      />

      {/* Machine Detail Modal */}
      <MachineDetailModal
        machine={selectedMachine}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onMoveClick={handleMoveSingle}
      />

      {/* Floating Auth Toast (FORBIDDEN / UNAUTHORIZED notice) */}
      {authToast && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 max-w-sm ${
              authToast.type === 'error'
                ? 'bg-rose-900 text-white border-rose-700'
                : authToast.type === 'warning'
                ? 'bg-amber-900 text-white border-amber-700'
                : 'bg-slate-900 text-white border-slate-700'
            }`}
          >
            {authToast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : authToast.type === 'warning' ? (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span className="flex-1">{authToast.text}</span>
            <button
              type="button"
              onClick={clearAuthToast}
              className="opacity-70 hover:opacity-100 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return <MainAppInner />;
};

export default App;
