import React, { useState, useMemo } from 'react';
import {
  FileText,
  Mail,
  Send,
  Calendar,
  Building,
  CheckCircle2,
  Clock,
  Download,
  AlertTriangle,
  ArrowRightLeft,
  Layers,
} from 'lucide-react';
import { useAuth } from '../services/authContext';
import { getTranslation } from '../services/translations';
import { storageService } from '../services/storage';
import { DailyReport, ReportRecipient } from '../types';

export const ReportsView: React.FC = () => {
  const { currentUser, language } = useAuth();
  const sites = storageService.getSites();
  const recipients = storageService.getReportRecipients();
  const settings = storageService.getSettings();

  const [selectedSite, setSelectedSite] = useState<string>('ALL');
  const [generatedReport, setGeneratedReport] = useState<DailyReport | null>(null);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);

  const handleGenerateReport = () => {
    const report = storageService.generateDailyReport(selectedSite);
    setGeneratedReport(report);
    setDispatchSuccess(null);
  };

  const handleSendEmailSimulation = () => {
    if (!generatedReport) return;
    const targetRecipients = recipients.filter(
      (r) => r.active && (r.siteId === 'ALL' || r.siteId === generatedReport.siteId)
    );

    const emailList = targetRecipients.map((r) => r.email).join(', ');
    setDispatchSuccess(`Laporan harian berhasil disimulasikan & dikirim ke ${targetRecipients.length} penerima: ${emailList}`);
  };

  const pastReports = storageService.getDailyReports();

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>
          <h1 className="text-lg sm:text-xl font-black text-slate-900">
            {getTranslation('daily_report_title', language)}
          </h1>
        </div>
        <p className="text-xs text-slate-500">
          Sistem otomatis mengirim rekapitulasi mutasi dan status mesin setiap sore ({settings.dailyReportTime}) ke email manajemen dan kepala mekanik.
        </p>
      </div>

      {/* Action Card */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="w-full sm:w-64">
            <label className="block text-xs font-bold text-slate-700 mb-1">Pilih Site Laporan:</label>
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:border-emerald-500"
            >
              <option value="ALL">Semua Site (PW1-3, WH2, SW, QA)</option>
              {sites.map((s) => (
                <option key={s.siteId} value={s.siteId}>
                  {s.siteId} - {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleGenerateReport}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95"
            >
              <FileText className="w-4 h-4" />
              <span>Susun Laporan Hari Ini</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dispatch Success Alert */}
      {dispatchSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{dispatchSuccess}</span>
        </div>
      )}

      {/* REPORT PREVIEW CARD */}
      {generatedReport && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded border border-emerald-200">
                ID: {generatedReport.reportId}
              </span>
              <h2 className="text-base font-extrabold text-slate-900 mt-1">
                Laporan Harian Aset Mesin PT.WINNERS — Site {generatedReport.siteId}
              </h2>
              <div className="text-xs text-slate-500 font-mono">Tanggal: {generatedReport.date}</div>
            </div>

            <button
              onClick={handleSendEmailSimulation}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95"
            >
              <Mail className="w-4 h-4" />
              <span>{getTranslation('send_report_now', language)}</span>
            </button>
          </div>

          {/* Report Statistics Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="text-slate-500">Pemindahan Lokasi</div>
              <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
                {generatedReport.stats.totalMoves}
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="text-slate-500">Transfer Terkirim / Terima</div>
              <div className="text-2xl font-black text-amber-700 font-mono mt-1">
                {generatedReport.stats.transfersSent} / {generatedReport.stats.transfersReceived}
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="text-slate-500">Transfer In Transit</div>
              <div className="text-2xl font-black text-purple-700 font-mono mt-1">
                {generatedReport.stats.transfersPending}
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="text-slate-500">Audit Selesai / Missing</div>
              <div className="text-2xl font-black text-teal-700 font-mono mt-1">
                {generatedReport.stats.opnameLocationsCompleted} / {generatedReport.stats.opnameMissingCount}
              </div>
            </div>
          </div>

          {/* Email Template Preview Body */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-mono space-y-3">
            <div className="text-slate-500 text-[11px] pb-2 border-b border-slate-200">
              Subjek Email: [PT.WINNERS] Laporan Harian Lokasi Mesin - {generatedReport.siteId} ({generatedReport.date})
            </div>
            <p>Yth. Manajemen & Tim Mekanik PT.WINNERS,</p>
            <p>
              Berikut ringkasan harian mutasi aset mesin jahit tanggal {generatedReport.date} untuk Site {generatedReport.siteId}:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-700">
              <li>Total Pemindahan Mesin Hari Ini: {generatedReport.stats.totalMoves} mesin</li>
              <li>Transfer Antar Site Dikirim: {generatedReport.stats.transfersSent} mesin</li>
              <li>Transfer Antar Site Diterima: {generatedReport.stats.transfersReceived} mesin</li>
              <li>Mesin Masih Dalam Perjalanan (In Transit): {generatedReport.stats.transfersPending} mesin</li>
              <li>Lokasi Selesai Di-Opname: {generatedReport.stats.opnameLocationsCompleted} lokasi</li>
              <li>Mesin Missing Terdeteksi: {generatedReport.stats.opnameMissingCount} mesin</li>
            </ul>
            <p className="pt-2 text-slate-500">
              Laporan ini dibuat otomatis oleh Sistem Pelacak Lokasi Mesin PT.WINNERS.
            </p>
          </div>
        </div>
      )}

      {/* RECIPIENTS DIRECTORY CARD */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <Mail className="w-4 h-4 text-emerald-700" />
          <span>{getTranslation('email_recipients', language)}</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {recipients.map((r, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between"
            >
              <div>
                <div className="font-mono text-slate-900 font-bold">{r.email}</div>
                <div className="text-[11px] text-slate-500">
                  Site: <span className="font-bold text-emerald-700">{r.siteId}</span> • Bahasa:{' '}
                  <span className="uppercase font-bold text-slate-700">{r.language}</span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                Aktif
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
