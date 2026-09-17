import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { marked } from 'marked';
import { api } from '../lib/api.js';
import { Card } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { RequestInfoModal } from '../components/docs/RequestInfoModal.jsx';
import useAuthStore from '../store/authStore.js';

// Presentational only — which accent each top-level group gets. Kept out of
// the content API since it's a display concern, not part of the doc structure.
const GROUP_ACCENTS = {
  'Using Orbit': {
    tabActive: 'border-blue-500 text-blue-600',
    chip: 'bg-blue-50 text-blue-700',
    eyebrow: 'text-blue-700',
  },
  'The AppSec Program': {
    tabActive: 'border-teal-500 text-teal-600',
    chip: 'bg-teal-50 text-teal-700',
    eyebrow: 'text-teal-700',
  },
  // Uses the -500 step for the tab rather than -600 like the groups above:
  // violet-600 lands at 4.13:1 on the surface colour, under the 4.5 AA floor
  // the teal groups clear at 5.07:1. violet-500 reaches 4.79:1.
  'Building Securely': {
    tabActive: 'border-violet-500 text-violet-500',
    chip: 'bg-violet-50 text-violet-700',
    eyebrow: 'text-violet-700',
  },
};
const DEFAULT_ACCENT = GROUP_ACCENTS['Using Orbit'];

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

// marked HTML-escapes heading text (e.g. "&" becomes "&amp;"). That's correct
// when the heading is injected via dangerouslySetInnerHTML, but the extracted
// title/TOC text below is rendered as plain React text/children instead —
// React does not decode HTML entities in text nodes, so without this it would
// literally show "&amp;" on screen. Decode via the DOM's own entity table.
function decodeEntities(text) {
  const el = document.createElement('textarea');
  el.innerHTML = text;
  return el.value;
}

// Pulls the leading <h1> out of rendered markdown so it can be styled as a
// real page header instead of just another line inside the prose block.
function splitTitle(html) {
  const match = html.match(/^<h1>([\s\S]*?)<\/h1>\s*/);
  if (!match) return { title: null, rest: html };
  return { title: decodeEntities(match[1].replace(/<[^>]+>/g, '')), rest: html.slice(match[0].length) };
}

// Injects an id into every <h2>/<h3> so the "On this page" list can link to
// them, and returns the resulting HTML alongside the extracted TOC entries.
function addHeadingAnchors(html) {
  const toc = [];
  const seen = new Map();
  const withIds = html.replace(/<h([23])>(.*?)<\/h\1>/g, (match, level, inner) => {
    const text = decodeEntities(inner.replace(/<[^>]+>/g, ''));
    let slug = slugify(text);
    const count = seen.get(slug) || 0;
    seen.set(slug, count + 1);
    if (count > 0) slug = `${slug}-${count}`;
    toc.push({ level: Number(level), text, slug });
    return `<h${level} id="${slug}">${inner}</h${level}>`;
  });
  return { html: withIds, toc: numberToc(toc) };
}

// Adds a "1", "2", "2.1" style label to each TOC entry. The list is laid out in
// columns, which flow top-to-bottom before wrapping — so without numbers a
// reader scanning left-to-right gets the sections out of order.
function numberToc(headings) {
  let major = 0;
  let minor = 0;
  return headings.map((h) => {
    if (h.level === 2) {
      major += 1;
      minor = 0;
      return { ...h, label: `${major}` };
    }
    minor += 1;
    // An h3 before any h2 has no parent to hang off; number it on its own
    // rather than emitting "0.1".
    return { ...h, label: major === 0 ? `${minor}` : `${major}.${minor}` };
  });
}

// Locates the page matching `slug` and the group/section/parent it lives
// under, so the UI can scope the sidebar, color the active group tab, and
// show a "Section / Page" breadcrumb.
function locate(groups, slug) {
  for (const group of groups) {
    for (const section of group.sections) {
      for (const page of section.pages) {
        if (page.slug === slug) return { group, section, page, parent: null };
        const child = (page.children || []).find((c) => c.slug === slug);
        if (child) return { group, section, page: child, parent: page };
      }
    }
  }
  return { group: null, section: null, page: null, parent: null };
}

