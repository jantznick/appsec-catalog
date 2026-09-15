import { create } from 'zustand';
import { api } from '../lib/api.js';
import {
  checkPermission,
  companiesWithPermission,
  hasPermissionAnywhere,
} from '../lib/permissions.js';

const useAuthStore = create((set, get) => ({
  user: null,
  // RBAC payload from /api/auth/me: { isSystemAdmin, global, allCompanies, byCompany, ... }
  permissions: null,
  loading: true,
  error: null,

  // Initialize auth state on mount
  init: async () => {
    try {
      const data = await api.getCurrentUser();
      set({ user: data.user, permissions: data.permissions ?? null, loading: false, error: null });
    } catch (error) {
      set({ user: null, permissions: null, loading: false, error: null });
    }
  },

  // Re-read the session, e.g. after roles change
  refresh: async () => {
    try {
      const data = await api.getCurrentUser();
      set({ user: data.user, permissions: data.permissions ?? null });
    } catch {
      // Leave existing state alone; a failure here is not a logout.
    }
  },

  // Login with email/password
  login: async (email, password) => {
    try {
      set({ error: null });
      const data = await api.login(email, password);
      set({ user: data.user });
      // The login response carries the user but not the permission payload.
      await get().refresh();
      return { success: true };
    } catch (error) {
      set({ error: error.message });
      return { success: false, error: error.message };
    }
  },

  // Register new user
  register: async (email, password) => {
    try {
      set({ error: null });
      const data = await api.register(email, password);
      // Don't set user - they need to login after registration
      return { success: true, message: data.message };
    } catch (error) {
      set({ error: error.message });
      return { success: false, error: error.message };
    }
  },

  // Request magic code
  requestMagicCode: async (email) => {
    try {
      set({ error: null });
      const data = await api.requestMagicCode(email);
      return { success: true, message: data.message };
    } catch (error) {
      set({ error: error.message });
      return { success: false, error: error.message };
    }
  },

  // Login with magic code
  loginWithMagicCode: async (code) => {
    try {
      set({ error: null });
      const data = await api.loginWithMagicCode(code);
      set({ user: data.user });
      await get().refresh();
      return { success: true };
    } catch (error) {
      set({ error: error.message });
      return { success: false, error: error.message };
    }
  },

  // Logout
  logout: async () => {
    try {
      await api.logout();
      set({ user: null, permissions: null, error: null });
    } catch (error) {
      console.error('Logout error:', error);
      // Clear user anyway
      set({ user: null, permissions: null, error: null });
    }
  },

  // Clear error
  clearError: () => set({ error: null }),

  // Check if user is authenticated
  isAuthenticated: () => !!get().user,

  // Check if user is verified
  isVerified: () => get().user?.verifiedAccount === true,

  // Check if user is a system-wide administrator.
  // This is the system superuser flag, not the per-company "Company Admin"
  // role — for company-level access use can()/canAnywhere() below.
  isAdmin: () => get().user?.isAdmin === true,

  /**
   * Does the current user hold `permission`?
   * Company-scoped permissions need the companyId they're being checked for.
   * UI gating only; the server enforces the same check on every request.
   */
  can: (permission, companyId = null) =>
    checkPermission(get().permissions, permission, companyId),

  /** Does the user hold `permission` in at least one company? */
  canAnywhere: (permission) => hasPermissionAnywhere(get().permissions, permission),

  /** Every company where the user holds `permission`. */
  companiesWith: (permission) => companiesWithPermission(get().permissions, permission),
}));

export default useAuthStore;
