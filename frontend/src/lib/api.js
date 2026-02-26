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

  verifyUser: (userId, options = {}) =>
    apiRequest(`/api/users/${userId}/verify`, {
      method: 'POST',
      body: JSON.stringify(options),
    }),

  updateUser: (userId, data) =>
    apiRequest(`/api/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteUser: (userId) =>
    apiRequest(`/api/users/${userId}`, {
      method: 'DELETE',
    }),

  inviteUser: (data) =>
    apiRequest('/api/users/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  regenerateUserInvite: (userId) =>
    apiRequest(`/api/users/${userId}/regenerate-invite`, {
      method: 'POST',
    }),

  getInvitation: (token) =>
    apiRequest(`/api/invitations/${token}`),

  acceptInvitation: (token, password) =>
    apiRequest(`/api/invitations/${token}/accept`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  changePassword: (data) =>
    apiRequest('/api/users/me/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Company management
  getCompanies: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.divisionId) params.append('divisionId', filters.divisionId);
    const queryString = params.toString();
    return apiRequest(`/api/companies${queryString ? `?${queryString}` : ''}`);
  },

  getCompany: (id) =>
    apiRequest(`/api/companies/${id}`),

  // Division management
  getDivisions: () =>
    apiRequest('/api/divisions'),

  getDivision: (id) =>
    apiRequest(`/api/divisions/${id}`),

  createDivision: (data) =>
    apiRequest('/api/divisions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateDivision: (id, data) =>
    apiRequest(`/api/divisions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteDivision: (id) =>
    apiRequest(`/api/divisions/${id}`, {
      method: 'DELETE',
    }),

  // Policy Controls endpoints
  getPolicyControls: () =>
    apiRequest('/api/policy-controls'),

  getPolicyControl: (id) =>
    apiRequest(`/api/policy-controls/${id}`),

  createPolicyControl: (data) =>
    apiRequest('/api/policy-controls', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updatePolicyControl: (id, data) =>
    apiRequest(`/api/policy-controls/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deletePolicyControl: (id) =>
    apiRequest(`/api/policy-controls/${id}`, {
      method: 'DELETE',
    }),

  updatePolicyControlOrder: (id, displayOrder) =>
    apiRequest(`/api/policy-controls/${id}/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ displayOrder }),
    }),

  getAvailableFields: () =>
    apiRequest('/api/config/available-fields'),

  getApplicationPolicyCompliance: (applicationId) =>
    apiRequest(`/api/applications/${applicationId}/policy-compliance`),

  // Policy Control Override endpoints (Admin only)
  getApplicationPolicyOverrides: (applicationId) =>
    apiRequest(`/api/applications/${applicationId}/policy-overrides`),

  createOrUpdatePolicyOverride: (applicationId, data) =>
    apiRequest(`/api/applications/${applicationId}/policy-overrides`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deletePolicyOverride: (applicationId, controlId) =>
    apiRequest(`/api/applications/${applicationId}/policy-overrides/${controlId}`, {
      method: 'DELETE',
    }),

  // Policies endpoints
  getPolicies: () =>
    apiRequest('/api/policies'),

  getPolicy: (id) =>
    apiRequest(`/api/policies/${id}`),

  createPolicy: (data) =>
    apiRequest('/api/policies', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updatePolicy: (id, data) =>
    apiRequest(`/api/policies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deletePolicy: (id) =>
    apiRequest(`/api/policies/${id}`, {
      method: 'DELETE',
    }),

  updatePolicyOrder: (id, displayOrder) =>
    apiRequest(`/api/policies/${id}/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ displayOrder }),
    }),

  getDivisionStats: (id) =>
    apiRequest(`/api/divisions/${id}/stats`),
  getCompanyAverageScore: (id) =>
    apiRequest(`/api/companies/${id}/average-score`),
  getCompanyDomains: (id) =>
    apiRequest(`/api/companies/${id}/domains`),
  getCompanyBySlug: (slug) =>
    apiRequest(`/api/companies/slug/${slug}`),
  getPublicCompanies: () =>
    apiRequest('/api/companies/public'),
  createPublicCompany: (data) =>
    apiRequest('/api/companies/public', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createApplicationOnboardExecutive: (data) =>
    apiRequest('/api/applications/onboard/executive', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getApplicationPublic: (id) =>
    apiRequest(`/api/applications/public/${id}`),

  getCompanyApplicationsPublic: (companySlug) =>
    apiRequest(`/api/applications/public/company/${companySlug}`),
  updateApplicationPublic: (id, data) =>
    apiRequest(`/api/applications/public/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getIntegrationLevels: () =>
    apiRequest('/api/config/integration-levels'),

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

  getApplicationScore: (id) =>
    apiRequest(`/api/applications/${id}/score`),

  markApplicationReviewed: (id) =>
    apiRequest(`/api/applications/${id}/review`, {
      method: 'POST',
    }),

  createApplication: (data) =>
    apiRequest('/api/applications', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  bulkImportApplications: (companyId, applications) =>
    apiRequest('/api/applications/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ companyId, applications }),
    }),

  generateTechnicalFormLink: (applicationId) =>
    apiRequest(`/api/applications/${applicationId}/generate-technical-link`, {
      method: 'POST',
    }),
  createApplicationOnboard: (data) =>
    apiRequest('/api/applications/onboard', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateApplication: (id, data) =>
    apiRequest(`/api/applications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteApplication: (id) =>
    apiRequest(`/api/applications/${id}`, {
      method: 'DELETE',
    }),

  // Domain management
  addDomainToApplication: (applicationId, domainName) =>
    apiRequest(`/api/applications/${applicationId}/domains`, {
      method: 'POST',
      body: JSON.stringify({ domainName }),
    }),

  removeDomainFromApplication: (applicationId, domainId) =>
    apiRequest(`/api/applications/${applicationId}/domains/${domainId}`, {
      method: 'DELETE',
    }),

  // Deployment management
  getDeployments: (applicationId) =>
    apiRequest(`/api/applications/${applicationId}/deployments`),

  createDeployment: (applicationId, data) =>
    apiRequest(`/api/applications/${applicationId}/deployments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteDeployment: (applicationId, deploymentId) =>
    apiRequest(`/api/applications/${applicationId}/deployments/${deploymentId}`, {
      method: 'DELETE',
    }),

  // Deployment token management
  createDeploymentToken: (applicationId, name) =>
    apiRequest(`/api/applications/${applicationId}/deployment-tokens`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  getDeploymentTokensForApplication: (applicationId) =>
    apiRequest(`/api/applications/${applicationId}/deployment-tokens`),

  getDeploymentTokens: () =>
    apiRequest('/api/deployment-tokens'),

  getDeploymentToken: (tokenId) =>
    apiRequest(`/api/deployment-tokens/${tokenId}`),

  updateDeploymentToken: (tokenId, data) =>
    apiRequest(`/api/deployment-tokens/${tokenId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  revokeDeploymentToken: (tokenId) =>
    apiRequest(`/api/deployment-tokens/${tokenId}`, {
      method: 'DELETE',
    }),

  // Domain management
  getDomains: () =>
    apiRequest('/api/domains'),

  getDomain: (id) =>
    apiRequest(`/api/domains/${id}`),

  createDomain: (data) =>
    apiRequest('/api/domains', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateDomain: (id, data) =>
    apiRequest(`/api/domains/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  runDomainDnsCheck: (id) =>
    apiRequest(`/api/domains/${id}/check-dns`, {
      method: 'POST',
    }),

  getDomainDnsSnapshots: (id) =>
    apiRequest(`/api/domains/${id}/dns-snapshots`),

  getDomainDnsChanges: (id) =>
    apiRequest(`/api/domains/${id}/dns-changes`),

  runDomainWebSnapshot: (id) =>
    apiRequest(`/api/domains/${id}/snapshot`, {
      method: 'POST',
    }),

  getDomainWebSnapshots: (id) =>
    apiRequest(`/api/domains/${id}/snapshots`),

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
    if (filters.divisionId) params.append('divisionId', filters.divisionId);
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    const queryString = params.toString();
    return apiRequest(`/api/admin/applications${queryString ? `?${queryString}` : ''}`);
  },

  // Notes endpoints
  getCompanyNotes: (companyId) =>
    apiRequest(`/api/notes/company/${companyId}`),

  getApplicationNotes: (applicationId) =>
    apiRequest(`/api/notes/application/${applicationId}`),

  createCompanyNote: (companyId, content) =>
    apiRequest(`/api/notes/company/${companyId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  createApplicationNote: (applicationId, content) =>
    apiRequest(`/api/notes/application/${applicationId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  updateNote: (noteId, content) =>
    apiRequest(`/api/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),

  deleteNote: (noteId) =>
    apiRequest(`/api/notes/${noteId}`, {
      method: 'DELETE',
    }),

  // Version history endpoints (Admin only)
  getApplicationVersions: (applicationId) =>
    apiRequest(`/api/applications/${applicationId}/versions`),

  // Pending approvals
  getPendingVersions: () =>
    apiRequest('/api/applications/versions/pending'),

  getPendingVersionsCount: () =>
    apiRequest('/api/applications/versions/pending/count'),

  getPendingVersionsCountForApplication: (applicationId) =>
    apiRequest(`/api/applications/${applicationId}/versions/pending/count`),

  getApplicationVersion: (applicationId, versionNumber) =>
    apiRequest(`/api/applications/${applicationId}/versions/${versionNumber}`),

  compareApplicationVersions: (applicationId, v1, v2) =>
    apiRequest(`/api/applications/${applicationId}/versions/compare/${v1}/${v2}`),

  // Review history endpoints (Admin only)
  getApplicationReviews: (applicationId) =>
    apiRequest(`/api/applications/${applicationId}/reviews`),

  // Version approval endpoints (Admin only)
  approveVersion: (applicationId, versionId, action, approvedFields = null, rejectionReason = null, approvalNotes = null) =>
    apiRequest(`/api/applications/${applicationId}/versions/${versionId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ action, approvedFields, rejectionReason, approvalNotes }),
    }),
};

