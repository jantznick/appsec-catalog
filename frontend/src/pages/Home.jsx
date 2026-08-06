import { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';
import { AtlasMark } from '../components/Logo.jsx';

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
    // Only redirect if we're actually on the home page
    // Don't redirect from other pages
    if (location.pathname === '/' && isAuthenticated() && isVerified()) {
      navigate('/dashboard');
    }
  }, [navigate, location.pathname]); // Remove function dependencies, call them inside

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-800 via-navy-700 to-blue-700 px-6 py-16 sm:px-12 sm:py-20 mb-12 shadow-xl">
          {/* Decorative glows */}
          <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-grape-500/20 blur-3xl" />
          <div className="relative text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur-sm">
              <AtlasMark size={44} />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
              Atlas
            </h1>
            <p className="text-lg sm:text-xl text-blue-50/90 max-w-2xl mx-auto leading-relaxed">
              A central hub for managing a multi-tenant application security program focused on monitoring risk and managing an ever-changing inventory of applications.
            </p>
          </div>
        </div>

        <div className="space-y-8 mb-12">
          {DOC_SECTIONS.map((section) => (
            <div key={section.title} className="bg-surface rounded-2xl border border-gray-200/80 shadow-sm p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">{section.title}</h2>
                <p className="text-gray-600">{section.description}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.docs.map((doc) => (
                  <Link
                    key={doc.slug}
                    to={`/docs/${doc.slug}`}
                    className="group block p-4 border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/40 hover:shadow-md transition-all"
                  >
                    <h3 className="font-semibold text-gray-900 mb-2">{doc.title}</h3>
                    <p className="text-sm text-blue-700 font-medium">
                      View documentation
                      <span className="inline-block transition-transform group-hover:translate-x-0.5"> →</span>
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-grape-50 border border-blue-200/70 rounded-2xl p-8 text-center shadow-sm">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Ready to get started?
          </h3>
          <p className="text-gray-600 max-w-xl mx-auto">
            Sign in or create an account to access the full application catalog and management features.
          </p>
        </div>
      </div>
    </div>
  );
}

