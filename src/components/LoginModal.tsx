import React, { useState } from 'react';
import {
  Lock,
  User,
  AlertTriangle,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../services/authContext';
import { getTranslation } from '../services/translations';
import { soundService } from '../services/sound';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen }) => {
  const { login, language } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setLoading(true);
    setErrorMessage(null);
    const res = await login(username.trim().toLowerCase(), password);
    setLoading(false);

    if (res.success) {
      soundService.playSuccess();
    } else {
      soundService.playError();
      setErrorMessage(res.message);
    }
  };

  // Quick Preset Login
  const handleQuickLogin = async (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    setLoading(true);
    setErrorMessage(null);
    const res = await login(user, pass);
    setLoading(false);
    if (res.success) {
      soundService.playSuccess();
    } else {
      soundService.playError();
      setErrorMessage(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
        {/* Banner */}
        <div className="p-6 bg-slate-50 border-b border-slate-100 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center mx-auto shadow-xs">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            PT.WINNERS Machine Tracker
          </h2>
          <p className="text-xs text-slate-500">
            Masuk untuk mengakses sistem pelacakan & mutasi lokasi mesin
          </p>
        </div>

        <div className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {getTranslation('username', language)}:
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setErrorMessage(null);
                    setUsername(e.target.value);
                  }}
                  placeholder="Contoh: admin / mechanic_pw1"
                  className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {getTranslation('password', language)}:
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setErrorMessage(null);
                    setPassword(e.target.value);
                  }}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-extrabold shadow-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
            >
              <Lock className="w-4 h-4" />
              <span>{loading ? 'Memverifikasi...' : getTranslation('login', language)}</span>
            </button>
          </form>

          {/* Quick Demo Role Selector */}
          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">
              Pilih Akun Demo Cepat (1-Klik):
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin', 'AdminPass123!')}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors"
              >
                <div className="font-bold text-slate-900">Admin</div>
                <div className="text-[10px] text-blue-700 font-mono font-semibold">ALL Sites (Super)</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('mechanic_pw1', 'Mek1Pass123!')}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors"
              >
                <div className="font-bold text-slate-900">Mechanic PW1</div>
                <div className="text-[10px] text-emerald-700 font-mono font-semibold">PW1 Factory</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('mechanic_wh2', 'MekWhPass123!')}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors"
              >
                <div className="font-bold text-slate-900">Mechanic WH2</div>
                <div className="text-[10px] text-indigo-700 font-mono font-semibold">WH2, SW, QA</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('viewer_mgmt', 'ViewerPass123!')}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors"
              >
                <div className="font-bold text-slate-900">Viewer (Manajer)</div>
                <div className="text-[10px] text-purple-700 font-mono font-semibold">Read Only ALL</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
