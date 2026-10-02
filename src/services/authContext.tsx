/**
 * Authentication Context & Server-side Authorization Engine
 * Backend (Google Apps Script) adalah SATU-SATUNYA sumber kebenaran untuk login, sesi, dan hak akses.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, SiteId } from '../types';
import { storageService } from './storage';
import {
  gasAuthService,
  getStoredToken,
  getStoredUser,
  clearSession,
  registerAuthCallbacks,
} from './gasAuthService';

interface AuthContextType {
  currentUser: User | null;
  token: string | null;
  isLoadingSession: boolean;
  language: 'id' | 'en';
  authToast: { type: 'error' | 'warning' | 'success'; text: string; id: number } | null;
  clearAuthToast: () => void;
  setLanguage: (lang: 'id' | 'en') => void;
  login: (username: string, passwordPlain: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  changePassword: (oldPasswordPlain: string, newPasswordPlain: string) => Promise<{ success: boolean; message: string }>;
  canAccessSite: (siteId: SiteId) => boolean;
  canPerformAction: (action: 'MOVE' | 'CHANGE_STATUS' | 'TRANSFER' | 'OPNAME' | 'UNDO' | 'ADMIN' | 'REPORTS' | 'VIEW_DETAIL') => boolean;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);
  const [language, setLanguage] = useState<'id' | 'en'>('id');
  const [authToast, setAuthToast] = useState<{
    type: 'error' | 'warning' | 'success';
    text: string;
    id: number;
  } | null>(null);

  const showAuthToast = useCallback((type: 'error' | 'warning' | 'success', text: string) => {
    setAuthToast({ type, text, id: Date.now() });
  }, []);

  const clearAuthToast = useCallback(() => {
    setAuthToast(null);
  }, []);

  // Daftarkan listener global UNAUTHORIZED dan FORBIDDEN
  useEffect(() => {
    registerAuthCallbacks(
      () => {
        // UNAUTHORIZED: Hapus sesi, bersihkan cache mesin lokal, kembali ke login
        storageService.clearLocalMachineCache();
        setCurrentUser(null);
        setToken(null);
        clearSession();
        showAuthToast('error', 'Sesi berakhir, silakan login kembali');
      },
      (msg: string) => {
        // FORBIDDEN: Tampilkan pesan dari server
        showAuthToast('warning', msg || 'Akses ditolak (FORBIDDEN)');
      }
    );
  }, [showAuthToast]);

  // Cek sesi otomatis saat aplikasi dibuka (ME action)
  useEffect(() => {
    const verifyInitialSession = async () => {
      setIsLoadingSession(true);
      const existingToken = getStoredToken();
      const existingUser = getStoredUser();

      if (existingToken && existingUser) {
        // Set state sementara dari sessionStorage agar tidak berkedip saat verifikasi
        setToken(existingToken);
        setCurrentUser({
          username: existingUser.username,
          displayName: existingUser.displayName,
          role: existingUser.role,
          siteAccess: existingUser.siteAccess || [],
          canAddUser: existingUser.canAddUser,
          canUseRackMap: existingUser.canUseRackMap,
          authority: existingUser.role,
          active: true,
          failedAttempts: 0,
        });

        // Verifikasi ke server GAS (ME)
        try {
          const res = await gasAuthService.checkMe();
          if (res.success && res.user) {
            setToken(existingToken);
            setCurrentUser({
              username: res.user.username,
              displayName: res.user.displayName,
              role: res.user.role,
              siteAccess: res.user.siteAccess || [],
              canAddUser: res.user.canAddUser,
              canUseRackMap: res.user.canUseRackMap,
              authority: res.user.role,
              active: true,
              failedAttempts: 0,
            });
          } else {
            setCurrentUser(null);
            setToken(null);
            clearSession();
          }
        } catch {
          setCurrentUser(null);
          setToken(null);
          clearSession();
        }
      } else {
        setCurrentUser(null);
        setToken(null);
        clearSession();
      }
      setIsLoadingSession(false);
    };

    verifyInitialSession();
  }, []);

  const login = async (username: string, passwordPlain: string): Promise<{ success: boolean; message: string }> => {
    const res = await gasAuthService.login(username, passwordPlain);
    if (res.success && res.user && res.token) {
      const u: User = {
        username: res.user.username,
        displayName: res.user.displayName,
        role: res.user.role,
        siteAccess: res.user.siteAccess || [],
        canAddUser: res.user.canAddUser,
        canUseRackMap: res.user.canUseRackMap,
        authority: res.user.role,
        active: true,
        failedAttempts: 0,
      };
      setCurrentUser(u);
      setToken(res.token);
      return { success: true, message: res.message || 'Login berhasil' };
    }
    return { success: false, message: res.message || 'NIK atau password salah' };
  };

  const logout = () => {
    gasAuthService.logout();
    storageService.clearLocalMachineCache();
    setCurrentUser(null);
    setToken(null);
  };

  const changePassword = async (oldPasswordPlain: string, newPasswordPlain: string): Promise<{ success: boolean; message: string }> => {
    return await gasAuthService.changePassword(oldPasswordPlain, newPasswordPlain);
  };

  // Normalisasi role server: "ADMIN_MASTER" | "ALL_SITES" | "FACTORY" / custom
  const roleKey = String(currentUser?.role || '').toLowerCase().replace(/[\s_-]/g, '');
  const isAdminMaster = roleKey === 'adminmaster' || roleKey === 'admin';
  const isAllSites = roleKey === 'allsites' || roleKey === 'all';

  // Hak akses murni bersumber dari data server (currentUser)
  const canAddUser = Boolean(
    currentUser?.canAddUser ||
    isAdminMaster
  );

  const canUseRackMap = Boolean(
    currentUser?.canUseRackMap ||
    (currentUser?.siteAccess && (currentUser.siteAccess.includes('WH2') || currentUser.siteAccess.includes('ALL'))) ||
    isAdminMaster ||
    isAllSites
  );

  const canAccessSite = (siteId: SiteId): boolean => {
    if (!currentUser) return false;
    const rKey = String(currentUser.role || '').toLowerCase().replace(/[\s_-]/g, '');
    const isAdm = rKey === 'adminmaster' || rKey === 'admin';
    const isAll = rKey === 'allsites' || rKey === 'all';

    // Utamakan currentUser.siteAccess dari server
    if (currentUser.siteAccess && currentUser.siteAccess.includes('ALL')) {
      return true;
    }
    if (isAdm || isAll) {
      return true;
    }
    return currentUser.siteAccess ? currentUser.siteAccess.includes(siteId) : false;
  };

  const canPerformAction = (
    action: 'MOVE' | 'CHANGE_STATUS' | 'TRANSFER' | 'OPNAME' | 'UNDO' | 'ADMIN' | 'REPORTS' | 'VIEW_DETAIL'
  ): boolean => {
    if (!currentUser) return false;
    const rKey = String(currentUser.role || '').toLowerCase().replace(/[\s_-]/g, '');
    const isAdm = rKey === 'adminmaster' || rKey === 'admin';
    const isAll = rKey === 'allsites' || rKey === 'all';

    switch (action) {
      case 'ADMIN':
        return isAdm;
      case 'REPORTS':
        return isAdm || isAll;
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
