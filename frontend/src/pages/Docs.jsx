import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';

const DOC_SECTIONS = [
  {
    title: 'Getting Started',
    docs: [
      { slug: 'program-overview', title: 'Program Overview', file: 'program-overview.md' },
      { slug: 'new-app-sec-customer-roadmap', title: 'New Customer Roadmap', file: 'new-app-sec-customer-roadmap.md' },
      { slug: 'application-onboarding-questionnaire', title: 'Application Onboarding Questionnaire', file: 'application-onboarding-questionnaire.md' },
    ],
  },
  {
    title: 'Tools & Capabilities',
    docs: [
      { slug: 'app-sec-capabilities', title: 'AppSec Capabilities & Tools', file: 'app-sec-capabilities.md' },
      { slug: 'scoring-methodology', title: 'Scoring Methodology', file: 'scoring-methodology.md' },
    ],
  },
  {
    title: 'For Developers',
    docs: [
      { slug: 'developer-checklist', title: 'Developer Security Checklist', file: 'developer-checklist.md' },
      { slug: 'threat-modeling-for-developers', title: 'Threat Modeling for Developers', file: 'threat-modeling-for-developers.md' },
    ],
  },
  {
    title: 'Assessments & Services',
    docs: [
      { slug: 'penetration-testing', title: 'Penetration Testing', file: 'penetration-testing.md' },
      { slug: 'samm-assessments', title: 'SAMM Assessments', file: 'samm-assessments.md' },
      { slug: 'posture-analysis-questionnaire', title: 'Posture Analysis Questionnaire', file: 'posture-analysis-questionnaire.md' },
      { slug: 'domain-monitoring', title: 'Domain Monitoring', file: 'domain-monitoring.md' },
    ],
  },
  {
    title: 'Reference',
    docs: [
      { slug: 'app-sec-defined-terms', title: 'AppSec Defined Terms', file: 'app-sec-defined-terms.md' },
    ],
  },
];

// Flatten for easy lookup
const DOCS = DOC_SECTIONS.flatMap(section => section.docs);

