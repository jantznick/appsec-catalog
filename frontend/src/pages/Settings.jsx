import { Link } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card.jsx';

const settingsSections = [
  {
    title: 'Account and access',
    description: 'Manage tokens and user access.',
    items: [
      {
        label: 'API tokens',
        description: 'Create and manage API access tokens.',
        to: '/settings/api-tokens',
      },
      {
        label: 'Deployment tokens',
        description: 'Manage deployment automation credentials.',
        to: '/deployment-tokens',
      },
      {
        label: 'Users',
        description: 'Invite users and manage access.',
        to: '/users',
        adminOnly: true,
      },
    ],
  },
  {
    title: 'Catalog setup',
    description: 'Organize the companies, divisions, and app inventory structure.',
    adminOnly: true,
    items: [
      {
        label: 'Companies',
        description: 'Manage company records and company-level ownership.',
        to: '/companies',
      },
      {
        label: 'Divisions',
        description: 'Group companies into business divisions.',
        to: '/divisions',
      },
      {
        label: 'Deploy settings',
        description: 'Configure deployment metadata and environment options.',
        to: '/settings/deploy',
      },
    ],
  },
  {
    title: 'Security program',
    description: 'Configure scoring, policies, and security tool integrations.',
    items: [
      {
        label: 'Policy controls',
        description: 'Manage security policy requirements and mappings.',
        to: '/policy-controls',
        adminOnly: true,
      },
      {
        label: 'Scoring settings',
        description: 'Tune tool scoring and API schema sensitive-data rules.',
        to: '/settings/scoring',
        adminOnly: true,
      },
      {
        label: 'AI settings',
        description: 'Enable AI per company, manage model pricing, and review token usage and cost.',
        to: '/settings/ai',
        adminOnly: true,
      },
      {
        label: 'Integration settings',
        description: 'Connect your GitHub account; admins configure catalog-wide tool integrations.',
        to: '/settings/integrations',
      },
    ],
  },
  {
    title: 'Review workflow',
    description: 'Review submitted changes and security export activity.',
    items: [
      {
        label: 'Pending approvals',
        description: 'Review submitted application metadata changes.',
        to: '/pending-approvals',
        adminOnly: true,
      },
      {
        label: 'Security export jobs',
        description: 'View security findings export history.',
        to: '/export-jobs',
      },
    ],
  },
  {
    title: 'Product communication',
    description: 'Control release notes and in-app update messaging.',
    adminOnly: true,
    items: [
      {
        label: 'Product updates',
        description: 'Publish and manage what users see in What\'s New.',
        to: '/settings/product-updates',
      },
      {
        label: 'What\'s New',
        description: 'Preview the product update feed.',
        to: '/whats-new',
      },
    ],
  },
];

export function Settings() {
  const { isAdmin } = useAuthStore();
  const canAdmin = isAdmin();

  const visibleSections = settingsSections
    .filter((section) => !section.adminOnly || canAdmin)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.adminOnly || canAdmin),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div>
      <div className="mb-8">
        <Link to="/dashboard" className="mb-2 inline-block text-sm text-blue-600 hover:text-blue-700">
          Back to Dashboard
        </Link>
        <h1 className="mb-2 text-3xl font-bold text-gray-800">Settings</h1>
        <p className="max-w-2xl text-gray-600">
          Manage account access, catalog setup, and security program configuration from one place.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {visibleSections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              <p className="mt-1 text-sm text-gray-600">{section.description}</p>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {section.items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="block px-4 py-3 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                        <p className="mt-1 text-sm text-gray-600">{item.description}</p>
                      </div>
                      <span className="mt-0.5 text-sm text-gray-400">Open</span>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
