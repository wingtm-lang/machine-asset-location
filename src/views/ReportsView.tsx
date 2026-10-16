import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Mail, Clock, Trash2, Plus, RefreshCw, Send, Copy, Globe } from 'lucide-react';
import { getTranslation, makeT, localizeMessage, localeOf } from '../services/translations';
import { useAuth } from '../services/authContext';
import { supabase } from '../services/supabase';

interface Recipient {
  id: number;
  email: string;
  name: string | null;
  active: boolean;
}

// ---- Isi email laporan (sengaja Bahasa Indonesia, seperti dokumen Surat Jalan) ----

interface ReportPayload {
  period_start: string;
  period_end: string;
  totals?: Record<string, number>;
  previous?: Record<string, number> | null;
  attention?: Record<string, { count: number; items: any[] }>;
  movements?: { total?: number; by_type?: Record<string, number>; by_site?: Array<{ site: string; count: number }> };
  transfers?: { sent?: number; received?: number; cancelled?: number };
  opname?: { count?: number; items?: any[] };
  recipients?: string[];
  last_sent?: string | null;
  scope?: string;
  sites?: string[];
  all_allowed?: boolean;
}

const TZ = 'Asia/Jakarta';
const MOVE_LABEL: Record<string, string> = {
  MOVE: 'Pindah lokasi',
  STATUS_CHANGE: 'Ubah status',
  TRANSFER_OUT: 'Transfer keluar',
  TRANSFER_IN: 'Transfer masuk',
  TRANSFER_CANCEL: 'Transfer dibatalkan',
  UNDO: 'Batal pindah',
};

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }).format(d);
const fmtDay = (d: Date) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: TZ }).format(d);

function periodLabel(p: ReportPayload): string {
  const start = new Date(p.period_start);
  const end = new Date(new Date(p.period_end).getTime() - 24 * 3600 * 1000); // akhir periode = hari Minggu
  return `${fmtDay(start)} – ${fmtDate(end)}`;
}

function diff(cur: number, prev: Record<string, number> | null | undefined, key: string): string {
  if (!prev || typeof prev[key] !== 'number') return '';
  const d = cur - prev[key];
  return d === 0 ? ' (sama)' : ` (${d > 0 ? '+' : ''}${d})`;
}

