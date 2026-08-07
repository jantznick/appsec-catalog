import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Global admin view scope (Wiz-style "project folder").
 *
 * Lets an admin narrow every list/dashboard to a single company or an entire
 * division. This is a CONVENIENCE FILTER for admins only — it is never an
 * authorization boundary. The backend still enforces access via requireAdmin
 * and the user's own companyId; a client-chosen scope can only ever narrow
 * what an admin already may see, never widen it. Non-admins never see the
 * selector and remain hard-scoped server-side to their own company.
 *
 * Persisted to localStorage so the scope is sticky across sessions.
 */
const useScopeStore = create(
  persist(
    (set) => ({
      // 'all' | 'division' | 'company'
      mode: 'all',
      companyId: null,
      divisionId: null,
      // Cached display label so the nav/sub-bar can render without a refetch.
      label: 'All companies',

      setCompanyScope: (companyId, label) =>
        set({ mode: 'company', companyId, divisionId: null, label }),

      setDivisionScope: (divisionId, label) =>
        set({ mode: 'division', divisionId, companyId: null, label }),

      clearScope: () =>
        set({ mode: 'all', companyId: null, divisionId: null, label: 'All companies' }),
    }),
    {
      name: 'atlas-scope',
    }
  )
);

/**
 * Query params for API calls, matching the existing filter-param convention
 * (empty string = "no filter"). Read this in list pages and pass straight into
 * the api.* helpers.
 * @returns {{ companyId: string, divisionId: string }}
 */
export function scopeParams(state) {
  const s = state ?? useScopeStore.getState();
  return {
    companyId: s.mode === 'company' ? s.companyId ?? '' : '',
    divisionId: s.mode === 'division' ? s.divisionId ?? '' : '',
  };
}

export default useScopeStore;
