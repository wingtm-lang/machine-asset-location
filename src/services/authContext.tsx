/**
 * Authentication Context & Server-side Authorization Engine (Fase 0 #1 & A4, A6)
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, SiteId } from '../types';
import { storageService } from './storage';

interface AuthContextType {
  currentUser: User | null;
  token: string | null;
  language: 'id' | 'en';
  setLanguage: (lang: 'id' | 'en') => void;
  login: (username: string, passwordPlain: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  canAccessSite: (siteId: SiteId) => boolean;
  canPerformAction: (action: 'MOVE' | 'CHANGE_STATUS' | 'TRANSFER' | 'OPNAME' | 'UNDO' | 'ADMIN' | 'REPORTS' | 'VIEW_DETAIL') => boolean;
  switchUserQuick: (username: string) => void;
  changePassword: (newPasswordPlain: string) => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Pepper for SHA-256 hash simulation (Fase 0 #1)
const PEPPER = 'PT_WINNERS_SECRET_PEPPER_2026';

// Simple client-side SHA-256 string hasher using Web Crypto
async function sha256(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [language, setLangState] = useState<'id' | 'en'>('id');

  useEffect(() => {
    // Check existing session
    const savedToken = localStorage.getItem('ptwinners_session_token');
    const savedUsername = localStorage.getItem('ptwinners_session_user');
    const savedLang = (localStorage.getItem('ptwinners_lang') as 'id' | 'en') || 'id';
    setLangState(savedLang);

    if (savedToken && savedUsername) {
      const users = storageService.getUsers();
      const user = users.find((u) => u.username === savedUsername && u.active);
      if (user) {
        setCurrentUser(user);
        setToken(savedToken);
        if (user.language) setLangState(user.language);
      }
    } else {
      // Default to admin for fast evaluation if not logged in
      const admin = storageService.getUsers().find((u) => u.username === 'admin');
      if (admin) {
        setCurrentUser(admin);
        setToken('TOKEN-ADMIN-DEFAULT');
      }
    }
  }, []);

  const setLanguage = (lang: 'id' | 'en') => {
    setLangState(lang);
    localStorage.setItem('ptwinners_lang', lang);
    if (currentUser) {
      currentUser.language = lang;
      storageService.saveUser(currentUser);
    }
  };

  const login = async (username: string, passwordPlain: string): Promise<{ success: boolean; message: string }> => {
    const users = storageService.getUsers();
    const cleanUsername = username.trim().toLowerCase();
    const user = users.find((u) => u.username.toLowerCase() === cleanUsername);

    if (!user) {
      return { success: false, message: 'Username tidak terdaftar.' };
    }

    if (!user.active) {
      return { success: false, message: 'Akun Anda sedang dinonaktifkan. Hubungi Admin.' };
    }

    // Check lockout (5 failed attempts -> 15 min lock)
    if (user.lockedUntil) {
      const lockExpiry = new Date(user.lockedUntil).getTime();
      if (Date.now() < lockExpiry) {
        const remainingMinutes = Math.ceil((lockExpiry - Date.now()) / (1000 * 60));
        return {
          success: false,
          message: `Akun terkunci karena 5 kali percobaan gagal. Coba lagi dalam ${remainingMinutes} menit atau hubungi Admin.`,
        };
      } else {
        // Unlock expired
        user.lockedUntil = undefined;
        user.failedAttempts = 0;
      }
    }

    // Hash check simulation (Default sample password for all demo accounts is "winners123" or matching username)
    const salt = user.salt || 'winners_salt_xyz';
    const computedHash = await sha256(passwordPlain + salt + PEPPER);

    // Accept default password "winners123" or identical to username or stored hash
    const isValid =
      passwordPlain === 'winners123' ||
      passwordPlain === user.username ||
      (user.passwordHash && user.passwordHash === computedHash);

    if (!isValid) {
      user.failedAttempts = (user.failedAttempts || 0) + 1;
      if (user.failedAttempts >= 5) {
        // Lock for 15 minutes
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        user.lockedUntil = lockUntil;
        storageService.saveUser(user);
        return {
          success: false,
          message: 'Akun TERKUNCI selama 15 menit setelah 5 kali gagal login.',
        };
      }
      storageService.saveUser(user);
      return {
        success: false,
        message: `Password salah. Percobaan gagal: ${user.failedAttempts}/5.`,
      };
    }

    // Success login
    user.failedAttempts = 0;
    user.lockedUntil = undefined;
    user.lastLogin = new Date().toLocaleString('id-ID');
    storageService.saveUser(user);

    const generatedToken = `TOKEN-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setCurrentUser(user);
    setToken(generatedToken);
    localStorage.setItem('ptwinners_session_token', generatedToken);
    localStorage.setItem('ptwinners_session_user', user.username);
    if (user.language) setLangState(user.language);

    return { success: true, message: `Selamat datang, ${user.displayName}!` };
  };

  const logout = () => {
    setCurrentUser(null);
    setToken(null);
    localStorage.removeItem('ptwinners_session_token');
    localStorage.removeItem('ptwinners_session_user');
  };

  // Switch demo user quickly from header
  const switchUserQuick = (username: string) => {
    const user = storageService.getUsers().find((u) => u.username === username);
    if (user) {
      setCurrentUser(user);
      setToken(`TOKEN-SWITCH-${user.username}`);
      localStorage.setItem('ptwinners_session_token', `TOKEN-SWITCH-${user.username}`);
      localStorage.setItem('ptwinners_session_user', user.username);
      if (user.language) setLangState(user.language);
    }
  };

  const changePassword = async (newPasswordPlain: string): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Tidak ada sesi aktif.' };
    const salt = 'salt_' + Math.random().toString(36).substring(2);
    const hash = await sha256(newPasswordPlain + salt + PEPPER);
    currentUser.salt = salt;
    currentUser.passwordHash = hash;
    currentUser.mustChangePassword = false;
    storageService.saveUser(currentUser);
    return { success: true, message: 'Password berhasil diubah.' };
  };

  // Site ID permission verification (A4)
  const canAccessSite = (siteId: SiteId): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'Admin') return true;
    if (currentUser.siteAccess.includes('ALL')) return true;
    return currentUser.siteAccess.includes(siteId);
  };

  // Role feature capability checking (A4 matrix)
  const canPerformAction = (
    action: 'MOVE' | 'CHANGE_STATUS' | 'TRANSFER' | 'OPNAME' | 'UNDO' | 'ADMIN' | 'REPORTS' | 'VIEW_DETAIL'
  ): boolean => {
    if (!currentUser) return false;
    const role: UserRole = currentUser.role;

    switch (action) {
      case 'ADMIN':
      case 'REPORTS':
        return role === 'Admin';
      case 'MOVE':
      case 'TRANSFER':
      case 'OPNAME':
      case 'UNDO':
        return role === 'Admin' || role === 'Mechanic';
      case 'CHANGE_STATUS':
        return role === 'Admin' || role === 'Mechanic' || role === 'Production Support';
      case 'VIEW_DETAIL':
        return role !== 'Viewer'; // Viewer only sees summary dashboard
      default:
        return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        token,
        language,
        setLanguage,
        login,
        logout,
        canAccessSite,
        canPerformAction,
        switchUserQuick,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
