/**
 * Completeness percentages for the company portfolio CSV export.
 *
 * The field sets and the counting implementation both live in
 * services/completeness.js — see the note there on why the sets stay distinct rather
 * than collapsing into one. This module only aggregates across applications.
 */

import { countFieldSet, toPercentage } from '../services/completeness.js';

/**
 * Basic + Technical Information cards on the application detail page.
 * @param {Record<string, unknown>} app
 * @returns {{ filled: number, total: number }}
 */
function countBasicTechnicalMetadata(app) {
  const basic = countFieldSet(app, 'portfolioBasic');
  const technical = countFieldSet(app, 'portfolioTechnical');
  return {
    filled: basic.filled + technical.filled,
    total: basic.total + technical.total,
  };
}

/**
 * Security tool fields only (no application-to-application interfaces).
 * @param {Record<string, unknown>} application
 * @returns {{ filled: number, total: number }}
 */
export function countSecurityCompletenessFields(application) {
  return countFieldSet(application, 'security');
}

/**
 * @param {number[]} pcts
 * @returns {string} e.g. "27%", or "" for an empty portfolio
 */
function formatAvgPct(pcts) {
  if (!pcts.length) return '';
  const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  return `${avg}%`;
}

/**
 * @param {Array<Record<string, unknown>>} applications
 * @returns {{ metadataCompleteness: string, securityCompleteness: string }}
 */
export function aggregateCompletenessForCompany(applications) {
  if (!applications.length) {
    return { metadataCompleteness: '', securityCompleteness: '' };
  }

  const metaPcts = [];
  const secPcts = [];

  for (const app of applications) {
    const meta = countBasicTechnicalMetadata(app);
    metaPcts.push(toPercentage(meta.filled, meta.total));

    const sec = countSecurityCompletenessFields(app);
    secPcts.push(toPercentage(sec.filled, sec.total));
  }

  return {
    metadataCompleteness: formatAvgPct(metaPcts),
    securityCompleteness: formatAvgPct(secPcts),
  };
}
