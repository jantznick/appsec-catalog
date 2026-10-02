import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';
import useAuthStore from '../store/authStore.js';

const PendingApprovalsContext = createContext(null);

/**
 * Shared poller for the admin notification badges. Counts are kept separate
 * (they link to different pages and mean different things) but share one
 * interval so we're not running several timers against the same session.
 *
 * Every queue here is system-admin only: metadata approvals have no
 * delegatable permission (see backend/rbac/permissions.js), and information
 * and feature requests both span every company.
 */
export function PendingApprovalsProvider({ children }) {
  const { user } = useAuthStore();
  const [globalPendingCount, setGlobalPendingCount] = useState(0);
  const [infoRequestCount, setInfoRequestCount] = useState(0);
  const [featureRequestCount, setFeatureRequestCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadCounts = useCallback(async () => {
    if (!user?.isAdmin) {
      setGlobalPendingCount(0);
      setInfoRequestCount(0);
      setFeatureRequestCount(0);
      return;
    }
    setLoading(true);
    // Settled rather than all-or-nothing: one failing endpoint shouldn't blank
    // out the other badges.
    const [pending, infoRequests, featureRequests] = await Promise.allSettled([
      api.getPendingVersionsCount(),
      api.getProgramRequestCount(),
      api.getFeatureRequestCount(),
    ]);

    if (pending.status === 'fulfilled') {
      setGlobalPendingCount(pending.value?.count || 0);
    } else {
      console.error('Failed to load global pending count:', pending.reason);
      setGlobalPendingCount(0);
    }

    if (infoRequests.status === 'fulfilled') {
      setInfoRequestCount(infoRequests.value?.count || 0);
    } else {
      console.error('Failed to load information request count:', infoRequests.reason);
      setInfoRequestCount(0);
    }

    if (featureRequests.status === 'fulfilled') {
      setFeatureRequestCount(featureRequests.value?.count || 0);
    } else {
      console.error('Failed to load feature request count:', featureRequests.reason);
      setFeatureRequestCount(0);
    }

    setLoading(false);
  }, [user?.isAdmin]);

  useEffect(() => {
    if (user?.isAdmin) {
      loadCounts();
      const interval = setInterval(loadCounts, 30000);
      return () => clearInterval(interval);
    }
    setGlobalPendingCount(0);
    setInfoRequestCount(0);
    setFeatureRequestCount(0);
    return undefined;
  }, [user?.isAdmin, loadCounts]);

  const refresh = useCallback(() => {
    loadCounts();
  }, [loadCounts]);

  return (
    <PendingApprovalsContext.Provider
      value={{
        globalPendingCount,
        infoRequestCount,
        featureRequestCount,
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
