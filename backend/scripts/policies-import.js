#!/usr/bin/env node
/**
 * Import a policies export into an Orbit instance.
 *
 * Reads what scripts/policies-export.js produced and creates the policies and controls
 * over the public API, so the target instance applies exactly the validation the UI
 * applies — including the field-path and operator checks that stop a bad mapping
 * marking every application non-compliant.
 *
 * USAGE
 *
 *   node scripts/policies-import.js --url https://orbit.example --token "$TOKEN" \
 *     --file orbit-policies.json --dry-run
 *
 * Run it with --dry-run first. It prints exactly what it would create, in order,
 * without sending a single write.
 *
 * WHAT IT WILL NOT DO
 *
 * - It never updates or deletes. A policy whose name already exists on the target, or
 *   a control whose controlId already exists under it, is skipped and reported. Seeding
 *   a fresh instance is the job; reconciling two live instances is not, and doing it
 *   badly would overwrite whatever production had diverged to.
 * - It refuses a non-global policy. Division- and company-scoped policies target rows
 *   by id, and those ids mean nothing on the target instance. Importing one would
 *   either fail or, worse, silently attach the policy to whichever rows happened to
 *   share an id. Create those by hand and re-run.
 * - It stops on the first error rather than continuing, so a partial import is as
 *   short as possible and the failure is the last thing printed.
 */

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    token: { type: 'string' },
    file: { type: 'string' },
    'dry-run': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (values.help || !values.url || !values.token || !values.file) {
  process.stderr.write(
    'Usage: node scripts/policies-import.js --url <base-url> --token <admin-token> ' +
      '--file <policies.json> [--dry-run]\n',
  );
  process.exit(values.help ? 0 : 2);
}

const baseUrl = values.url.replace(/\/+$/, '');
const dryRun = values['dry-run'] === true;

/** Read and shape-check the export, inside main() so a bad file reports cleanly too. */
function loadPayload() {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(values.file, 'utf8'));
  } catch (error) {
    throw new Error(`could not read ${values.file}: ${error.message}`);
  }
  if (!Array.isArray(parsed?.policies)) {
    throw new Error(`${values.file} has no "policies" array — is it a policies export?`);
  }
  return parsed;
}

const headers = {
  Authorization: `Bearer ${values.token}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

async function get(path) {
  const res = await fetch(`${baseUrl}${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

/**
 * Wrapped so a failure prints one line an operator can act on rather than a stack
 * trace. A partial run is possible by design (see the header), so the message has to
 * be the last thing on screen.
 */
async function main() {
  const payload = loadPayload();
  const existingPolicies = await get('/api/policies');
  const policyIdByName = new Map(existingPolicies.map((p) => [p.name, p.id]));

  let created = { policies: 0, controls: 0, fields: 0 };
  let skipped = { policies: 0, controls: 0 };

  for (const policy of payload.policies) {
    if (policy.scope !== 'global') {
      throw new Error(
        `Policy "${policy.name}" has scope "${policy.scope}". Division and company ` +
          'targeting refers to ids that do not exist on this instance — create it by ' +
          'hand and re-run.',
      );
    }

    let policyId = policyIdByName.get(policy.name);
    if (policyId) {
      process.stdout.write(`= policy "${policy.name}" already exists, using it\n`);
      skipped.policies += 1;
    } else if (dryRun) {
      process.stdout.write(`+ policy "${policy.name}" (${policy.controls.length} controls)\n`);
      policyId = null;
      created.policies += 1;
    } else {
      const body = {
        name: policy.name,
        description: policy.description,
        scope: 'global',
        isActive: policy.isActive,
        displayOrder: policy.displayOrder,
        targetingRules: policy.targetingRules,
      };
      const result = await post('/api/policies', body);
      policyId = result.id;
      policyIdByName.set(policy.name, policyId);
      process.stdout.write(`+ policy "${policy.name}" -> ${policyId}\n`);
      created.policies += 1;
    }

    // Controls already under this policy, so a re-run does not duplicate them.
    const existingControlIds = new Set(
      policyId
        ? (await get(`/api/policy-controls?policyId=${encodeURIComponent(policyId)}`)).map(
            (c) => c.controlId,
          )
        : [],
    );

    for (const control of policy.controls) {
      if (existingControlIds.has(control.controlId)) {
        process.stdout.write(`  = ${control.controlId} already exists, skipped\n`);
        skipped.controls += 1;
        continue;
      }

      const body = { ...control, policyId };
      if (dryRun) {
        const scope = control.fields.filter((f) => f.role === 'applies_when').length;
        const compliance = control.fields.length - scope;
        process.stdout.write(
          `  + ${control.controlId} "${control.name}" — ${compliance} checks` +
            `${scope ? `, ${scope} scope` : ''}` +
            `${control.allowsAttestation ? `, attestable ${control.attestationValidDays}d` : ''}` +
            `${control.verificationRequired ? ', verification required' : ''}\n`,
        );
      } else {
        await post('/api/policy-controls', body);
        process.stdout.write(`  + ${control.controlId}\n`);
      }
      created.controls += 1;
      created.fields += control.fields.length;
    }
  }

  process.stdout.write(
    `\n${dryRun ? 'Would create' : 'Created'} ${created.policies} policies, ` +
      `${created.controls} controls, ${created.fields} field mappings. ` +
      `Skipped ${skipped.policies} existing policies and ${skipped.controls} existing controls.\n`,
  );
  if (dryRun) process.stdout.write('Dry run: nothing was written. Re-run without --dry-run.\n');
}

main().catch((error) => {
  // `fetch failed` on its own says nothing about which host was unreachable.
  const detail = error.message === 'fetch failed' ? `could not reach ${baseUrl}` : error.message;
  process.stderr.write(`\nFailed: ${detail}\n`);
  process.exit(1);
});
