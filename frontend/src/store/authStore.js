import { create } from 'zustand';
import { api } from '../lib/api.js';

const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,
  error: null,

  // Initialize auth state on mount
  init: async () => {
    try {
      const data = await api.getCurrentUser();
      set({ user: data.user, loading: false, error: null });
    } catch (error) {
      set({ user: null, loading: false, error: null });
    }
  },

  // Login with email/password
  login: async (email, password) => {
    try {
      set({ error: null });
      const data = await api.login(email, password);
      set({ user: data.user });
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
      set({ user: null, error: null });
    } catch (error) {
      console.error('Logout error:', error);
      // Clear user anyway
      set({ user: null, error: null });
    }
  },

  // Clear error
  clearError: () => set({ error: null }),

  // Check if user is authenticated
  isAuthenticated: () => !!get().user,

  // Check if user is verified
  isVerified: () => get().user?.verifiedAccount === true,

  // Check if user is admin
  isAdmin: () => get().user?.isAdmin === true,
}));

export default useAuthStore;

