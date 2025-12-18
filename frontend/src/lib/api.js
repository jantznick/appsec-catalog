const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Make an API request with automatic session handling
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const config = {
    ...options,
    credentials: 'include', // Include cookies for session
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || 'An error occurred');
  }

  return data;
}

export const api = {
  // Auth endpoints
  register: (email, password) =>
    apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  login: (email, password) =>
    apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  requestMagicCode: (email) =>
    apiRequest('/api/auth/request-magic-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  loginWithMagicCode: (code) =>
    apiRequest('/api/auth/login-magic', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  logout: () =>
    apiRequest('/api/auth/logout', {
      method: 'POST',
    }),

  getCurrentUser: () =>
    apiRequest('/api/auth/me'),

  // User endpoints
  getPendingUsers: async () => {
    const data = await apiRequest('/api/users/pending');
    return data.users || [];
  },

  getAllUsers: async () => {
    const data = await apiRequest('/api/users');
    return data.users || [];
  },

  verifyUser: (userId) =>
    apiRequest(`/api/users/${userId}/verify`, {
      method: 'POST',
    }),

  // Company management
  getCompanies: () =>
    apiRequest('/api/companies'),

  getCompany: (id) =>
    apiRequest(`/api/companies/${id}`),

  createCompany: (data) =>
    apiRequest('/api/companies', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCompany: (id, data) =>
    apiRequest(`/api/companies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  assignUserToCompany: (companyId, userId) =>
    apiRequest(`/api/companies/${companyId}/users`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  removeUserFromCompany: (companyId, userId) =>
    apiRequest(`/api/companies/${companyId}/users/${userId}`, {
      method: 'DELETE',
    }),

  // Application management
  getApplications: () =>
    apiRequest('/api/applications'),

  getApplication: (id) =>
    apiRequest(`/api/applications/${id}`),

  createApplication: (data) =>
    apiRequest('/api/applications', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateApplication: (id, data) =>
    apiRequest(`/api/applications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  searchApplications: (query, companyId) => {
    const params = new URLSearchParams({ q: query });
    if (companyId) params.append('companyId', companyId);
    return apiRequest(`/api/applications/search/name?${params}`);
  },

  // Admin endpoints
  getAdminStats: () =>
    apiRequest('/api/admin/stats'),

  getAdminApplications: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.companyId) params.append('companyId', filters.companyId);
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    const queryString = params.toString();
    return apiRequest(`/api/admin/applications${queryString ? `?${queryString}` : ''}`);
  },
};

