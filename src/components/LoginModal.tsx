import React, { useState } from 'react';
import {
  Lock,
  User,
  AlertTriangle,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  Languages,
  Sun,
  Moon,
} from 'lucide-react';
import { PtWinnersLogo } from './PtWinnersLogo';
import { useAuth } from '../services/authContext';
import { useTheme } from '../services/themeContext';
import { getTranslation } from '../services/translations';
import { soundService } from '../services/sound';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen }) => {
  const { login, language, setLanguage } = useAuth();
  const { themePreset, setThemePreset } = useTheme();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
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

  const handlePasswordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) {
      setCapsLockOn(e.getModifierState('CapsLock'));
    }
  };

  const isLightMode = themePreset === 'clean_light';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`w-full max-w-md bg-white rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden flex flex-col relative transition-all ${
          errorMessage ? 'animate-shake' : ''
        }`}
      >
        {/* Pojok kanan atas panel: tombol bahasa ID/EN dan tombol terang/gelap */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5">
          {/* Tombol Terang / Gelap */}
          <button
            type="button"
            onClick={() => {
              const presets: ('sky_cyan' | 'sage_emerald' | 'dark_slate' | 'clean_light' | 'midnight_navy')[] = [
                'clean_light',
                'sky_cyan',
                'sage_emerald',
                'dark_slate',
                'midnight_navy',
              ];
              const next = presets[(presets.indexOf(themePreset) + 1) % presets.length];
              setThemePreset(next);
            }}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors flex items-center justify-center shadow-xs cursor-pointer"
            title={`Tema: ${themePreset}`}
          >
            {isLightMode ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
          </button>

          {/* Tombol Bahasa ID/EN */}
          <button
            type="button"
            onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition-colors flex items-center gap-1 shadow-xs font-mono cursor-pointer"
            title="Ganti Bahasa (ID / EN)"
          >
            <Languages className="w-3.5 h-3.5 text-emerald-600" />
            <span>{language.toUpperCase()}</span>
          </button>
        </div>

        {/* Banner / Header */}
          <div className="p-6 pt-10 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100 text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-white p-1 border border-slate-200/90 shadow-md flex items-center justify-center mx-auto overflow-hidden">
            <PtWinnersLogo className="w-11 h-11 object-contain" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <PtWinnersLogo className="w-5 h-5 object-contain" />
            <h2 className="text-xl font-extrabold text-slate-900">
            PT.WINNERS Machine Tracker
          </h2>
          </div>
          <p className="text-xs text-slate-500">
            Masuk untuk mengakses sistem pelacakan & mutasi lokasi mesin
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Saat gagal login: pesan error singkat di bawah form / atas */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  {getTranslation('username', language)}:
                </label>
                {capsLockOn && (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 animate-pulse">
                    Caps Lock aktif
                  </span>
                )}
              </div>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setErrorMessage(null);
                    setUsername(e.target.value);
                  }}
                  onKeyDown={handlePasswordKeyDown}
                  onKeyUp={handlePasswordKeyDown}
                  placeholder="20xxxxxx"
                  className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:ring-1 focus:ring-amber-400 focus:border-amber-400 transition-all duration-200 focus:outline-none font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>{getTranslation('password', language)}:</span>
                {capsLockOn && (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 animate-pulse">
                    Caps Lock aktif
                  </span>
                )}
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setErrorMessage(null);
                    setPassword(e.target.value);
                  }}
                  onKeyDown={handlePasswordKeyDown}
                  onKeyUp={handlePasswordKeyDown}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 focus:ring-1 focus:ring-amber-400 focus:border-amber-400 transition-all duration-200 focus:outline-none font-mono"
                  required
                />
               <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>  
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-extrabold shadow-sm flex items-center justify-center gap-2 transition-all hover:-translate-y-px active:translate-y-0 cursor-pointer disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <span>{getTranslation('login', language)}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
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
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors cursor-pointer"
              >
                <div className="font-bold text-slate-900">Admin</div>
                <div className="text-[10px] text-blue-700 font-mono font-semibold">ALL Sites (Super)</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('mechanic_pw1', 'Mek1Pass123!')}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors cursor-pointer"
              >
                <div className="font-bold text-slate-900">Mechanic PW1</div>
                <div className="text-[10px] text-emerald-700 font-mono font-semibold">PW1 Factory</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('mechanic_wh2', 'MekWhPass123!')}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors cursor-pointer"
              >
                <div className="font-bold text-slate-900">Mechanic WH2</div>
                <div className="text-[10px] text-indigo-700 font-mono font-semibold">WH2, SW, QA</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('viewer_mgmt', 'ViewerPass123!')}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors cursor-pointer"
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
