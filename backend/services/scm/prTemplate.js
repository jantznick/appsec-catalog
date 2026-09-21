/**
 * Pull-request template discovery and security-section detection.
 *
 * Evidence for 4.6.7 ("All pull requests shall include a security-impact review
 * checklist and document the findings/responses").
 *
 * Scope, stated plainly: this establishes that a template exists and that it asks
 * about security. It does NOT establish that anyone filled it in. Reading completed
 * PR bodies is a separate, heavier control — see POLICY_CONTROL_COVERAGE_PLAN.md.
 *
 * Provider-agnostic: pure functions over paths and text, so the GitHub adapter
 * supplies the fetching and this supplies the judgement.
 */

/**
 * Single-file locations GitHub honours for a PR template, in the order it resolves
 * them. Bitbucket and Azure DevOps use overlapping conventions, hence the shared list.
 */
export const PR_TEMPLATE_PATHS = [
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/pull_request_template.md',
  'PULL_REQUEST_TEMPLATE.md',
  'pull_request_template.md',
  'docs/PULL_REQUEST_TEMPLATE.md',
  'docs/pull_request_template.md',
  '.github/PULL_REQUEST_TEMPLATE.txt',
  '.gitlab/merge_request_templates/Default.md',
];

/** Directory of multiple templates; every .md inside counts. */
export const PR_TEMPLATE_DIRS = ['.github/PULL_REQUEST_TEMPLATE', '.github/pull_request_template'];

/**
 * Words that make a heading or checklist item count as a security prompt.
 * Deliberately narrow: "impact" or "review" alone match far too much of an
 * ordinary template, and a false positive here reports a control as met when
 * nobody is being asked about security at all.
 */
const SECURITY_TERMS = [
  'security',
  'secure',
  'threat model',
  'threat-model',
  'vulnerability',
  'vulnerabilities',
  'appsec',
  'owasp',
];

const SECURITY_RE = new RegExp(SECURITY_TERMS.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');

// ATX heading: up to three leading spaces, 1-6 hashes, a space, then the text.
const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.*)$/;
// Task-list item: "- [ ] ...", "* [x] ...", "1. [ ] ..."
const CHECKLIST_RE = /^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]?\]\s*(.*)$/;
// Setext heading: a line of === or --- directly under its text.
const SETEXT_RE = /^\s{0,3}(=+|-{2,})\s*$/;

/**
 * Inspect PR template text for a section or checklist item that asks about security.
 *
 * @param {string|null|undefined} text raw template contents
 * @returns {{ hasSecuritySection: boolean, matched: string|null, kind: 'heading'|'checklist'|null }}
 */
export function detectSecuritySection(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { hasSecuritySection: false, matched: null, kind: null };
  }

  const lines = text.split(/\r?\n/);
  let inFence = false;
  let checklistHit = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Never match inside a fenced code block — sample code or a template's own
    // example output is not a prompt to the author.
    if (/^\s{0,3}(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const heading = HEADING_RE.exec(line);
    if (heading && SECURITY_RE.test(heading[2])) {
      // A heading is the strongest signal; return as soon as one is found.
      return { hasSecuritySection: true, matched: heading[2].trim(), kind: 'heading' };
    }

    // Setext heading: this line is the text, the next is the underline.
    if (!heading && line.trim() && SETEXT_RE.test(lines[i + 1] || '') && SECURITY_RE.test(line)) {
      return { hasSecuritySection: true, matched: line.trim(), kind: 'heading' };
    }

    // Remember a checklist hit but keep looking — prefer a heading if one exists.
    if (!checklistHit) {
      const item = CHECKLIST_RE.exec(line);
      if (item && SECURITY_RE.test(item[1])) checklistHit = item[1].trim();
    }
  }

  return checklistHit
    ? { hasSecuritySection: true, matched: checklistHit, kind: 'checklist' }
    : { hasSecuritySection: false, matched: null, kind: null };
}

/**
 * A PullRequestTemplate result with everything unknown, carrying the reason.
 * @param {string} reason
 */
export function unknownPrTemplate(reason) {
  return {
    prTemplatePath: null,
    prTemplateFound: null,
    prTemplateHasSecuritySection: null,
    prTemplateSecurityHeading: null,
    prTemplateError: reason,
  };
}

/**
 * Resolve the first template that exists and judge it, given a reader.
 *
 * @param {(path: string) => Promise<string|null>} readFile 404-tolerant file reader
 * @param {(dir: string) => Promise<string[]>} [listDir] returns file paths in a directory
 * @returns {Promise<{prTemplatePath, prTemplateFound, prTemplateHasSecuritySection, prTemplateSecurityHeading, prTemplateError}>}
 */
export async function resolvePrTemplate(readFile, listDir = async () => []) {
  for (const path of PR_TEMPLATE_PATHS) {
    const text = await readFile(path);
    if (text === null || text === undefined) continue;
    const { hasSecuritySection, matched } = detectSecuritySection(text);
    return {
      prTemplatePath: path,
      prTemplateFound: true,
      prTemplateHasSecuritySection: hasSecuritySection,
      prTemplateSecurityHeading: matched,
      prTemplateError: null,
    };
  }

  // Multi-template directory: a security section in any one of them counts,
  // since the author picks a template per pull request.
  for (const dir of PR_TEMPLATE_DIRS) {
    const entries = await listDir(dir);
    let firstPath = null;
    for (const entry of entries) {
      if (!/\.(md|txt)$/i.test(entry)) continue;
      const text = await readFile(entry);
      if (text === null || text === undefined) continue;
      if (!firstPath) firstPath = entry;
      const { hasSecuritySection, matched } = detectSecuritySection(text);
      if (hasSecuritySection) {
        return {
          prTemplatePath: entry,
          prTemplateFound: true,
          prTemplateHasSecuritySection: true,
          prTemplateSecurityHeading: matched,
          prTemplateError: null,
        };
      }
    }
    if (firstPath) {
      return {
        prTemplatePath: firstPath,
        prTemplateFound: true,
        prTemplateHasSecuritySection: false,
        prTemplateSecurityHeading: null,
        prTemplateError: null,
      };
    }
  }

  // Looked everywhere and found nothing: a definite answer, not an unknown.
  return {
    prTemplatePath: null,
    prTemplateFound: false,
    prTemplateHasSecuritySection: false,
    prTemplateSecurityHeading: null,
    prTemplateError: null,
  };
}