/** Susun isi email. maxItems = jumlah baris maksimal per daftar (untuk membatasi panjang). */
function buildBody(p: ReportPayload, maxItems: number): string {
  const L: string[] = [];
  const t = p.totals ?? {};
  const att = p.attention ?? {};
  const mv = p.movements ?? {};
  const tr = p.transfers ?? {};
  const op = p.opname ?? { count: 0, items: [] };

  L.push(
    'Laporan Mingguan Aset Mesin PT.WINNERS INTERNATIONAL',
    `Cakupan: ${p.scope && p.scope !== 'ALL' ? `Site ${p.scope}` : 'Semua site'}`,
    `Periode: ${periodLabel(p)}`,
    ''
  );

  L.push('PERLU PERHATIAN');
  const block = (title: string, b: { count: number; items: any[] } | undefined, row: (i: any) => string) => {
    const count = b?.count ?? 0;
    if (count === 0) {
      L.push(`- ${title}: tidak ada`);
      return;
    }
    L.push(`- ${title}: ${count}`);
    const items = (b?.items ?? []).slice(0, maxItems);
    items.forEach((i) => L.push(`    * ${row(i)}`));
    if (count > items.length) L.push(`    * dan ${count - items.length} lainnya (lihat di aplikasi)`);
  };
  block('In Transit lebih dari 3 hari', att.in_transit_late, (i) =>
    `${i.asset_code} | ${i.from_site} ke ${i.to_site} | ${i.transfer_no} | ${i.days} hari`);
  block('Pinjaman lewat jatuh tempo', att.loan_overdue, (i) =>
    `${i.asset_code} | ${i.loan_to ?? '-'} | terlambat ${i.days_over} hari`);
  block('Rusak/perbaikan lebih dari 30 hari', att.broken_long, (i) =>
    `${i.asset_code} | ${i.status} | ${i.site_id ?? '-'} | ${i.days} hari`);

  L.push('', 'RINGKASAN ANGKA');
  const rows: Array<[string, string]> = [
    ['Total mesin', 'total'],
    ['Aktif', 'active'],
    ['Rusak', 'broken'],
    ['Dalam perbaikan', 'in_repair'],
    ['Dipinjamkan', 'loaned'],
    ['In Transit', 'in_transit'],
  ];
  rows.forEach(([label, key]) => L.push(`- ${label}: ${t[key] ?? 0}${diff(t[key] ?? 0, p.previous, key)}`));

  L.push('', 'AKTIVITAS MINGGU INI');
  const byType = Object.entries(mv.by_type ?? {})
    .map(([k, n]) => `${MOVE_LABEL[k] ?? k} ${n}`)
    .join(', ');
  L.push(`- Pemindahan dan perubahan status: ${mv.total ?? 0}${byType ? ` (${byType})` : ''}`);
  const bySite = (mv.by_site ?? []).map((s) => `${s.site} ${s.count}`).join(', ');
  if (bySite) L.push(`- Per site: ${bySite}`);
  L.push(`- Transfer: dikirim ${tr.sent ?? 0}, mesin diterima ${tr.received ?? 0}, mesin dibatalkan ${tr.cancelled ?? 0}`);

  L.push('', 'WEEKLY MACHINE LIST (OPNAME)');
  if ((op.count ?? 0) === 0) {
    L.push('- Tidak ada sesi opname yang selesai minggu ini');
  } else {
    (op.items ?? []).slice(0, Math.max(maxItems, 3)).forEach((s: any) =>
      L.push(`- ${s.session_no} | ${s.site} | Line ${s.line ? String(s.line).replace(/^line\s*/i, '').replace(/^[A-Za-z]+[-_\s]+(?=\d)/, '') : 'Semua line'} | cocok ${s.match} dari ${s.expected} | hilang ${s.missing} | salah lokasi ${s.misplaced}`));
    if ((op.count ?? 0) > Math.max(maxItems, 3)) L.push(`- dan ${(op.count ?? 0) - Math.max(maxItems, 3)} sesi lainnya`);
  }

  L.push('', `Rincian lengkap: ${window.location.origin}`);
  return L.join('\r\n');
}

const enc = (v: string) => encodeURIComponent(v);

/** Tautan mailto yang tidak melebihi batas panjang Outlook; daftar dipangkas bila perlu. */
function buildMailto(p: ReportPayload, subject: string): { url: string; trimmed: boolean } {
  const to = (p.recipients ?? []).join(';');
  for (const n of [5, 3, 1, 0]) {
    const url = `mailto:${to}?subject=${enc(subject)}&body=${enc(buildBody(p, n))}`;
    if (url.length <= 1900) return { url, trimmed: n < 5 };
  }
  return { url: `mailto:${to}?subject=${enc(subject)}&body=${enc(buildBody(p, 0))}`, trimmed: true };
}

/**
 * Laporan Mingguan: laporan minggu lalu disusun di server (RPC weekly_report_preview), lalu tombol
 * membuka Outlook dengan penerima + isi email terisi. Daftar penerima dikelola lewat RPC
 * list/save/delete_report_recipient, yang hanya diizinkan untuk Admin Master (dicek di server).
 */
