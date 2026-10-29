import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { X, Upload, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { makeT, localizeMessage } from '../services/translations';
import { useAuth } from '../services/authContext';
import { supabase } from '../services/supabase';

interface Props {
  onClose: () => void;
  onDone: (message: string) => void;
}

type Row = Record<string, string> & { row: number };

interface ImportErr { row: number; code: string; field?: string; value?: string }
interface ImportResult {
  ok: boolean;
  total: number;
  valid: number;
  error_count: number;
  errors: ImportErr[];
  new_types: Array<{ name: string; local_name: string | null }>;
  new_areas: Array<{ site: string; code: string; name: string }>;
  inserted: number;
}

const HEADERS = [
  'Asset Code *', 'Barcode (12-Digit) *', 'Standard Machine Name *', 'Local Name', 'Item (Korea)', 'Manufacturer',
  'Model', 'Serial', 'Acquisition Date (YYYY-MM-DD)', 'Site *', 'Location Code *', 'Location Name', 'Home Factory',
  'Status', 'Notes',
];

const ALIAS: Record<string, string> = {
  assetcode: 'asset_code', nomoraset: 'asset_code',
  barcode: 'barcode',
  standardmachinename: 'type', standardname: 'type', jenismesin: 'type', namastandar: 'type',
  localname: 'local_name', namalokal: 'local_name',
  item: 'item', namakorea: 'item',
  manufacturer: 'manufacturer', merek: 'manufacturer',
  model: 'model',
  serial: 'serial', nomorserial: 'serial',
  acquisitiondate: 'acq_date', acqdate: 'acq_date', tanggalperolehan: 'acq_date',
  site: 'site',
  locationcode: 'location', kodepenempatan: 'location', penempatan: 'location',
  locationname: 'location_name', namapenempatan: 'location_name',
  homefactory: 'home_site', siteasal: 'home_site',
  status: 'status',
  notes: 'notes', catatan: 'notes',
};
const REQUIRED = ['asset_code', 'barcode', 'type', 'site'];
const norm = (h: unknown) =>
  String(h ?? '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');

const pad = (n: number) => String(n).padStart(2, '0');

/** Sel Excel -> teks. Tanggal diubah ke YYYY-MM-DD tanpa terpengaruh zona waktu. */
function cellText(v: unknown, field: string): string {
  if (v == null) return '';
  if (field === 'acq_date') {
    if (typeof v === 'number' && v > 1) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    }
    const s = String(v).trim();
    const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (m) return `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
    return s;
  }
  if (typeof v === 'number') return Number.isInteger(v) ? v.toFixed(0) : String(v);
  return String(v).trim();
}

export const ImportNonSewingModal: React.FC<Props> = ({ onClose, onDone }) => {
  const { language } = useAuth();
  const t = makeT(language);
  const fileRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [parseError, setParseError] = useState('');
  const [createMissing, setCreateMissing] = useState(false);
  const [busy, setBusy] = useState<'' | 'check' | 'import'>('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [serverError, setServerError] = useState('');

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([HEADERS]);
    ws['!cols'] = HEADERS.map((h) => ({ wch: Math.max(14, h.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mesin Non Sewing');
    XLSX.writeFile(wb, 'Template-Import-Mesin-Non-Sewing.xlsx');
  };

  const onFile = async (file: File | null) => {
    setResult(null);
    setServerError('');
    setParseError('');
    setRows([]);
    setFileName('');
    if (!file) return;
    setFileName(file.name);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === 'mesin non sewing') ?? wb.SheetNames[0];
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, raw: true, defval: '' });
      if (aoa.length < 2) return setParseError(t('imp_empty_file'));

      const fieldAt: Array<string | undefined> = (aoa[0] as unknown[]).map((h) => ALIAS[norm(h)]);
      const missing = REQUIRED.filter((f) => !fieldAt.includes(f));
      if (missing.length) {
        return setParseError(t('imp_missing_cols', { cols: missing.map((f) => t(`imp_f_${f}`)).join(', ') }));
      }

      const out: Row[] = [];
      aoa.slice(1).forEach((cells, i) => {
        const r: Row = { row: i + 2 } as Row;
        let any = false;
        (cells as unknown[]).forEach((v, c) => {
          const f = fieldAt[c];
          if (!f) return;
          const txt = cellText(v, f);
          if (txt !== '') any = true;
          r[f] = txt;
        });
        if (any) out.push(r);
      });
      if (out.length === 0) return setParseError(t('imp_empty_file'));
      if (out.length > 5000) return setParseError(t('imp_too_many'));
      setRows(out);
    } catch {
      setParseError(t('imp_read_failed'));
    }
  };

  const run = async (dry: boolean) => {
    setBusy(dry ? 'check' : 'import');
    setServerError('');
    const { data, error } = await supabase.rpc('import_non_sewing_machines', {
      p_rows: rows,
      p_create_missing: createMissing,
      p_dry_run: dry,
    });
    setBusy('');
    if (error) return setServerError(localizeMessage(error.message, language));
    const r = (data ?? {}) as Partial<ImportResult> & { success?: boolean; message?: string };
    if (r.success === false) return setServerError(localizeMessage(r.message ?? '', language));
    if (!dry && r.ok) return onDone(t('imp_done', { n: r.inserted ?? 0 }));
    setResult(r as ImportResult);
  };

  const errText = (e: ImportErr) => {
    const fieldLabel = e.code === 'LOC_SITE' ? (e.field ?? '') : e.field ? t(`imp_f_${e.field}`) : '';
    return `${t('imp_row')} ${e.row}: ${t(`imp_err_${e.code}`, { field: fieldLabel, value: e.value ?? '' })}`;
  };

  const preview = useMemo(() => rows.slice(0, 5), [rows]);
  const canImport = !!result && result.ok && busy === '';

  const btnPrimary =
    'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 ' +
    'text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  const btnGhost =
    'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 ' +
    'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs" onMouseDown={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('imp_title')}</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={btnGhost} onClick={downloadTemplate}>
              <Download className="w-3.5 h-3.5" />
              {t('imp_template')}
            </button>
            <button type="button" className={btnPrimary} onClick={() => fileRef.current?.click()}>
              <Upload className="w-3.5 h-3.5" />
              {t('imp_choose')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                void onFile(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
            {fileName && <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{fileName}</span>}
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('imp_hint')}</p>

          {parseError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs px-3 py-2">{parseError}</div>
          )}

          {rows.length > 0 && (
            <>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{t('imp_rows_found', { n: rows.length })}</div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 text-left text-slate-500">
                      <th className="px-2.5 py-1.5">{t('imp_row')}</th>
                      <th className="px-2.5 py-1.5">{t('imp_f_asset_code')}</th>
                      <th className="px-2.5 py-1.5">{t('imp_f_type')}</th>
                      <th className="px-2.5 py-1.5">{t('imp_f_site')}</th>
                      <th className="px-2.5 py-1.5">{t('imp_f_location')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                    {preview.map((r) => (
                      <tr key={r.row}>
                        <td className="px-2.5 py-1.5">{r.row}</td>
                        <td className="px-2.5 py-1.5 font-mono">{r.asset_code}</td>
                        <td className="px-2.5 py-1.5">{r.type}</td>
                        <td className="px-2.5 py-1.5">{r.site}</td>
                        <td className="px-2.5 py-1.5">{r.location}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={createMissing}
                  onChange={(e) => {
                    setCreateMissing(e.target.checked);
                    setResult(null);
                  }}
                />
                <span>{t('imp_create_missing')}</span>
              </label>
            </>
          )}

          {serverError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs px-3 py-2">{serverError}</div>
          )}

          {result && (
            <div
              className={`rounded-xl border text-xs px-3 py-3 space-y-2 ${
                result.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                {result.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {result.ok
                  ? t('imp_check_ok', { n: result.total })
                  : t('imp_check_bad', { n: result.error_count })}
              </div>
              {result.ok && result.new_types.length > 0 && (
                <div>{t('imp_will_types')} {result.new_types.map((x) => x.name).join(', ')}</div>
              )}
              {result.ok && result.new_areas.length > 0 && (
                <div>{t('imp_will_areas')} {result.new_areas.map((x) => `${x.code} (${x.site})`).join(', ')}</div>
              )}
              {!result.ok && (
                <>
                  <ul className="list-disc pl-4 space-y-0.5 max-h-48 overflow-y-auto">
                    {result.errors.map((e, i) => <li key={i}>{errText(e)}</li>)}
                  </ul>
                  {result.error_count > result.errors.length && (
                    <div className="opacity-80">{t('imp_more_errors', { n: result.error_count - result.errors.length })}</div>
                  )}
                  <div className="opacity-80">{t('imp_fix_hint')}</div>
                </>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className={btnGhost} onClick={onClose}>{t('ns_cancel')}</button>
            <button type="button" className={btnGhost} disabled={rows.length === 0 || busy !== ''} onClick={() => void run(true)}>
              {busy === 'check' ? t('imp_checking') : t('imp_check')}
            </button>
            <button type="button" className={btnPrimary} disabled={!canImport} onClick={() => void run(false)}>
              {busy === 'import' ? t('imp_importing') : t('imp_import', { n: rows.length })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
