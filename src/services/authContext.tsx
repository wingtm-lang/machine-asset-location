/**
 * Konteks autentikasi.
 * Antarmuka (useAuth) SAMA dengan versi lama agar view tidak perlu diubah.
 * Sumber kebenaran login, sesi, dan hak akses: Supabase (Auth + view v_me).
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, SiteId } from '../types';
import { storageService } from './storage';
import { authService, AuthUser, registerAuthCallbacks } from './authService';

type ActionName = 'MOVE' | 'CHANGE_STATUS' | 'TRANSFER' | 'OPNAME' | 'UNDO' | 'ADMIN' | 'REPORTS' | 'VIEW_DETAIL';
type ToastType = 'error' | 'warning' | 'success';

interface AuthToast {
  type: ToastType;
  text: string;
  id: number;
}

interface AuthContextType {
  currentUser: User | null;
  token: string | null;
  isLoadingSession: boolean;
  language: 'id' | 'en';
  authToast: AuthToast | null;
  clearAuthToast: () => void;
  setLanguage: (lang: 'id' | 'en') => void;
  login: (username: string, passwordPlain: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  changePassword: (oldPasswordPlain: string, newPasswordPlain: string) => Promise<{ success: boolean; message: string }>;
  canAccessSite: (siteId: SiteId) => boolean;
  canPerformAction: (action: ActionName) => boolean;
  canAddUser: boolean;
  canUseRackMap: boolean;
}

const defaultAuthContext: AuthContextType = {
  currentUser: null,
  token: null,
  isLoadingSession: false,
  language: 'id',
  authToast: null,
  clearAuthToast: () => {},
  setLanguage: () => {},
  login: async () => ({ success: false, message: 'Auth context belum siap' }),
  logout: () => {},
  changePassword: async () => ({ success: false, message: 'Auth context belum siap' }),
  canAccessSite: () => false,
  canPerformAction: () => false,
  canAddUser: false,
  canUseRackMap: false,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toUser(u: AuthUser): User {
  return {
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    siteAccess: u.siteAccess,
    canAddUser: u.canAddUser,
    canUseRackMap: u.canUseRackMap,
    authority: u.role,
    active: true,
    failedAttempts: 0,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);
  const [language, setLanguage] = useState<'id' | 'en'>('id');
  const [authToast, setAuthToast] = useState<AuthToast | null>(null);

  // Cermin currentUser agar callback event membaca nilai terkini tanpa menunggu render.
  const currentUserRef = useRef<User | null>(null);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const showAuthToast = useCallback((type: ToastType, text: string) => {
    setAuthToast({ type, text, id: Date.now() });
  }, []);

  const clearAuthToast = useCallback(() => {
    setAuthToast(null);
  }, []);

  const handleSessionLost = useCallback(() => {
    storageService.clearLocalMachineCache();
    currentUserRef.current = null;
    setCurrentUser(null);
    setToken(null);
    showAuthToast('error', 'Sesi berakhir, silakan login kembali');
  }, [showAuthToast]);

  // Callback global: UNAUTHORIZED dari lapisan data, dan FORBIDDEN dari fungsi server
  useEffect(() => {
    registerAuthCallbacks(
      () => {
        if (currentUserRef.current) handleSessionLost();
      },
      (msg: string) => {
        showAuthToast('warning', msg || 'Akses ditolak (FORBIDDEN)');
      }
    );
  }, [handleSessionLost, showAuthToast]);

  // Sesi berakhir/dicabut di sisi server (token tidak bisa diperbarui, dll).
  // Diabaikan bila tidak ada pengguna login (mis. setelah logout manual atau login gagal).
  useEffect(() => {
    return authService.onSignedOut(() => {
      if (currentUserRef.current) handleSessionLost();
    });
  }, [handleSessionLost]);

  // Pulihkan sesi saat aplikasi dibuka, dan verifikasi ke server
  useEffect(() => {
    let cancelled = false;
    const verifyInitialSession = async () => {
      setIsLoadingSession(true);
      const res = await authService.restore();
      if (cancelled) return;
      if (res === 'OFFLINE') {
        setCurrentUser(null);
        setToken(null);
        showAuthToast('warning', 'Tidak dapat memverifikasi sesi karena jaringan. Muat ulang halaman setelah tersambung.');
      } else if (res) {
        setCurrentUser(toUser(res));
        setToken(await authService.getAccessToken());
      } else {
        setCurrentUser(null);
        setToken(null);
      }
      if (!cancelled) setIsLoadingSession(false);
    };
    verifyInitialSession();
    return () => {
      cancelled = true;
    };
  }, [showAuthToast]);

  const login = async (username: string, passwordPlain: string): Promise<{ success: boolean; message: string }> => {
    const res = await authService.login(username, passwordPlain);
    if (res.success && res.user) {
      setCurrentUser(toUser(res.user));
      setToken(res.token);
      return { success: true, message: res.message };
    }
    return { success: false, message: res.message };
  };

  const logout = () => {
    // Tandai dulu agar event SIGNED_OUT tidak dianggap sesi berakhir
    currentUserRef.current = null;
    storageService.clearLocalMachineCache();
    setCurrentUser(null);
    setToken(null);
    void authService.logout();
  };

  const changePassword = async (
    oldPasswordPlain: string,
    newPasswordPlain: string
  ): Promise<{ success: boolean; message: string }> => {
    return await authService.changePassword(oldPasswordPlain, newPasswordPlain);
  };

  // Hak akses: murni dari data server (view v_me)
  const isAdminMaster = currentUser?.role === 'ADMIN_MASTER';
  const isAllSites = currentUser?.role === 'ALL_SITES';

  const canAddUser = Boolean(currentUser?.canAddUser);
  const canUseRackMap = Boolean(currentUser?.canUseRackMap);

  const canAccessSite = (siteId: SiteId): boolean => {
    if (!currentUser) return false;
    return currentUser.siteAccess.includes(siteId);
  };

  // Tampilan menu saja. Penegakan sesungguhnya ada di database (RLS + fungsi server).
  const canPerformAction = (action: ActionName): boolean => {
    if (!currentUser) return false;
    switch (action) {
      case 'ADMIN':
        return isAdminMaster;
      case 'REPORTS':
        return isAdminMaster || isAllSites;
      case 'MOVE':
      case 'TRANSFER':
      case 'OPNAME':
      case 'UNDO':
      case 'CHANGE_STATUS':
      case 'VIEW_DETAIL':
        return true;
      default:
        return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        token,
        isLoadingSession,
        language,
        authToast,
        clearAuthToast,
        setLanguage,
        login,
        logout,
        changePassword,
        canAccessSite,
        canPerformAction,
        canAddUser,
        canUseRackMap,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    return defaultAuthContext;
  }
  return context;
};