export const ReportsView: React.FC = () => {
  const { language, currentUser } = useAuth();
  const t = makeT(language);

  const roleKey = String(currentUser?.role || '').toLowerCase().replace(/[\s_-]/g, '');
  const isAdminMaster = roleKey === 'adminmaster' || roleKey === 'admin';

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [site, setSite] = useState<string>('');
  const canManage = isAdminMaster || site !== '';
  const [reportLoading, setReportLoading] = useState<boolean>(true);
  const [reportError, setReportError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setReportLoading(true);
    setReportError(null);
    try {
      const { data, error } = await supabase.rpc('weekly_report_preview', { p_site: site || null });
      if (error) throw error;
      if (!data?.success) {
        setReport(null);
        setReportError(data?.message ? localizeMessage(data.message, language) : t('rp_report_failed'));
      } else {
        setReport(data as ReportPayload);
      }
    } catch (err: any) {
      setReport(null);
      setReportError(err?.message ? localizeMessage(err.message, language) : t('rp_report_failed'));
    } finally {
      setReportLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, site]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('list_report_recipients', { p_site: site || null });
      if (error) throw error;
      if (!data?.success) {
        setFeedback({ type: 'error', message: data?.message ? localizeMessage(data.message, language) : t('rp_load_failed') });
        setRecipients([]);
      } else {
        setRecipients((data.recipients ?? []) as Recipient[]);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message ? localizeMessage(err.message, language) : t('rp_load_failed') });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, site]);

  useEffect(() => {
    if (canManage) load();
    else {
      setRecipients([]);
      setLoading(false);
    }
  }, [load, canManage]);

  // Akun non-admin yang punya beberapa site: laporan selalu untuk satu site (default site pertama)
  useEffect(() => {
    if (report && !report.all_allowed && site === '' && (report.sites ?? []).length > 0) {
      setSite((report.sites ?? [])[0]);
    }
  }, [report, site]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Catat (tanpa menunggu) bahwa laporan dibuka di Outlook + simpan angka pembanding minggu depan
  const recordSent = async () => {
    try {
      await supabase.rpc('record_weekly_report_sent', { p_site: site || null });
      await loadReport();
    } catch {
      /* pencatatan gagal tidak boleh menghalangi pengiriman */
    }
  };

  const subject = report
    ? `Laporan Mingguan Aset Mesin${report.scope && report.scope !== 'ALL' ? ` ${report.scope}` : ''}: ${periodLabel(report)}`
    : '';

  const handleOpenOutlook = () => {
    if (!report) return;
    window.location.href = buildMailto(report, subject).url;
    void recordSent();
  };

  const handleOpenOutlookWeb = () => {
    if (!report) return;
    const to = (report.recipients ?? []).join(';');
    const url = `https://outlook.office.com/mail/deeplink/compose?to=${enc(to)}&subject=${enc(subject)}&body=${enc(buildBody(report, 10))}`;
    window.open(url, '_blank', 'noopener');
    void recordSent();
  };

  const handleCopy = async () => {
    if (!report) return;
    const text = `${subject}\n\n${buildBody(report, 10).replace(/\r\n/g, '\n')}`;
    try {
      await navigator.clipboard.writeText(text);
      setFeedback({ type: 'success', message: t('rp_copied') });
    } catch {
      setFeedback({ type: 'error', message: t('rp_copy_failed') });
    }
  };

  const save = async (rEmail: string, rName: string | null, active: boolean): Promise<boolean> => {
    setBusy(true);
    setFeedback(null);
    try {
      const { data, error } = await supabase.rpc('save_report_recipient', {
        p_email: rEmail,
        p_name: rName,
        p_active: active,
        p_site: site || null,
      });
      if (error) throw error;
      if (!data?.success) {
        setFeedback({ type: 'error', message: data?.message ? localizeMessage(data.message, language) : t('rp_save_failed') });
        return false;
      }
      setFeedback({ type: 'success', message: localizeMessage(data.message, language) });
      await load();
      return true;
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message ? localizeMessage(err.message, language) : t('rp_save_failed') });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || busy) return;
    const ok = await save(email.trim(), name.trim() || null, true);
    if (ok) {
      setEmail('');
      setName('');
    }
  };

  const handleDelete = async (r: Recipient) => {
    if (busy || !window.confirm(t('rp_delete_confirm', { email: r.email }))) return;
    setBusy(true);
    setFeedback(null);
    try {
      const { data, error } = await supabase.rpc('delete_report_recipient', { p_email: r.email, p_site: site || null });
      if (error) throw error;
      if (!data?.success) {
        setFeedback({ type: 'error', message: data?.message ? localizeMessage(data.message, language) : t('rp_delete_failed') });
      } else {
        setFeedback({ type: 'success', message: localizeMessage(data.message, language) });
        await load();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message ? localizeMessage(err.message, language) : t('rp_delete_failed') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in">
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>
          <h1 className="text-lg sm:text-xl font-black text-slate-900">
            {getTranslation('daily_report_title', language)}
          </h1>
        </div>
        <div className="flex items-start gap-2 text-xs text-slate-600 pt-1">
          <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
          <div className="space-y-1">
            <p className="font-semibold text-slate-800">{t('rp_schedule')}</p>
            <p className="leading-relaxed">{t('rp_contents')}</p>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900">{t('rp_send_title')}</h2>
          </div>
          <button
            type="button"
            onClick={loadReport}
            disabled={reportLoading}
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            title={t('refresh')}
            aria-label={t('refresh')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reportLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">{t('rp_send_desc')}</p>

        {report && ((report.sites ?? []).length > 1 || report.all_allowed) && (
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold">{t('rp_scope_label')}</span>
            <select
              value={site}
              onChange={(e) => setSite(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white"
            >
              {report.all_allowed && <option value="">{t('rp_all_sites')}</option>}
              {(report.sites ?? []).map((sid) => (
                <option key={sid} value={sid}>
                  {sid}
                </option>
              ))}
            </select>
          </label>
        )}

        {reportLoading && <p className="text-xs text-slate-500">{t('rp_report_loading')}</p>}
        {reportError && (
          <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5">{reportError}</p>
        )}

        {report && (
          <>
            <div className="text-[11px] text-slate-500 space-y-0.5">
              <p>{t('rp_period', { period: periodLabel(report) })}</p>
              <p>
                {t('rp_last_sent', {
                  date: report.last_sent ? new Intl.DateTimeFormat(localeOf(language), { dateStyle: 'medium', timeStyle: 'short', timeZone: TZ }).format(new Date(report.last_sent)) : t('rp_never'),
                })}
              </p>
              <p>{t('rp_count', { n: (report.recipients ?? []).length })}: {(report.recipients ?? []).join('; ') || '-'}</p>
            </div>

            {(report.recipients ?? []).length === 0 && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                {t('rp_no_recipients_warn')}
              </p>
            )}

            <div>
              <div className="text-[11px] font-semibold text-slate-600 mb-1">{t('rp_preview_label')}</div>
              <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-72 overflow-auto font-mono">
                {buildBody(report, 10).replace(/\r\n/g, '\n')}
              </pre>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleOpenOutlook}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{t('rp_open_outlook')}</span>
              </button>
              <button
                type="button"
                onClick={handleOpenOutlookWeb}
                className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{t('rp_open_web')}</span>
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{t('rp_copy')}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">{t('rp_body_note')}</p>
          </>
        )}
      </div>

      {feedback && (
        <div
          role="status"
          className={`p-3 rounded-2xl border text-xs font-medium ${
            feedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900">{t('rp_recipients_title')}</h2>
            <span className="text-[11px] text-slate-400">{t('rp_count', { n: recipients.length })}</span>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            title={t('refresh')}
            aria-label={t('refresh')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {!canManage && (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
            {t('rp_manage_note')}
          </p>
        )}

        {canManage && (
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('rp_email_label')}
              aria-label={t('rp_email_label')}
              disabled={busy}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('rp_name_label')}
              aria-label={t('rp_name_label')}
              disabled={busy}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{busy ? t('rp_saving') : t('rp_add')}</span>
            </button>
          </form>
        )}

        {recipients.length === 0 && !loading ? (
          <p className="text-xs text-slate-500 py-4 text-center">{t('rp_empty')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recipients.map((r) => (
              <li key={r.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800 truncate">{r.email}</div>
                  {r.name && <div className="text-[11px] text-slate-500 truncate">{r.name}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={!canManage || busy}
                    onClick={() => save(r.email, r.name, !r.active)}
                    title={t('rp_toggle_title')}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border disabled:opacity-60 ${
                      r.active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    } ${canManage ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    {r.active ? t('rp_active') : t('rp_inactive')}
                  </button>
                  {canManage && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDelete(r)}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
                      title={t('rp_delete')}
                      aria-label={t('rp_delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ReportsView;
