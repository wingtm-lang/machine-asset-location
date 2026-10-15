import React, { useState } from 'react';
import { X, Zap, CheckCircle2, Play, Activity, Database } from 'lucide-react';
import { storageService } from '../services/storage';
import { useAuth } from '../services/authContext';
import { makeT } from '../services/translations';

interface SpeedBenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BenchmarkResult {
  iterations: number;
  totalMachines: number;
  avgTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  p95TimeMs: number;
  passed: boolean;
  samples: { query: string; timeMs: number; found: string }[];
}

export const SpeedBenchmarkModal: React.FC<SpeedBenchmarkModalProps> = ({ isOpen, onClose }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const { language } = useAuth();
  const t = makeT(language);

  if (!isOpen) return null;

  const runBenchmark = () => {
    setIsRunning(true);
    setResult(null);

    setTimeout(() => {
      const machines = storageService.getAllMachines();
      const totalMachines = machines.length;
      const iterations = 100;
      const times: number[] = [];
      const samples: { query: string; timeMs: number; found: string }[] = [];

      for (let i = 0; i < iterations; i++) {
        // Pick random machine
        const randIndex = Math.floor(Math.random() * totalMachines);
        const target = machines[randIndex];
        const query = i % 2 === 0 ? target.barcode : target.assetCode;

        const { machine, searchTimeMs } = storageService.getMachineByCode(query);
        times.push(searchTimeMs);

        if (i < 8) {
          samples.push({
            query,
            timeMs: searchTimeMs,
            found: machine ? machine.standardMachineName : 'Not Found',
          });
        }
      }

      times.sort((a, b) => a - b);
      const sum = times.reduce((a, b) => a + b, 0);
      const avgTimeMs = Number((sum / times.length).toFixed(3));
      const minTimeMs = times[0];
      const maxTimeMs = times[times.length - 1];
      const p95TimeMs = times[Math.floor(times.length * 0.95)];
      const passed = avgTimeMs < 2000; // Requirement is < 2.0 seconds

      setResult({
        iterations,
        totalMachines,
        avgTimeMs,
        minTimeMs,
        maxTimeMs,
        p95TimeMs,
        passed,
        samples,
      });
      setIsRunning(false);
    }, 50);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center">
              <Zap className="w-5 h-5 fill-amber-600 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                {t('shell_bench_title')}
              </h3>
              <p className="text-xs text-slate-500">
                {t('shell_bench_subtitle', { n: storageService.getTotalMachineCount() })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Info Card */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <Database className="w-4 h-4 text-blue-600" />
              <span>{t('shell_bench_criteria')}</span>
            </div>
            <p className="text-slate-500 leading-relaxed">
              {t('shell_bench_desc')}
            </p>
          </div>

          {/* Run Action */}
          <div className="flex justify-center">
            <button
              onClick={runBenchmark}
              disabled={isRunning}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-sm shadow-md shadow-amber-500/20 flex items-center gap-2 disabled:opacity-60 transition-all hover:scale-105"
            >
              {isRunning ? (
                <>
                  <Activity className="w-5 h-5 animate-spin" />
                  <span>{t('shell_bench_running')}</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-slate-950" />
                  <span>{t('shell_bench_run')}</span>
                </>
              )}
            </button>
          </div>

          {/* Results Display */}
          {result && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              {/* Pass Status Banner */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between ${
                  result.passed
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-bold text-sm text-slate-900">
                      {result.passed ? t('shell_bench_pass') : t('shell_bench_fail')}
                    </div>
                    <div className="text-xs text-slate-600">
                      {t('shell_bench_avg', { ms: result.avgTimeMs })}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-emerald-700 font-mono">
                    {result.avgTimeMs} ms
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">
                    Avg Query Time
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                  <div className="text-slate-500 font-medium">{t('shell_bench_total')}</div>
                  <div className="text-lg font-bold text-slate-900 font-mono mt-1">
                    {result.totalMachines.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                  <div className="text-slate-500 font-medium">{t('shell_bench_min')}</div>
                  <div className="text-lg font-bold text-cyan-700 font-mono mt-1">
                    {result.minTimeMs} ms
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                  <div className="text-slate-500 font-medium">{t('shell_bench_p95')}</div>
                  <div className="text-lg font-bold text-amber-700 font-mono mt-1">
                    {result.p95TimeMs} ms
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                  <div className="text-slate-500 font-medium">{t('shell_bench_max')}</div>
                  <div className="text-lg font-bold text-purple-700 font-mono mt-1">
                    {result.maxTimeMs} ms
                  </div>
                </div>
              </div>

              {/* Sample Queries Table */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700">{t('shell_bench_samples')}</div>
                <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-100 text-slate-600 text-[10px] uppercase">
                      <tr>
                        <th className="px-3 py-2">Query (Barcode / Asset Code)</th>
                        <th className="px-3 py-2">{t('shell_bench_col_machine')}</th>
                        <th className="px-3 py-2 text-right">{t('shell_bench_col_latency')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700 bg-white">
                      {result.samples.map((s, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-3 py-1.5 text-blue-700 font-bold">{s.query}</td>
                          <td className="px-3 py-1.5 text-slate-900 font-sans truncate max-w-[200px]">
                            {s.found}
                          </td>
                          <td className="px-3 py-1.5 text-right text-emerald-700 font-bold">
                            {s.timeMs} ms
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