export function Docs() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const contentRef = useRef(null);
  // `authLoading` matters here: without it the CTA flashes on screen for
  // signed-in users during the moment before the session resolves.
  const { isAuthenticated, loading: authLoading } = useAuthStore();
  const [requestOpen, setRequestOpen] = useState(false);
  const [groups, setGroups] = useState([]);
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .getPlatformDocsIndex()
      .then((data) => {
        if (!cancelled) setGroups(data.groups || []);
      })
      .catch(() => {
        // Non-fatal — the page itself can still load without the sidebar populated.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadPage() {
      setLoading(true);
      setError('');
      try {
        const data = await api.getPlatformDoc(slug);
        if (!cancelled) setDoc(data);
      } catch (err) {
        if (!cancelled) {
          setDoc(null);
          setError(err?.message || 'Failed to load documentation page');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadPage();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const located = useMemo(() => locate(groups, slug), [groups, slug]);
  const activeGroup = located.group || groups[0] || null;
  const accent = GROUP_ACCENTS[activeGroup?.title] || DEFAULT_ACCENT;

  const { title, html: bodyHtml, toc } = useMemo(() => {
    if (!doc?.markdown) return { title: null, html: '', toc: [] };
    const { title: parsedTitle, rest } = splitTitle(marked.parse(doc.markdown));
    const { html: withAnchors, toc: headings } = addHeadingAnchors(rest);
    return { title: parsedTitle, html: withAnchors, toc: headings };
  }, [doc]);

  // The content below is injected via dangerouslySetInnerHTML, so its links
  // are plain <a> tags, not React Router <Link>s — intercept clicks on the
  // in-app ones so they navigate client-side instead of doing a full page
  // reload.
  //
  // This covers ANY app-relative path, not just /docs/. Docs link out to real
  // app routes (e.g. /program-content), and those used to fall through to a
  // hard navigation: the whole SPA re-initialized, which flashes and drops
  // auth-store state that has to be re-fetched.
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return undefined;
    const handleClick = (event) => {
      // Leave modified and non-primary clicks alone so cmd/ctrl-click,
      // middle-click, and shift-click still open tabs/windows as expected.
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const link = event.target.closest('a');
      if (!link) return;
      if (link.target && link.target !== '_self') return;

      const href = link.getAttribute('href') || '';
      // Single leading slash only: "//host" is protocol-relative and external,
      // as are absolute URLs and mailto:/tel: schemes.
      if (!href.startsWith('/') || href.startsWith('//')) return;

      event.preventDefault();
      navigate(href);
    };
    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [navigate]);

  return (
    // No max-width here — Layout gives /docs a wider container than the rest of
    // the app, and a cap at this level would just undo it.
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Documentation</h1>
        <p className="mt-1 text-gray-600">
          How to use Orbit, and the AppSec program it helps you run.
        </p>
      </div>

      {/* Top-level switcher between the two documentation groups — kept
          visually distinct (separate color per group, separate sidebar
          below) so the two don't read as one undifferentiated pile. */}
      <div className="flex gap-8 mb-8 border-b border-gray-200">
        {groups.map((group) => {
          const groupAccent = GROUP_ACCENTS[group.title] || DEFAULT_ACCENT;
          const isActive = group.title === activeGroup?.title;
          const firstSlug = group.sections[0]?.pages[0]?.slug;
          return (
            <Link
              key={group.title}
              to={`/docs/${firstSlug}`}
              className={`pb-3 -mb-px border-b-2 font-semibold text-sm transition-colors ${
                isActive ? groupAccent.tabActive : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {group.title}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="lg:w-64 flex-shrink-0">
          <Card padding="sm" className="lg:sticky lg:top-8">
            <nav className="space-y-5">
              {(activeGroup?.sections || []).map((section) => (
                <div key={section.title}>
                  <h3 className="px-2 mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
                    {section.title}
                  </h3>
                  <div className="space-y-1">
                    {section.pages.map((p) => (
                      <div key={p.slug}>
                        <Link
                          to={`/docs/${p.slug}`}
                          className={`block px-3 py-2 rounded text-sm transition-colors ${
                            slug === p.slug ? `${accent.chip} font-medium` : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {p.title}
                        </Link>
                        {(p.children || []).length > 0 && (
                          <div className="ml-3 border-l border-gray-200 pl-2 space-y-1">
                            {p.children.map((child) => (
                              <Link
                                key={child.slug}
                                to={`/docs/${child.slug}`}
                                className={`block px-3 py-1.5 rounded text-sm transition-colors ${
                                  slug === child.slug ? `${accent.chip} font-medium` : 'text-gray-600 hover:bg-gray-50'
                                }`}
                              >
                                {child.title}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </Card>

          <a
            href="/api/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 block px-3 py-2 text-sm text-blue-600 hover:text-blue-700"
          >
            API Reference ↗
          </a>
        </aside>

        <main className="flex-1 min-w-0">
          <Card padding="lg" className="min-w-0">
            {loading ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : error ? (
              <div className="text-center">
                <h2 className="mb-2 text-2xl font-bold text-gray-900">Page not found</h2>
                <p className="mb-4 text-sm text-gray-600">{error}</p>
                <Link to="/docs/overview" className="text-sm text-blue-600 hover:text-blue-700">
                  ← Back to Documentation
                </Link>
              </div>
            ) : (
              <>
                <p className={`mb-2 text-xs font-semibold tracking-wider uppercase ${accent.eyebrow}`}>
                  {located.parent ? located.parent.title : located.section?.title}
                </p>
                {title && <h1 className="mb-6 text-3xl font-bold text-gray-900">{title}</h1>}

                {/* Contents sit inline above the prose rather than in a sticky
                    rail: it frees the full width for the reading column, and on
                    a page this long a rail that follows you down mostly repeats
                    what the sidebar already shows. Multi-column so a 30-heading
                    page doesn't push the actual content off the screen. */}
                {toc.length > 1 && (
                  <nav
                    aria-label="On this page"
                    className="mb-8 px-4 py-3 rounded-lg border border-gray-200 bg-gray-50"
                  >
                    <p className="mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
                      On this page
                    </p>
                    <ol className="gap-x-10 space-y-1.5 sm:columns-2">
                      {toc.map((item) => (
                        <li
                          key={item.slug}
                          className={`break-inside-avoid flex gap-2 ${item.level === 3 ? 'ml-4' : ''}`}
                        >
                          <span className="shrink-0 text-sm tabular-nums text-gray-500">{item.label}</span>
                          <a href={`#${item.slug}`} className="text-sm text-blue-600 hover:text-blue-700">
                            {item.text}
                          </a>
                        </li>
                      ))}
                    </ol>
                  </nav>
                )}

                <div ref={contentRef} className="prose max-w-none" dangerouslySetInnerHTML={{ __html: bodyHtml }} />

                {/* Only shown to visitors who aren't signed in — anyone already
                    logged in has access, so asking them to request it is noise. */}
                {!authLoading && !isAuthenticated() && (
                  <div className="mt-10 pt-6 border-t border-gray-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Want to get set up?</p>
                      <p className="text-sm text-gray-600">
                        Ask Hearst&apos;s AppSec team about bringing your company onto this program.
                      </p>
                    </div>
                    <Button className="shrink-0" onClick={() => setRequestOpen(true)}>
                      Request more information
                    </Button>
                  </div>
                )}
              </>
            )}
          </Card>
        </main>
      </div>

      <RequestInfoModal
        isOpen={requestOpen}
        onClose={() => setRequestOpen(false)}
        sourcePage={slug}
      />
    </div>
  );
}
