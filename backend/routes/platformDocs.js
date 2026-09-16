import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const docsDir = path.resolve(__dirname, '../docs/platform');

// Content API for the platform documentation rendered by the frontend at /docs.
// Public — no auth required. Defines the page order/grouping and which slugs
// are servable; titles are kept in sync with each file's own H1.
//
// AUTHORING NOTE: cross-links between these Markdown files must be written as
// real app routes (`[Applications](/docs/applications)`), never as a relative
// filename (`applications.md`). A relative filename resolves against the
// current path in the browser and lands the reader on a dead URL like
// /docs/applications.md — and shows a raw ".md" to customers.
//
// Structure: a top-level "group" (the two audiences this documentation serves —
// how to use the Orbit tool, and the AppSec program Orbit helps run), each made
// of "sections" (sidebar category labels), each with "pages" (a doc), some of
// which have "children" (sub-pages of a long topic, rendered indented).
const DOC_GROUPS = [
  {
    title: 'Using Orbit',
    sections: [
      {
        title: 'Getting Started',
        pages: [
          { slug: 'overview', title: 'Overview & Core Concepts' },
          { slug: 'getting-started', title: 'Getting Started' },
        ],
      },
      {
        title: 'Working with the Catalog',
        pages: [
          {
            slug: 'applications',
            title: 'Applications',
            children: [
              { slug: 'application-data', title: 'Data, Deployments & Integrations' },
              { slug: 'application-security', title: 'Security, Threat Modeling & Compliance' },
              { slug: 'dependencies', title: 'Dependencies' },
            ],
          },
          { slug: 'products', title: 'Products' },
          { slug: 'domains', title: 'Domains' },
          { slug: 'companies-and-team', title: 'Your Company & Team' },
        ],
      },
      {
        title: 'Security Posture',
        pages: [
          { slug: 'scoring-methodology', title: 'Scoring Methodology' },
          { slug: 'dashboards', title: 'Dashboards' },
          { slug: 'policies-and-samm', title: 'Policies & Compliance' },
        ],
      },
      {
        title: 'Integrations & Automation',
        pages: [
          { slug: 'integrations', title: 'Integrations' },
          { slug: 'settings-and-automation', title: 'Settings, API Access & Automation' },
        ],
      },
    ],
  },
  {
    title: 'The AppSec Program',
    sections: [
      {
        title: 'Program Foundations',
        pages: [
          { slug: 'program-overview', title: 'Program Overview' },
          { slug: 'program-policy-baseline', title: 'Policy Baseline' },
          { slug: 'program-samm', title: 'SAMM & Maturity' },
          { slug: 'program-glossary', title: 'Glossary' },
        ],
      },
      {
        // The six lifecycle phases are children of the overview because they're
        // genuinely sub-pages of one topic, not six peers — the overview holds
        // what would otherwise be repeated on all six (the work-item/output
        // model, entry/exit criteria, how risk tiers modulate the work).
        //
        // Slugs deliberately carry no phase number: the ordinal lives in the
        // nav title and each page's H1, so renumbering or inserting a phase
        // doesn't invalidate every inbound link and control reference.
        //
        // A slug registered here without a matching file in docs/platform
        // returns a 500, so register a phase only once its file exists.
        title: 'The Lifecycle',
        pages: [
          {
            slug: 'program-lifecycle',
            title: 'The Lifecycle',
            children: [
              { slug: 'phase-plan-design', title: 'Phase 1 — Plan & Design' },
              { slug: 'phase-build-commit', title: 'Phase 2 — Build & Commit' },
              { slug: 'phase-ci-gate', title: 'Phase 3 — CI Gate' },
              { slug: 'phase-release-deploy', title: 'Phase 4 — Release & Deploy' },
              { slug: 'phase-runtime-operate', title: 'Phase 5 — Runtime & Operate' },
              { slug: 'phase-improve-govern', title: 'Phase 6 — Improve & Govern' },
            ],
          },
        ],
      },
      {
        title: 'Community Programs',
        pages: [
          { slug: 'program-center-of-excellence', title: 'AppSec Center of Excellence' },
          { slug: 'program-security-champions', title: 'Security Champions Program' },
        ],
      },
    ],
  },
  {
    // A third audience: people building applications without a platform team,
    // a pipeline, or an engineering background — increasingly with an AI
    // coding assistant. Deliberately pitched below the program track: it
    // starts at what a deployment and a server actually are, because a reader
    // who doesn't have that model can't act on anything further up.
    //
    // Needs a GROUP_ACCENTS entry in frontend/src/pages/Docs.jsx keyed by this
    // exact title, or it renders in the same blue as the Orbit documentation.
    //
    // More pages are planned (see LIFECYCLE_PHASES_PLAN.md); they land in
    // reading order, since the later sections assume the earlier ones.
    title: 'Building Securely',
    sections: [
      {
        title: 'Start Here',
        pages: [{ slug: 'secure-build-agent', title: 'Working with Your AI Agent' }],
      },
    ],
  },
];

function flattenPages(groups) {
  const pages = [];
  for (const group of groups) {
    for (const section of group.sections) {
      for (const page of section.pages) {
        pages.push(page);
        for (const child of page.children || []) {
          pages.push(child);
        }
      }
    }
  }
  return pages;
}

const PAGES_BY_SLUG = new Map(flattenPages(DOC_GROUPS).map((p) => [p.slug, p]));

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ groups: DOC_GROUPS });
});

router.get('/:slug', (req, res) => {
  const page = PAGES_BY_SLUG.get(req.params.slug);
  if (!page) {
    return res.status(404).json({ error: 'Documentation page not found' });
  }

  const filePath = path.join(docsDir, `${page.slug}.md`);
  let markdown;
  try {
    markdown = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error('Error reading platform doc', page.slug, error);
    return res.status(500).json({ error: 'Failed to load documentation page' });
  }

  res.json({ slug: page.slug, title: page.title, markdown });
});

export default router;
