import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../services/authContext';
import {
  gasAuthService,
  GasManagedUser,
  UserServerRole,
} from '../services/gasAuthService';
import {
  Users,
  UserPlus,
  RotateCcw,
  Shield,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Key,
  ShieldCheck,
  Search,
  Eye,
  EyeOff,
  Copy,
  Check,
  Dices,
  Edit3,
  KeyRound,
  Power,
  X,
  MapPin,
  FolderTree,
  AlertTriangle,
  Lock,
} from 'lucide-react';

interface FormErrors {
  nik?: string;
  profileName?: string;
  password?: string;
}

export const UserManagementView: React.FC = () => {
  const { currentUser, canAddUser } = useAuth();

  // Data State
  const [usersList, setUsersList] = useState<GasManagedUser[]>([]);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters & Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterRole, setFilterRole] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Add User Form State
  const [nik, setNik] = useState<string>('');
  const [profileName, setProfileName] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [authority, setAuthority] = useState<string>('PW1');
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Success Created Modal State
  const [createdModalData, setCreatedModalData] = useState<{
    nik: string;
    profile: string;
    temporaryPassword: string;
  } | null>(null);

  // Edit Modal State
  const [editingUser, setEditingUser] = useState<GasManagedUser | null>(null);
  const [editProfile, setEditProfile] = useState<string>('');
  const [editAuthority, setEditAuthority] = useState<string>('PW1');
  const [editActive, setEditActive] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Reset Password Modal State
  const [resettingUser, setResettingUser] = useState<GasManagedUser | null>(null);
  const [newResetPassword, setNewResetPassword] = useState<string>('');
  const [showResetPassword, setShowResetPassword] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [resetSuccessData, setResetSuccessData] = useState<{
    nik: string;
    profile: string;
    temporaryPassword: string;
  } | null>(null);

  // Status Toggle Confirmation State
  const [statusConfirmUser, setStatusConfirmUser] = useState<GasManagedUser | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState<boolean>(false);

  // Toast / Global Notice State
  const [notice, setNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Auto-dismiss notice
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => {
        setNotice(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  // Utility: Generate Random Password
  const generateRandomPassword = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let res = '';
    for (let i = 0; i < 10; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  // Utility: Copy to Clipboard
  const handleCopy = (text: string, id: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(id);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  // Load Users List from API
  const fetchUsers = useCallback(async () => {
    setIsLoadingList(true);
    setFetchError(null);
    try {
      const res = await gasAuthService.listUsers();
      if (res.success && Array.isArray(res.users)) {
        setUsersList(res.users);
      } else {
        setFetchError(res.message || 'Gagal mengambil daftar pengguna dari server.');
      }
    } catch (err: any) {
      setFetchError(err.message || 'Terjadi kesalahan koneksi saat memuat data pengguna.');
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (canAddUser) {
      fetchUsers();
    }
  }, [canAddUser, fetchUsers]);

  // Permission preview generator based on authority
  const getPermissionPreview = (authValue: string) => {
    const authLower = authValue.toLowerCase();
    if (authLower === 'admin master' || authLower === 'admin') {
      return {
        role: 'ADMIN_MASTER' as UserServerRole,
        roleLabel: 'Admin Master',
        roleBadgeColor: 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        sites: ['PW1', 'PW2', 'PW3', 'WH2', 'SW', 'QA'],
        rackMap: true,
        canAddUser: true,
        desc: 'Hak akses penuh ke seluruh modul, semua site, Rack Map WH2, dan mengelola pengguna.',
      };
    }
    if (authLower === 'all sites' || authLower === 'all') {
      return {
        role: 'ALL_SITES' as UserServerRole,
        roleLabel: 'All Sites',
        roleBadgeColor: 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        sites: ['PW1', 'PW2', 'PW3', 'WH2', 'SW', 'QA'],
        rackMap: true,
        canAddUser: false,
        desc: 'Akses ke semua site dan Rack Map WH2. Tidak dapat mengelola pengguna.',
      };
    }
    if (['warehouse2', 'warehouse', 'wh2'].includes(authLower.replace(/\s+/g, ''))) {
      return {
        role: 'WAREHOUSE' as UserServerRole,
        roleLabel: 'Warehouse',
        roleBadgeColor: 'bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
        sites: ['WH2'],
        rackMap: true,
        canAddUser: false,
        desc: 'Dibatasi hanya untuk mesin di Warehouse 2 (WH2). Dapat mengakses Rack Map WH2. Tidak dapat mengelola pengguna.',
      };
    }
    if (['PW1', 'PW2', 'PW3'].includes(authValue.toUpperCase())) {
      const site = authValue.toUpperCase();
      return {
        role: 'FACTORY' as UserServerRole,
        roleLabel: 'Factory',
        roleBadgeColor: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        sites: [site],
        rackMap: false,
        canAddUser: false,
        desc: `Dibatasi hanya untuk mesin di site ${site}. Tidak dapat mengakses Rack Map WH2.`,
      };
    }
    return {
      role: 'UNKNOWN' as UserServerRole,
      roleLabel: 'Unknown',
      roleBadgeColor: 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      sites: [],
      rackMap: false,
      canAddUser: false,
      desc: 'Otoritas belum ditentukan atau tidak dikenal.',
    };
  };

  // Add User Validation
  const validateAddForm = (): boolean => {
    const errors: FormErrors = {};
    const cleanNik = nik.trim();
    const cleanProfile = profileName.trim();

    if (!cleanNik) {
      errors.nik = 'NIK wajib diisi.';
    } else if (!/^[A-Za-z0-9._-]{3,20}$/.test(cleanNik)) {
      errors.nik = 'NIK harus 3–20 karakter alfanumerik (huruf, angka, titik, strip, underscore).';
    }

    if (!cleanProfile) {
      errors.profileName = 'Nama lengkap / profile wajib diisi.';
    }

    if (!password) {
      errors.password = 'Password sementara wajib diisi.';
    } else if (password.length < 6) {
      errors.password = 'Password minimal 6 karakter.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle Add User
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAddForm()) return;

    setIsSubmitting(true);
    setNotice(null);

    const cleanNik = nik.trim();
    const cleanProfile = profileName.trim();
    const tempPassword = password;

    try {
      const res = await gasAuthService.addUser({
        nik: cleanNik,
        password: tempPassword,
        profile: cleanProfile,
        authority,
      });

      if (res.success) {
        setNotice({
          type: 'success',
          text: res.message || `Pengguna ${cleanNik} berhasil ditambahkan.`,
        });
        // Show Credentials Modal
        setCreatedModalData({
          nik: cleanNik,
          profile: cleanProfile,
          temporaryPassword: tempPassword,
        });
        // Reset form
        setNik('');
        setProfileName('');
        setPassword('');
        setAuthority('PW1');
        setFormErrors({});
        // Reload table
        await fetchUsers();
      } else {
        setNotice({
          type: 'error',
          text: res.message || 'Gagal menambahkan pengguna.',
        });
      }
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err.message || 'Terjadi kesalahan sistem saat menambah pengguna.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (user: GasManagedUser) => {
    setEditingUser(user);
    setEditProfile(user.profile);
    setEditAuthority(user.authority);
    setEditActive(user.active !== false);
  };

  // Submit Edit User
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsUpdating(true);
    setNotice(null);

    const payload: {
      nik: string;
      profile?: string;
      authority?: string;
      active?: boolean;
    } = {
      nik: editingUser.nik,
    };

    if (editProfile.trim() !== editingUser.profile) {
      payload.profile = editProfile.trim();
    }
    if (editAuthority !== editingUser.authority) {
      payload.authority = editAuthority;
    }
    if (editActive !== (editingUser.active !== false)) {
      payload.active = editActive;
    }

    try {
      const res = await gasAuthService.updateUser(payload);
      if (res.success) {
        setNotice({
          type: 'success',
          text: res.message || `Data pengguna ${editingUser.nik} berhasil diperbarui.`,
        });
        setEditingUser(null);
        await fetchUsers();
      } else {
        setNotice({
          type: 'error',
          text: res.message || 'Gagal memperbarui data pengguna.',
        });
      }
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err.message || 'Terjadi kesalahan saat memperbarui pengguna.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Open Reset Password Modal
  const handleOpenReset = (user: GasManagedUser) => {
    setResettingUser(user);
    setNewResetPassword('');
    setShowResetPassword(false);
  };

  // Submit Reset Password
  const handleSaveResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser) return;

    if (!newResetPassword || newResetPassword.length < 6) {
      setNotice({
        type: 'error',
        text: 'Password baru minimal 6 karakter.',
      });
      return;
    }

    setIsResetting(true);
    setNotice(null);

    try {
      const res = await gasAuthService.resetPassword({
        nik: resettingUser.nik,
        newPassword: newResetPassword,
      });

      if (res.success) {
        setResetSuccessData({
          nik: resettingUser.nik,
          profile: resettingUser.profile,
          temporaryPassword: newResetPassword,
        });
        setNotice({
          type: 'success',
          text: res.message || `Password untuk ${resettingUser.nik} berhasil direset.`,
        });
        setResettingUser(null);
        await fetchUsers();
      } else {
        setNotice({
          type: 'error',
          text: res.message || 'Gagal mereset password pengguna.',
        });
      }
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err.message || 'Terjadi kesalahan sistem saat mereset password.',
      });
    } finally {
      setIsResetting(false);
    }
  };

  // Toggle User Active Status with confirmation
  const handleToggleStatus = async () => {
    if (!statusConfirmUser) return;
    setIsTogglingStatus(true);
    setNotice(null);

    const newStatus = !(statusConfirmUser.active !== false);

    try {
      const res = await gasAuthService.updateUser({
        nik: statusConfirmUser.nik,
        active: newStatus,
      });

      if (res.success) {
        setNotice({
          type: 'success',
          text: `Status pengguna ${statusConfirmUser.nik} diubah menjadi ${newStatus ? 'Aktif' : 'Nonaktif'}.`,
        });
        setStatusConfirmUser(null);
        await fetchUsers();
      } else {
        setNotice({
          type: 'error',
          text: res.message || 'Gagal mengubah status pengguna.',
        });
      }
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err.message || 'Terjadi kesalahan saat mengubah status.',
      });
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      // Search query filter (NIK or Profile)
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        u.nik.toLowerCase().includes(q) ||
        u.profile.toLowerCase().includes(q);

      // Role filter
      const matchRole =
        filterRole === 'ALL' ||
        u.role === filterRole ||
        (filterRole === 'ADMIN_MASTER' && u.authority.toLowerCase() === 'admin master') ||
        (filterRole === 'ALL_SITES' && u.authority.toLowerCase() === 'all sites') ||
        (filterRole === 'FACTORY' && ['PW1', 'PW2', 'PW3'].includes(u.authority.toUpperCase()));

      // Status filter
      const isActive = u.active !== false;
      const matchStatus =
        filterStatus === 'ALL' ||
        (filterStatus === 'ACTIVE' && isActive) ||
        (filterStatus === 'INACTIVE' && !isActive);

      return matchSearch && matchRole && matchStatus;
    });
  }, [usersList, searchQuery, filterRole, filterStatus]);

  // Statistics
  const stats = useMemo(() => {
    const total = usersList.length;
    const active = usersList.filter((u) => u.active !== false).length;
    const inactive = total - active;
    const rackMap = usersList.filter((u) => u.rackMap).length;
    return { total, active, inactive, rackMap };
  }, [usersList]);

  // Guard hak akses
  if (!canAddUser) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-200 dark:border-amber-800">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Akses Ditolak
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          Anda tidak memiliki akses ke halaman ini. Menu Kelola Pengguna hanya dapat diakses oleh
          akun <b>Admin Master</b>.
        </p>
      </div>
    );
  }

  const currentAddPreview = getPermissionPreview(authority);
  const currentEditPreview = getPermissionPreview(editAuthority);

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-100/70 dark:bg-purple-950/60 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
              Khusus Admin Master
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1.5 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <span>Kelola Pengguna</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Kelola akun dan hak akses pengguna.
          </p>
        </div>

        <button
          type="button"
          disabled={isLoadingList}
          onClick={fetchUsers}
          className="px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 flex items-center gap-2 shadow-xs transition-colors shrink-0 cursor-pointer min-h-[40px]"
        >
          <RotateCcw className={`w-4 h-4 ${isLoadingList ? 'animate-spin text-indigo-600' : ''}`} />
          <span>{isLoadingList ? 'Memuat...' : 'Segarkan'}</span>
        </button>
      </div>

      {/* Global Notice / Toast */}
      {notice && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between gap-3 border animate-in fade-in duration-150 ${
            notice.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium leading-relaxed">{notice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
            Total Pengguna
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
            {stats.total}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Akun Aktif
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {stats.active}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
            Akun Nonaktif
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-500 dark:text-slate-400 mt-1">
            {stats.inactive}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            Akses Rack Map
          </div>
          <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {stats.rackMap}
          </div>
        </div>
      </div>

      {/* Grid 2 Kolom: Form Tambah Pengguna (Kiri) & Tabel Daftar Pengguna (Kanan) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ======================================================== */}
        {/* FORM TAMBAH PENGGUNA BARU (Kiri, span 5) */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Tambah Pengguna Baru
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Pemberian akses akun dan kredensial sementara
              </p>
            </div>
          </div>

          <form onSubmit={handleAddUser} className="space-y-4" noValidate>
            {/* NIK */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                NIK (Nomor Induk Karyawan) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={nik}
                disabled={isSubmitting}
                onChange={(e) => {
                  setNik(e.target.value);
                  if (formErrors.nik) setFormErrors({ ...formErrors, nik: undefined });
                }}
                placeholder="Contoh: 2211025 atau ME-PW1"
                className={`w-full px-3.5 py-2.5 text-xs rounded-xl border bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 transition-colors min-h-[40px] ${
                  formErrors.nik
                    ? 'border-rose-300 dark:border-rose-700 focus:ring-rose-500'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500'
                }`}
                required
              />
              {formErrors.nik ? (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                  {formErrors.nik}
                </p>
              ) : (
                <p className="text-[10px] text-slate-400 mt-1">
                  3–20 karakter alfanumerik (huruf, angka, titik, strip, underscore).
                </p>
              )}
            </div>

            {/* Nama Lengkap */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Nama Lengkap / Profile <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={profileName}
                disabled={isSubmitting}
                onChange={(e) => {
                  setProfileName(e.target.value);
                  if (formErrors.profileName) setFormErrors({ ...formErrors, profileName: undefined });
                }}
                placeholder="Contoh: Budi Santoso (Mekanik PW1)"
                className={`w-full px-3.5 py-2.5 text-xs rounded-xl border bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 transition-colors min-h-[40px] ${
                  formErrors.profileName
                    ? 'border-rose-300 dark:border-rose-700 focus:ring-rose-500'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500'
                }`}
                required
              />
              {formErrors.profileName && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                  {formErrors.profileName}
                </p>
              )}
            </div>

            {/* Password Sementara */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Password Sementara <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const rand = generateRandomPassword();
                      setPassword(rand);
                      if (formErrors.password) setFormErrors({ ...formErrors, password: undefined });
                    }}
                    className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer"
                  >
                    <Dices className="w-3.5 h-3.5" />
                    <span>Buat acak</span>
                  </button>
                  {password && (
                    <button
                      type="button"
                      onClick={() => handleCopy(password, 'add-pw')}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      {copiedField === 'add-pw' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-600">Disalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (formErrors.password) setFormErrors({ ...formErrors, password: undefined });
                  }}
                  placeholder="Minimal 6 karakter"
                  className={`w-full pl-3.5 pr-10 py-2.5 text-xs rounded-xl border bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 transition-colors min-h-[40px] ${
                    formErrors.password
                      ? 'border-rose-300 dark:border-rose-700 focus:ring-rose-500'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500'
                  }`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {formErrors.password ? (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                  {formErrors.password}
                </p>
              ) : (
                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Password disimpan dalam bentuk hash dan tidak dapat dilihat oleh siapa pun.</span>
                </p>
              )}
            </div>

            {/* Dropdown Authority */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Authority (Tingkat Otoritas) <span className="text-rose-500">*</span>
              </label>
              <select
                value={authority}
                disabled={isSubmitting}
                onChange={(e) => setAuthority(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium min-h-[40px] cursor-pointer"
              >
                <option value="admin master">Admin Master - semua site + kelola pengguna</option>
                <option value="all sites">All Sites - semua site, tanpa kelola pengguna</option>
                <option value="PW1">PW1 - Pabrik Factory 1</option>
                <option value="PW2">PW2 - Pabrik Factory 2</option>
                <option value="PW3">PW3 - Pabrik Factory 3</option>
                <option value="Warehouse 2">Warehouse 2 - hanya WH2 + Rack Map</option>
              </select>
            </div>

            {/* Live Permission Preview Panel */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/70 dark:border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Hak akses yang akan diberikan:
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${currentAddPreview.roleBadgeColor}`}>
                  {currentAddPreview.roleLabel}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Akses Rack Map</span>
                  <span className={`font-bold ${currentAddPreview.rackMap ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {currentAddPreview.rackMap ? 'Ya' : 'Tidak'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Kelola Pengguna</span>
                  <span className={`font-bold ${currentAddPreview.canAddUser ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {currentAddPreview.canAddUser ? 'Ya' : 'Tidak'}
                  </span>
                </div>
              </div>

              <div>
                <div className="text-[10px] text-slate-400 mb-1 font-medium">Site yang dapat diakses:</div>
                <div className="flex flex-wrap gap-1">
                  {currentAddPreview.sites.map((s) => (
                    <span
                      key={s}
                      className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-slate-500 dark:text-slate-400 italic pt-1 border-t border-slate-200/50 dark:border-slate-800">
                {currentAddPreview.desc}
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer min-h-[40px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan Pengguna...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Tambah Pengguna</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* ======================================================== */}
        {/* TABEL DAFTAR PENGGUNA (Kanan, span 7) */}
        {/* ======================================================== */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          {/* Top Title & Total Count */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Daftar Pengguna
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {usersList.length} akun terdaftar di sistem
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 self-start sm:self-auto">
              Total: {usersList.length}
            </span>
          </div>

          {/* Filter Bar: Search, Role, Status */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            {/* Search Input */}
            <div className="sm:col-span-6 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari NIK atau Nama..."
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[38px]"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Role */}
            <div className="sm:col-span-3">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[38px] cursor-pointer"
              >
                <option value="ALL">Semua Role</option>
                <option value="ADMIN_MASTER">Admin Master</option>
                <option value="ALL_SITES">All Sites</option>
                <option value="FACTORY">Factory</option>
                <option value="WAREHOUSE">Warehouse</option>
                <option value="UNKNOWN">Unknown</option>
              </select>
            </div>

            {/* Filter Status */}
            <div className="sm:col-span-3">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[38px] cursor-pointer"
              >
                <option value="ALL">Semua Status</option>
                <option value="ACTIVE">Aktif</option>
                <option value="INACTIVE">Nonaktif</option>
              </select>
            </div>
          </div>

          {/* Table / List Container */}
          {isLoadingList ? (
            /* Skeleton Loading State */
            <div className="py-10 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse"
                />
              ))}
              <div className="text-center text-xs text-slate-400 flex items-center justify-center gap-2 pt-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                <span>Memuat data pengguna dari server...</span>
              </div>
            </div>
          ) : fetchError ? (
            /* Error State with Retry Button */
            <div className="py-12 px-4 text-center space-y-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-2xl">
              <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
              <div className="text-sm font-bold text-rose-900 dark:text-rose-200">
                Gagal Memuat Data Pengguna
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-300 max-w-md mx-auto">
                {fetchError}
              </p>
              <button
                type="button"
                onClick={fetchUsers}
                className="mt-2 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer min-h-[40px]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Coba Lagi</span>
              </button>
            </div>
          ) : filteredUsers.length === 0 ? (
            /* Empty State */
            <div className="py-14 text-center text-slate-400 dark:text-slate-500 text-xs space-y-2">
              <Users className="w-8 h-8 mx-auto opacity-40 text-slate-400" />
              <div className="font-semibold text-slate-600 dark:text-slate-400">
                Tidak ada pengguna yang sesuai
              </div>
              <p className="text-[11px] max-w-xs mx-auto">
                {searchQuery || filterRole !== 'ALL' || filterStatus !== 'ALL'
                  ? 'Coba sesuaikan kata kunci pencarian atau filter yang dipilih.'
                  : 'Belum ada data pengguna yang terdaftar di server.'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="pb-3 pl-2">NIK</th>
                      <th className="pb-3">Nama</th>
                      <th className="pb-3">Role</th>
                      <th className="pb-3">Site Akses</th>
                      <th className="pb-3 text-center">Rack Map</th>
                      <th className="pb-3 text-center">Status</th>
                      <th className="pb-3 pr-2 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                    {filteredUsers.map((u) => {
                      const isSelf =
                        currentUser?.username.toLowerCase() === u.nik.toLowerCase();
                      const isActive = u.active !== false;

                      // Badge Role Color
                      let roleBadgeClass =
                        'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
                      if (u.role === 'ADMIN_MASTER') {
                        roleBadgeClass =
                          'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
                      } else if (u.role === 'ALL_SITES') {
                        roleBadgeClass =
                          'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
                      } else if (u.role === 'UNKNOWN') {
                        roleBadgeClass =
                          'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
                      }

                      return (
                        <tr
                          key={u.nik}
                          className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                            !isActive ? 'opacity-60 bg-slate-50/40 dark:bg-slate-900/30' : ''
                          }`}
                        >
                          {/* NIK */}
                          <td className="py-3 pl-2 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span>{u.nik}</span>
                              {isSelf && (
                                <span className="text-[9px] font-sans font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  Anda
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Nama */}
                          <td className="py-3 text-slate-700 dark:text-slate-300 font-medium">
                            <div className="max-w-[150px] truncate" title={u.profile}>
                              {u.profile || '—'}
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td className="py-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase border ${roleBadgeClass}`}
                            >
                              {u.role === 'ADMIN_MASTER'
                                ? 'Admin Master'
                                : u.role === 'ALL_SITES'
                                ? 'All Sites'
                                : u.role === 'WAREHOUSE'
                                ? 'Warehouse'
                                : u.role === 'FACTORY'
                                ? 'Factory'
                                : 'Unknown'}
                            </span>
                          </td>

                          {/* Sites */}
                          <td className="py-3">
                            <div className="flex flex-wrap gap-1 max-w-[160px]">
                              {u.sites && u.sites.length > 0 ? (
                                u.sites.map((s) => (
                                  <span
                                    key={s}
                                    className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                  >
                                    {s}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 text-[10px]">—</span>
                              )}
                            </div>
                          </td>

                          {/* Rack Map */}
                          <td className="py-3 text-center">
                            {u.rackMap ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Ya</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isActive
                                  ? 'bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {isActive ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>

                          {/* Aksi */}
                          <td className="py-3 pr-2 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              {/* Edit Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(u)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer"
                                title="Edit Pengguna"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              {/* Reset Password Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenReset(u)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition-colors cursor-pointer"
                                title="Reset Password"
                              >
                                <KeyRound className="w-4 h-4" />
                              </button>

                              {/* Nonaktifkan / Aktifkan Button */}
                              <button
                                type="button"
                                disabled={isSelf}
                                onClick={() => setStatusConfirmUser(u)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  isSelf
                                    ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                                    : isActive
                                    ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer'
                                    : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer'
                                }`}
                                title={
                                  isSelf
                                    ? 'Tidak dapat mengubah akun sendiri'
                                    : isActive
                                    ? 'Nonaktifkan Akun'
                                    : 'Aktifkan Akun'
                                }
                              >
                                <Power className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List */}
              <div className="md:hidden space-y-3">
                {filteredUsers.map((u) => {
                  const isSelf =
                    currentUser?.username.toLowerCase() === u.nik.toLowerCase();
                  const isActive = u.active !== false;

                  return (
                    <div
                      key={u.nik}
                      className={`p-4 rounded-xl border transition-colors space-y-2.5 ${
                        !isActive
                          ? 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800 opacity-60'
                          : 'bg-white dark:bg-slate-900/90 border-slate-200/80 dark:border-slate-800 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-sm text-slate-900 dark:text-white">
                            {u.profile || 'Tanpa Nama'}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-xs text-slate-600 dark:text-slate-300 font-bold">
                              {u.nik}
                            </span>
                            {isSelf && (
                              <span className="text-[9px] font-sans font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                Anda
                              </span>
                            )}
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            isActive
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {u.authority}
                        </span>

                        {u.rackMap && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-semibold">
                            Rack Map
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1 pt-1">
                        {u.sites?.map((s) => (
                          <span
                            key={s}
                            className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          >
                            {s}
                          </span>
                        ))}
                      </div>

                      {/* Mobile Actions */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(u)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center gap-1 min-h-[40px]"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenReset(u)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 transition-colors flex items-center gap-1 min-h-[40px]"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Reset PW</span>
                        </button>
                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={() => setStatusConfirmUser(u)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 min-h-[40px] ${
                            isSelf
                              ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400'
                              : isActive
                              ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100'
                              : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                          <span>{isActive ? 'Nonaktifkan' : 'Aktifkan'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: SUKSES TAMBAH PENGGUNA (Tampilkan Kredensial) */}
      {/* ======================================================== */}
      {createdModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Akun Berhasil Dibuat
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Salin kredensial sementara untuk diberikan ke pengguna
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 space-y-3">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  Nama Lengkap
                </div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  {createdModalData.profile}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  NIK (Username Login)
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 font-mono text-xs font-bold text-slate-900 dark:text-white">
                  <span>{createdModalData.nik}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(createdModalData.nik, 'created-nik')}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 cursor-pointer"
                  >
                    {copiedField === 'created-nik' ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  Password Sementara
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  <span>{createdModalData.temporaryPassword}</span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(createdModalData.temporaryPassword, 'created-pw')
                    }
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 cursor-pointer"
                  >
                    {copiedField === 'created-pw' ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                Password tidak dapat dilihat lagi setelah dialog ini ditutup. Berikan langsung ke
                pengguna dan minta ia menggantinya lewat menu Ubah password.
              </span>
            </div>

            <button
              type="button"
              onClick={() => setCreatedModalData(null)}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-black dark:hover:bg-slate-100 transition-colors cursor-pointer min-h-[40px]"
            >
              Tutup Dialog
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: EDIT PENGGUNA */}
      {/* ======================================================== */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                    Edit Pengguna: {editingUser.nik}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Perbarui data nama, otoritas, dan status akun
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* NIK (Readonly) */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  NIK (Tidak dapat diubah)
                </label>
                <input
                  type="text"
                  value={editingUser.nik}
                  disabled
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/60 text-slate-500 font-mono cursor-not-allowed"
                />
              </div>

              {/* Nama Lengkap */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Nama Lengkap / Profile <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editProfile}
                  onChange={(e) => setEditProfile(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[40px]"
                  required
                />
              </div>

              {/* Authority */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Authority (Tingkat Otoritas)
                </label>
                <select
                  value={editAuthority}
                  onChange={(e) => setEditAuthority(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[40px] cursor-pointer"
                >
                  <option value="admin master">Admin Master - semua site + kelola pengguna</option>
                  <option value="all sites">All Sites - semua site, tanpa kelola pengguna</option>
                  <option value="PW1">PW1 - Pabrik Factory 1</option>
                  <option value="PW2">PW2 - Pabrik Factory 2</option>
                  <option value="PW3">PW3 - Pabrik Factory 3</option>
                  <option value="Warehouse 2">Warehouse 2 - hanya WH2 + Rack Map</option>
                </select>
              </div>

              {/* Status Switch */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Status Akun</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {editActive ? 'Pengguna dapat login dan beraktivitas' : 'Akses pengguna dinonaktifkan'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditActive(!editActive)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    editActive ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      editActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Live Permission Preview */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    Pratinjau Hak Akses:
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${currentEditPreview.roleBadgeColor}`}>
                    {currentEditPreview.roleLabel}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {currentEditPreview.sites.map((s) => (
                    <span key={s} className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Warning notice */}
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300">
                Pengguna akan otomatis keluar dan harus login ulang jika hak akses atau status diubah.
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors cursor-pointer min-h-[40px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[40px]"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Perubahan</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: RESET PASSWORD */}
      {/* ======================================================== */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                    Reset Password
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Akun: {resettingUser.nik} ({resettingUser.profile})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResettingUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveResetPassword} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Password Baru Sementara <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewResetPassword(generateRandomPassword())}
                    className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer"
                  >
                    <Dices className="w-3.5 h-3.5" />
                    <span>Buat acak</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    value={newResetPassword}
                    onChange={(e) => setNewResetPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full pl-3.5 pr-10 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[40px]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Password lama tidak dapat dilihat. Berikan password sementara ini ke pengguna.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResettingUser(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors cursor-pointer min-h-[40px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isResetting || newResetPassword.length < 6}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[40px]"
                >
                  {isResetting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mereset...</span>
                    </>
                  ) : (
                    <span>Reset Password</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: SUKSES RESET PASSWORD (Salin Kredensial Baru) */}
      {/* ======================================================== */}
      {resetSuccessData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Password Berhasil Direset
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Berikan password sementara ini kepada pengguna
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 space-y-2.5">
              <div className="text-xs font-semibold text-slate-900 dark:text-white">
                {resetSuccessData.profile} ({resetSuccessData.nik})
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 font-mono text-sm font-bold text-amber-600 dark:text-amber-400">
                <span>{resetSuccessData.temporaryPassword}</span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(resetSuccessData.temporaryPassword, 'reset-copy')
                  }
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 cursor-pointer"
                >
                  {copiedField === 'reset-copy' ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Minta pengguna untuk segera mengganti password sementara ini setelah login pertama kali.
            </p>

            <button
              type="button"
              onClick={() => setResetSuccessData(null)}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-black dark:hover:bg-slate-100 transition-colors cursor-pointer min-h-[40px]"
            >
              Selesai
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: KONFIRMASI AKTIF / NONAKTIFKAN */}
      {/* ======================================================== */}
      {statusConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                statusConfirmUser.active !== false
                  ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-600'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-600'
              }`}>
                <Power className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  {statusConfirmUser.active !== false ? 'Nonaktifkan Akun?' : 'Aktifkan Akun?'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {statusConfirmUser.nik} ({statusConfirmUser.profile})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {statusConfirmUser.active !== false
                ? 'Akun ini tidak akan dapat login ke sistem sampai diaktifkan kembali oleh Admin Master.'
                : 'Akun ini akan dipulihkan dan dapat kembali login serta beraktivitas di sistem.'}
            </p>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setStatusConfirmUser(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors cursor-pointer min-h-[40px]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isTogglingStatus}
                onClick={handleToggleStatus}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[40px] ${
                  statusConfirmUser.active !== false
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isTogglingStatus ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <span>{statusConfirmUser.active !== false ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementView;
