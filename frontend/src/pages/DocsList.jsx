import { Link } from 'react-router-dom';

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

export function DocsList() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Documentation</h1>
          <p className="text-xl text-gray-600">
            Comprehensive guides and resources for application security.
          </p>
        </div>

        <div className="space-y-8">
          {DOC_SECTIONS.map((section) => (
            <div key={section.title} className="bg-white rounded-lg shadow p-6">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-1">{section.title}</h2>
                <p className="text-sm text-gray-600">{section.description}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.docs.map((doc) => (
                  <Link
                    key={doc.slug}
                    to={`/docs/${doc.slug}`}
                    className="block p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
                  >
                    <h3 className="font-medium text-gray-900 mb-1">{doc.title}</h3>
                    <p className="text-xs text-gray-600">View →</p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

