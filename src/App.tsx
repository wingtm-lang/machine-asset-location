import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './services/authContext';
import { ThemeProvider, useTheme } from './services/themeContext';
import { storageService } from './services/storage';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { ScannerModal } from './components/ScannerModal';
import { SpeedBenchmarkModal } from './components/SpeedBenchmarkModal';
import { MachineDetailModal } from './components/MachineDetailModal';
import { LoginModal } from './components/LoginModal';
import { DashboardView } from './views/DashboardView';
import { MachinesListView } from './views/MachinesListView';
import { MoveView } from './views/MoveView';
import { TransfersView } from './views/TransfersView';
import { OpnameView } from './views/OpnameView';
import { ReportsView } from './views/ReportsView';
import { AdminView } from './views/AdminView';
import { Machine } from './types';
import { getTranslation } from './services/translations';
import {
  Building2,
  Sparkles,
  QrCode,
  Zap,
  Layers,
  Palette,
  LayoutTemplate,
} from 'lucide-react';

const MainAppInner: React.FC = () => {
  const { currentUser, language, canPerformAction } = useAuth();
  const { themePreset, layoutStyle, setLayoutStyle, isSkyCyan, isSageEmerald, isCleanLight, isMidnightNavy } = useTheme();

  // Navigation state
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [, setSyncTick] = useState<number>(0);

  // Auto-subscribe to storage database changes & live background sync updates
  useEffect(() => {
    const unsubscribe = storageService.subscribe(() => {
      setSyncTick((prev) => prev + 1);
    });
    return () => unsubscribe();
  }, []);

  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState<boolean>(false);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);

  // Move / Transfer pre-selected batches
  const [movePreselectedMachine, setMovePreselectedMachine] = useState<Machine | null>(null);
  const [moveBatchMachines, setMoveBatchMachines] = useState<Machine[]>([]);
  const [transferBatchMachines, setTransferBatchMachines] = useState<Machine[]>([]);

  // Open Machine Details
  const handleOpenDetail = (machine: Machine) => {
    setSelectedMachine(machine);
    setIsDetailOpen(true);
  };

  // Open Move View for Machine
  const handleMoveSingle = (machine: Machine) => {
    setMovePreselectedMachine(machine);
    setMoveBatchMachines([]);
    setActiveTab('move');
  };

  // Open Move View for Batch
  const handleMoveBatch = (machines: Machine[]) => {
    setMovePreselectedMachine(null);
    setMoveBatchMachines(machines);
    setActiveTab('move');
  };

  // Open Transfer View for Batch
  const handleTransferBatch = (machines: Machine[]) => {
    setTransferBatchMachines(machines);
    setActiveTab('transfers');
  };

  const pageBgClass = isSkyCyan || themePreset === 'sky_cyan'
    ? 'bg-[#9be0f0] text-slate-900 selection:bg-cyan-600 selection:text-white'
    : isSageEmerald
    ? 'bg-[#edf3ef] text-slate-800 selection:bg-emerald-600 selection:text-white'
    : isCleanLight
    ? 'bg-slate-100 text-slate-800 selection:bg-emerald-600 selection:text-white'
    : isMidnightNavy
    ? 'bg-[#0b132b] text-slate-100 selection:bg-cyan-600 selection:text-white'
    : 'bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white';

  const isSidebarLayout = layoutStyle === 'sidebar';

  return (
    <div className={`min-h-screen ${pageBgClass} flex ${isSidebarLayout ? 'flex-col md:flex-row' : 'flex-col'} antialiased`}>
      {/* Navigation Layout: Sidebar (Default matching image) or Top Navbar */}
      {isSidebarLayout ? (
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenScanner={() => setIsScannerOpen(true)}
          onOpenBenchmark={() => setIsBenchmarkOpen(true)}
        />
      ) : (
        <Navbar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenScanner={() => setIsScannerOpen(true)}
          onOpenBenchmark={() => setIsBenchmarkOpen(true)}
        />
      )}

      {/* Main Container Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top Header Bar in Sidebar Mode */}
        {isSidebarLayout && (
          <header className={`hidden md:flex items-center justify-between px-6 py-3 border-b ${
            isSkyCyan || themePreset === 'sky_cyan'
              ? 'bg-white/85 backdrop-blur-md border-cyan-200/90 text-slate-800 shadow-sm'
              : isSageEmerald
              ? 'bg-white/80 backdrop-blur-md border-emerald-900/10 text-slate-800 shadow-sm'
              : isCleanLight
              ? 'bg-white border-slate-200 text-slate-800 shadow-sm'
              : isMidnightNavy
              ? 'bg-[#1c2541]/80 backdrop-blur-md border-slate-800 text-slate-100'
              : 'bg-slate-900/80 backdrop-blur-md border-slate-800 text-slate-100'
          }`}>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                isSkyCyan || themePreset === 'sky_cyan'
                  ? 'bg-sky-100 text-sky-900'
                  : isSageEmerald
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-800 text-slate-300'
              }`}>
                {getTranslation(activeTab, language) || activeTab}
              </span>
              <span className="text-xs text-slate-600 font-medium">
                PT.WINNERS Machine Asset Tracking • Live System
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setLayoutStyle('topbar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  isSkyCyan || themePreset === 'sky_cyan'
                    ? 'bg-sky-50 text-sky-900 border-sky-200 hover:bg-sky-100'
                    : isSageEmerald
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
                title="Beralih ke tampilan Header Atas"
              >
                <LayoutTemplate className="w-3.5 h-3.5 text-sky-600" />
                <span>Mode Header</span>
              </button>

              <button
                onClick={() => setIsScannerOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 text-white text-xs font-bold shadow-sm shadow-cyan-800/20 hover:scale-105 active:scale-95 transition-all"
              >
                <QrCode className="w-4 h-4" />
                <span>{getTranslation('scan', language)}</span>
              </button>
            </div>
          </header>
        )}

        {/* Main Content View */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 pb-24">
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

          {activeTab === 'reports' && <ReportsView />}

          {activeTab === 'admin' && currentUser?.role === 'Admin' && <AdminView />}
        </main>
      </div>

      {/* Scanner Modal (2D QR Code & Barcode) */}
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSelectMachine={handleOpenDetail}
        onQuickMove={handleMoveSingle}
      />

      {/* Speed Benchmark Modal (Fase 0 #3) */}
      <SpeedBenchmarkModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
      />

      {/* Machine Details & Asset Badge Modal */}
      <MachineDetailModal
        machine={selectedMachine}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onMoveClick={handleMoveSingle}
      />

      {/* Login Screen Modal (If not logged in) */}
      <LoginModal isOpen={!currentUser} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <MainAppInner />
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;
