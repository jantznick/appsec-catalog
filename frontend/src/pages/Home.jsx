import { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';

const DOC_SECTIONS = [
  {
    title: 'Getting Started',
    description: 'Overview and onboarding resources',
    docs: [
      { slug: 'program-overview', title: 'Program Overview' },
      { slug: 'new-app-sec-customer-roadmap', title: 'New Customer Roadmap' },
      { slug: 'application-onboarding-questionnaire', title: 'Application Onboarding Questionnaire' },
    ],
  },
  {
    title: 'Tools & Capabilities',
    description: 'Available security tools and scoring',
    docs: [
      { slug: 'app-sec-capabilities', title: 'AppSec Capabilities & Tools' },
      { slug: 'scoring-methodology', title: 'Scoring Methodology' },
    ],
  },
  {
    title: 'For Developers',
    description: 'Developer-focused guides and checklists',
    docs: [
      { slug: 'developer-checklist', title: 'Developer Security Checklist' },
      { slug: 'threat-modeling-for-developers', title: 'Threat Modeling for Developers' },
    ],
  },
  {
    title: 'Assessments & Services',
    description: 'Security assessments and testing services',
    docs: [
      { slug: 'penetration-testing', title: 'Penetration Testing' },
      { slug: 'samm-assessments', title: 'SAMM Assessments' },
      { slug: 'posture-analysis-questionnaire', title: 'Posture Analysis Questionnaire' },
      { slug: 'domain-monitoring', title: 'Domain Monitoring' },
    ],
  },
  {
    title: 'Reference',
    description: 'Definitions and terminology',
    docs: [
      { slug: 'app-sec-defined-terms', title: 'AppSec Defined Terms' },
    ],
  },
];

export function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isVerified } = useAuthStore();

  useEffect(() => {
    // Redirect authenticated and verified users to dashboard
    // But not if they're on login/register routes (modal will handle it)
    if (isAuthenticated() && isVerified() && location.pathname !== '/login' && location.pathname !== '/register') {
      navigate('/dashboard');
    }
  }, [navigate, location.pathname, isAuthenticated, isVerified]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            AppSec Catalog
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            A central hub for managing a multi-tenant application security program focused on monitoring risk and managing an ever-changing inventory of applications.
          </p>
        </div>

        <div className="space-y-8 mb-12">
          {DOC_SECTIONS.map((section) => (
            <div key={section.title} className="bg-white rounded-lg shadow-lg p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">{section.title}</h2>
                <p className="text-gray-600">{section.description}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.docs.map((doc) => (
                  <Link
                    key={doc.slug}
                    to={`/docs/${doc.slug}`}
                    className="block p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
                  >
                    <h3 className="font-medium text-gray-900 mb-2">{doc.title}</h3>
                    <p className="text-sm text-gray-600">View documentation →</p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Ready to get started?
          </h3>
          <p className="text-gray-600 mb-4">
            Sign in or create an account to access the full application catalog and management features.
          </p>
        </div>
      </div>
    </div>
  );
}

