import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';
import useAuthStore from '../store/authStore.js';

const PendingApprovalsContext = createContext(null);

export function PendingApprovalsProvider({ children }) {
  const { user } = useAuthStore();
  const [globalPendingCount, setGlobalPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadGlobalPendingCount = useCallback(async () => {
    if (!user?.isAdmin) {
      setGlobalPendingCount(0);
      return;
    }
    try {
      setLoading(true);
      const data = await api.getPendingVersionsCount();
      setGlobalPendingCount(data.count || 0);
    } catch (error) {
      console.error('Failed to load global pending count:', error);
      setGlobalPendingCount(0);
    } finally {
      setLoading(false);
    }
  }, [user?.isAdmin]);

  useEffect(() => {
    if (user?.isAdmin) {
      loadGlobalPendingCount();
      const interval = setInterval(loadGlobalPendingCount, 30000);
      return () => clearInterval(interval);
    } else {
      setGlobalPendingCount(0);
    }
  }, [user?.isAdmin, loadGlobalPendingCount]);

  const refresh = useCallback(() => {
    loadGlobalPendingCount();
  }, [loadGlobalPendingCount]);

  return (
    <PendingApprovalsContext.Provider
      value={{
        globalPendingCount,
        loading,
        refresh,
      }}
    >
      {children}
    </PendingApprovalsContext.Provider>
  );
}

export function usePendingApprovals() {
  const context = useContext(PendingApprovalsContext);
  if (!context) {
    throw new Error('usePendingApprovals must be used within PendingApprovalsProvider');
  }
  return context;
}

