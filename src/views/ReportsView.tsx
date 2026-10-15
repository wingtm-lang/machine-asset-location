import React from 'react';
import { FileText, Mail, Clock } from 'lucide-react';
import { getTranslation, makeT } from '../services/translations';
import { useAuth } from '../services/authContext';

/**
 * Laporan Harian BELUM diimplementasikan di versi Supabase (perlu pengiriman email
 * terjadwal lewat Edge Function + cron, belum dibangun). Versi lama menampilkan form
 * yang terlihat berfungsi tapi selalu menghasilkan laporan berisi angka 0 dan "mengirim
 * email" yang sebenarnya hanya simulasi di browser. Halaman ini sengaja jujur: tidak
 * ada statistik palsu, tidak ada tombol yang pura-pura mengirim apa pun.
 */
export const ReportsView: React.FC = () => {
  const { language } = useAuth();
  const t = makeT(language);

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
      </div>

      <div className="p-8 rounded-3xl bg-white border border-slate-200/90 shadow-sm text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
          <Clock className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">{t('rep_unavailable_title')}</h2>
          <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
            {t('rep_body_pre')}{' '}
            <span className="font-semibold text-slate-700">{t('hist_title')}</span> {t('rep_and')}{' '}
            <span className="font-semibold text-slate-700">{getTranslation('dashboard', language)}</span>{t('rep_menu_suffix') ? ` ${t('rep_menu_suffix')}` : ''}.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 pt-2">
          <Mail className="w-3.5 h-3.5" />
          <span>{t('rep_email_note')}</span>
        </div>
      </div>
    </div>
  );
};

export default ReportsView;