export function Docs() {
  const params = useParams();
  const location = useLocation();
  
  // Get the path after /docs/ - useParams with wildcard returns { '*': 'path' }
  // Fallback to extracting from location.pathname if params['*'] is not available
  let slug = params['*'] || params.slug || '';
  if (!slug && location.pathname.startsWith('/docs/')) {
    slug = location.pathname.replace('/docs/', '');
  }
  
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [docTitle, setDocTitle] = useState('');

  const currentDoc = DOCS.find(d => d.slug === slug);

  useEffect(() => {
    console.log('Docs component - slug:', slug, 'params:', params);
    
    // If no slug, redirect to docs list
    if (!slug || slug === '') {
      console.log('No slug found');
      setError('Document not found');
      setLoading(false);
      return;
    }

    // Handle nested paths (like products/snyk)
    if (slug.includes('/')) {
      setLoading(true);
      // For nested paths, construct the file path directly
      const filePath = `${slug}.md`;
      const fetchUrl = `/docs/${filePath}`;
      console.log('Fetching nested doc:', fetchUrl);
      fetch(fetchUrl)
        .then(res => {
          console.log('Response status:', res.status, res.statusText, 'URL:', res.url);
          if (!res.ok) {
            throw new Error(`Failed to load document: ${res.status} ${res.statusText}`);
          }
          return res.text();
        })
        .then(text => {
          console.log('Document loaded successfully, length:', text.length);
          // Strip frontmatter if present
          let contentText = text;
          if (text.startsWith('---')) {
            const frontmatterEnd = text.indexOf('---', 3);
            if (frontmatterEnd !== -1) {
              contentText = text.substring(frontmatterEnd + 3).trim();
            }
          }
          
          // Try to extract title from frontmatter or use slug
          const titleMatch = text.match(/^title:\s*["'](.+?)["']/m);
          const title = titleMatch ? titleMatch[1] : slug.split('/').pop().replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          setDocTitle(title);
          setContent(contentText);
          setError(null);
        })
        .catch(err => {
          console.error('Error loading nested doc:', err);
          setError(err.message || 'Failed to load document');
        })
        .finally(() => {
          setLoading(false);
        });
      return;
    }

    // Handle regular docs from DOCS array
    if (!currentDoc) {
      setError('Document not found');
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/docs/${currentDoc.file}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load document');
        return res.text();
      })
      .then(text => {
        setContent(text);
        setError(null);
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug, currentDoc]);

  // Simple markdown to HTML converter
  const markdownToHtml = (md) => {
    if (!md) return '';
    
    let html = md;
    
    // Code blocks first (before other processing)
    html = html.replace(/```[\s\S]*?```/g, (match) => {
      const code = match.replace(/```[\w]*\n?/g, '').replace(/```/g, '').trim();
      return `<pre class="bg-gray-100 p-4 rounded-lg overflow-x-auto my-4 border border-gray-200"><code class="text-sm font-mono">${code}</code></pre>`;
    });
    
    // Inline code
    html = html.replace(/`([^`\n]+)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');
    
    // Headers
    html = html.replace(/^#### (.*$)/gim, '<h4 class="text-lg font-semibold text-gray-900 mt-6 mb-3">$1</h4>');
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold text-gray-900 mt-6 mb-3">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4 border-b border-gray-200 pb-2">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold text-gray-900 mt-8 mb-4">$1</h1>');
    
    // Horizontal rules
    html = html.replace(/^---$/gim, '<hr class="my-6 border-gray-300" />');
    
    // Bold and italic (bold first)
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong class="font-semibold">$1</strong>');
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" class="text-blue-600 hover:text-blue-700 underline">$1</a>');
    
    // Process lists - convert to HTML first, then wrap
    const lines = html.split('\n');
    let inList = false;
    let listType = null;
    let result = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const bulletMatch = line.match(/^[\*\-\+] (.*)$/);
      const numberMatch = line.match(/^\d+\. (.*)$/);
      
      if (bulletMatch || numberMatch) {
        const content = bulletMatch ? bulletMatch[1] : numberMatch[1];
        const isOrdered = !!numberMatch;
        
        if (!inList || listType !== (isOrdered ? 'ol' : 'ul')) {
          if (inList) {
            result.push(`</${listType}>`);
          }
          listType = isOrdered ? 'ol' : 'ul';
          result.push(`<${listType} class="mb-4 ml-6 space-y-2 list-${isOrdered ? 'decimal' : 'disc'}">`);
          inList = true;
        }
        result.push(`<li class="text-gray-700">${content}</li>`);
      } else {
        if (inList) {
          result.push(`</${listType}>`);
          inList = false;
          listType = null;
        }
        result.push(line);
      }
    }
    
    if (inList) {
      result.push(`</${listType}>`);
    }
    
    html = result.join('\n');
    
    // Process paragraphs (split by double newlines, but preserve existing HTML)
    html = html.split('\n\n').map(block => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      // Don't wrap if it's already HTML
      if (trimmed.startsWith('<') && (trimmed.startsWith('<h') || trimmed.startsWith('<p') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol') || trimmed.startsWith('<pre') || trimmed.startsWith('<hr'))) {
        return trimmed;
      }
      // Don't wrap if it's a list
      if (trimmed.includes('<li>')) {
        return trimmed;
      }
      return `<p class="mb-4 text-gray-700 leading-relaxed">${trimmed}</p>`;
    }).join('\n');

    return html;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading documentation...</div>
      </div>
    );
  }

  // Show error only if there's an actual error AND we're not loading
  // For nested paths (products/...), currentDoc will be undefined, which is fine
  if (error && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Document Not Found</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link to="/docs" className="text-blue-600 hover:text-blue-700">
            ← Back to Documentation
          </Link>
        </div>
      </div>
    );
  }
  
  // For regular docs, check if currentDoc exists
  if (!slug.includes('/') && !currentDoc && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Document Not Found</h1>
          <Link to="/docs" className="text-blue-600 hover:text-blue-700">
            ← Back to Documentation
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow p-4 sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto">
              <h2 className="font-semibold text-gray-900 mb-4">Documentation</h2>
              <nav className="space-y-6">
                {DOC_SECTIONS.map((section) => (
                  <div key={section.title}>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      {section.title}
                    </h3>
                    <div className="space-y-1">
                      {section.docs.map((doc) => (
                        <Link
                          key={doc.slug}
                          to={`/docs/${doc.slug}`}
                          className={`block px-3 py-2 rounded text-sm transition-colors ${
                            slug === doc.slug
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {doc.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1">
            <div className="bg-white rounded-lg shadow p-8">
              <div className="mb-6">
                <Link
                  to="/docs"
                  className="text-sm text-blue-600 hover:text-blue-700 mb-4 inline-block"
                >
                  ← Back to Documentation
                </Link>
                <h1 className="text-3xl font-bold text-gray-900 mt-2">{currentDoc ? currentDoc.title : docTitle}</h1>
              </div>
              <div
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }}
              />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

