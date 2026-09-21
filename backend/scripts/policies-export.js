#!/usr/bin/env node
/**
 * Export policies and their controls from one Orbit instance to a JSON file.
 *
 * WHY THIS EXISTS RATHER THAN A HAND-WRITTEN PAYLOAD
 *
 * The first attempt at seeding production was a hand-written `orbit-policies.json`
 * produced alongside the controls as they were created. It was correct for about a day.
 * Every later change — Phase 2a's field mappings, the scope/verification/attestation
 * flags, the secrets and IaC controls — left it describing a configuration that no
 * longer existed, and nothing would have said so at import time. It would simply have
 * seeded the original mappings: 4.6.3 and 4.6.7 with no fields, 4.6.6 with two, no
 * attestation anywhere.
 *
 * Reading the source instance removes the copy. What you export is what is configured.
 *
 * USAGE
 *
 *   node scripts/policies-export.js --url https://orbit.example --token "$TOKEN" \
 *     > orbit-policies.json
 *
 * The token is an Orbit session/API token for an admin on the SOURCE instance; both
 * endpoints this reads are admin-only. Pass it via an environment variable rather than
 * typing it on the command line, so it does not land in your shell history.
 *
 * Then import with scripts/policies-import.js. See that file for what it will and will
 * not do.
 */

import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    token: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (values.help || !values.url || !values.token) {
  process.stderr.write(
    'Usage: node scripts/policies-export.js --url <base-url> --token <admin-token> > policies.json\n',
  );
  process.exit(values.help ? 0 : 2);
}

const baseUrl = values.url.replace(/\/+$/, '');

/** @param {string} path */
async function get(path) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${values.token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`GET ${path} -> ${res.status} ${res.statusText}: ${await res.text()}`);
  }
  return res.json();
}

/**
 * Strip everything instance-specific.
 *
 * Ids, timestamps and counts do not transfer: the target instance mints its own, and
 * a policy's division/company targeting refers to rows that do not exist there. The
 * import matches policies by name and controls by controlId, which is why those two
 * fields are the ones that must survive.
 */
function portablePolicy(policy) {
  return {
    name: policy.name,
    description: policy.description ?? null,
    // Division- and company-scoped policies carry ids that mean nothing on the target.
    // They are exported as-is so the operator can see what was dropped, but the import
    // refuses anything other than `global` rather than guessing at a mapping.
    scope: policy.scope,
    isActive: policy.isActive ?? true,
    displayOrder: policy.displayOrder ?? 0,
    targetingRules: policy.targetingRules ?? null,
  };
}

function portableControl(control) {
  return {
    controlId: control.controlId,
    name: control.name,
    description: control.description,
    category: control.category ?? null,
    evaluationLogic: control.evaluationLogic ?? 'AND',
    isActive: control.isActive ?? true,
    displayOrder: control.displayOrder ?? 0,
    verificationRequired: control.verificationRequired ?? false,
    verificationNote: control.verificationNote ?? null,
    appliesWhenLogic: control.appliesWhenLogic ?? 'AND',
    allowsAttestation: control.allowsAttestation ?? false,
    attestationValidDays: control.attestationValidDays ?? null,
    fields: (control.fields || []).map((f) => ({
      fieldPath: f.fieldPath,
      role: f.role ?? 'compliance',
      operator: f.operator,
      // Stored as a JSON string; the create endpoint re-stringifies, so parse it back
      // or a mapping's value arrives double-encoded and every comparison fails.
      value: f.value === null || f.value === undefined ? null : JSON.parse(f.value),
      displayOrder: f.displayOrder ?? 0,
    })),
  };
}

/**
 * Wrapped so a failure prints one line an operator can act on rather than a stack
 * trace. A partial run is possible by design (see the header), so the message has to
 * be the last thing on screen.
 */
async function main() {
  const policies = await get('/api/policies');
  const controls = await get('/api/policy-controls');

  const byPolicyId = new Map();
  for (const control of controls) {
    const key = control.policy?.id ?? control.policyId;
    if (!byPolicyId.has(key)) byPolicyId.set(key, []);
    byPolicyId.get(key).push(control);
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    source: baseUrl,
    policies: policies.map((policy) => ({
      ...portablePolicy(policy),
      controls: (byPolicyId.get(policy.id) || [])
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
        .map(portableControl),
    })),
  };

  const controlCount = payload.policies.reduce((n, p) => n + p.controls.length, 0);
  const fieldCount = payload.policies.reduce(
    (n, p) => n + p.controls.reduce((m, c) => m + c.fields.length, 0),
    0,
  );
  process.stderr.write(
    `Exported ${payload.policies.length} policies, ${controlCount} controls, ${fieldCount} field mappings\n`,
  );

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main().catch((error) => {
  // `fetch failed` on its own says nothing about which host was unreachable.
  const detail = error.message === 'fetch failed' ? `could not reach ${baseUrl}` : error.message;
  process.stderr.write(`\nFailed: ${detail}\n`);
  process.exit(1);
});
