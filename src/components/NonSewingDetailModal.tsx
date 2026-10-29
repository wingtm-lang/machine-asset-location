import React from 'react';
import { X, Layers } from 'lucide-react';
import { makeT } from '../services/translations';
import { useAuth } from '../services/authContext';

export interface NsDetail {
  asset_code: string;
  barcode: string;
  item: string | null;
  standard_machine_name: string | null;
  serial: string | null;
  manufacturer: string | null;
  model: string | null;
  home_site_id: string | null;
  acq_date: string | null;
  status: string;
  site_id: string;
  location_id: string | null;
  notes: string | null;
}

interface Props {
  machine: NsDetail;
  localName: string | null;
  onClose: () => void;
  onMove: () => void;
}

const statusCls: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  BROKEN: 'bg-rose-50 text-rose-700 border-rose-200',
  IN_REPAIR: 'bg-amber-50 text-amber-700 border-amber-200',
  LOANED: 'bg-purple-50 text-purple-700 border-purple-200',
  IN_TRANSIT: 'bg-sky-50 text-sky-700 border-sky-200',
};

export const NonSewingDetailModal: React.FC<Props> = ({ machine: m, localName, onClose, onMove }) => {
  const { language } = useAuth();
  const t = makeT(language);
  const movable = m.status !== 'SOLD' && m.status !== 'IN_TRANSIT';
  const isUnassigned = (m.location_id ?? '').includes('UNASSIGNED');

  const Row: React.FC<{ label: string; children: React.ReactNode; last?: boolean }> = ({ label, children, last }) => (
    <div className={`flex justify-between gap-4 py-1.5 ${last ? '' : 'border-b border-slate-200/80'}`}>
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="text-slate-900 font-medium text-right break-words min-w-0">{children || '-'}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center font-bold font-mono text-xs shrink-0">
              {m.site_id}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base text-slate-900 truncate">
                  {m.standard_machine_name || m.asset_code}
                </h3>
                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${statusCls[m.status] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                  {m.status}
                </span>
              </div>
              <div className="font-mono text-[11px] text-slate-500">{m.asset_code} · {m.barcode}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <Row label={t('ns_col_site')}>
              <span className="font-bold font-mono text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">{m.site_id}</span>
            </Row>
            <Row label={t('ns_col_place')}>
              <span className={`font-mono font-bold ${isUnassigned ? 'text-amber-700 underline decoration-amber-400' : 'text-slate-800'}`}>
                {m.location_id}
              </span>
            </Row>
            <Row label={t('ns_f_home')}>{m.home_site_id}</Row>
            <Row label={t('ns_f_acq')} last>{m.acq_date}</Row>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <Row label={t('md_std_name')}>{m.standard_machine_name}</Row>
            <Row label={t('md_local_name')}>{localName}</Row>
            <Row label={t('md_korean')}>{m.item}</Row>
            <Row label={t('md_brand')}>{m.manufacturer}</Row>
            <Row label="Model:">{m.model}</Row>
            <Row label="Serial Number:">{m.serial}</Row>
            <Row label={t('ns_f_notes')} last>{m.notes}</Row>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            {t('ns_close')}
          </button>
          {movable && (
            <button
              type="button"
              onClick={onMove}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              {t('ns_btn_move')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
