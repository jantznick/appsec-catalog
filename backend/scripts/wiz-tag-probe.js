/**
 * Read-only probe: what does Wiz actually return for a company's folder?
 *
 * WHY THIS EXISTS
 *
 * The Phase 4 tag triple depends on three things nobody has verified against a
 * real tenant:
 *
 *   1. WHICH RESOURCE TYPES carry the tags. The existing tag listing asks only for
 *      VIRTUAL_MACHINE, but the premise is that containers and images carry the
 *      Product / Application / Environment triple. If Wiz does not surface those as
 *      their own entities with their own tags, option A's `_shared` convention
 *      loses all per-application attribution and we need to know that BEFORE
 *      building a picker on top of it.
 *   2. THE SHAPE OF `properties.tags`. normalizeWizTagValues defensively handles an
 *      array of strings, an array of {key,value} objects AND a plain object, which
 *      is a strong hint that whoever wrote it did not know either. Correlating a
 *      triple requires knowing which one it really is.
 *   3. WHICH TAG KEYS EXIST. We assume Product / Application / Environment. Some
 *      companies call a product a "solution", which is why the keys are going to
 *      become per-company config.
 *
 * Building the triple resolution on guesses for all three is how you get a picker
 * that returns nothing and no idea which assumption was wrong. This answers all
 * three by looking.
 *
 * SAFETY
 *
 * Read-only. It issues the same graphSearch query the catalog already uses, writes
 * nothing to the database and nothing to Wiz. It prints tag keys and values, which
 * are resource metadata rather than secrets - but it is still your tenant's data,
 * so do not paste the output anywhere you would not paste a resource inventory.
 *
 * USAGE
 *
 *   node scripts/wiz-tag-probe.js                        # every Wiz-linked company
 *   node scripts/wiz-tag-probe.js --company <companyId>
 *   node scripts/wiz-tag-probe.js --types VIRTUAL_MACHINE,CONTAINER,CONTAINER_IMAGE
 *   node scripts/wiz-tag-probe.js --raw 3                # dump 3 raw tag blobs
 *   node scripts/wiz-tag-probe.js --folders              # list folders, find an id
 *   node scripts/wiz-tag-probe.js --folder <uuid>       # a folder IS a company
 *   node scripts/wiz-tag-probe.js --folder <uuid> --product Orbit --application backend
 *
 * With --product and/or --application it stops surveying and runs the REAL filter
 * the application page will run - folder, then product tag, then application tag -
 * so the query can be proven against a tenant before any UI exists. Resources
 * carrying the product but no application come back as `shared`.
 *
 * A folder IS a company in this tenant, so --folder is the only argument that
 * identifies what to look at. --folders lists the ids. --company is optional and
 * is used only to pick credentials; with enterprise-scoped credentials, which is
 * the normal case, you never need it. Probing by folder saves nothing to the
 * database, so an exploratory look leaves no trace either side.
 */

import { prisma } from '../prisma/client.js';
import { resolveIntegrationForCompany } from '../integrations/resolve.js';
import {
  WIZ_RESOURCE_TYPES,
  fetchWizAccessToken,
  listWizFolders,
  listWizResourcesForFolder,
  normalizeWizGraphqlUrl,
  wizGraphql,
} from '../integrations/wiz.js';

const PROVIDER_WIZ = 'WIZ';

/**
 * The types worth asking about by default.
 *
 * VIRTUAL_MACHINE is what the catalog asks for today. The rest are the candidates
 * for carrying a container-tagged triple; an unknown type makes Wiz reject the whole
 * query, so the probe tries each type on its own and reports which ones answer.
 */
const DEFAULT_TYPES = [
  'VIRTUAL_MACHINE',
  'CONTAINER',
  'CONTAINER_IMAGE',
  'CONTAINER_REGISTRY',
  'SERVERLESS',
  'KUBERNETES_CLUSTER',
  'DATABASE',
  'BUCKET',
  'LOAD_BALANCER',
];

function parseArgs(argv) {
  const args = { companyId: null, types: DEFAULT_TYPES, raw: 1, pages: 1, listFolders: false, folderId: null, product: null, application: null };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--company') args.companyId = argv[++i];
    else if (flag === '--types') args.types = argv[++i].split(',').map((t) => t.trim()).filter(Boolean);
    else if (flag === '--raw') args.raw = Number(argv[++i]) || 0;
    else if (flag === '--pages') args.pages = Math.max(1, Number(argv[++i]) || 1);
    else if (flag === '--folders') args.listFolders = true;
    else if (flag === '--folder') args.folderId = argv[++i];
    else if (flag === '--product') args.product = argv[++i];
    else if (flag === '--application') args.application = argv[++i];
  }
  return args;
}

/** Same parsing the integration uses: `properties` may arrive as JSON text. */
function parseProperties(properties) {
  if (!properties) return null;
  if (typeof properties === 'object') return properties;
  if (typeof properties !== 'string') return null;
  try {
    return JSON.parse(properties);
  } catch {
    return null;
  }
}

/**
 * Describe the shape of a tags blob without assuming which one it is.
 * @returns {{ shape: string, pairs: Array<[string, string]> }}
 */
function describeTags(rawTags) {
  if (!rawTags) return { shape: 'absent', pairs: [] };

  if (Array.isArray(rawTags)) {
    const pairs = [];
    let sawString = false;
    let sawObject = false;
    for (const tag of rawTags) {
      if (typeof tag === 'string') {
        sawString = true;
        const idx = tag.indexOf(':');
        pairs.push(idx > 0 ? [tag.slice(0, idx).trim(), tag.slice(idx + 1).trim()] : [tag.trim(), '']);
      } else if (tag && typeof tag === 'object') {
        sawObject = true;
        const key = tag.key ?? tag.name;
        if (key != null) pairs.push([String(key), tag.value == null ? '' : String(tag.value)]);
      }
    }
    const shape = sawObject && sawString
      ? 'array<mixed>'
      : sawObject
        ? 'array<{key,value}>'
        : 'array<string>';
    return { shape, pairs };
  }

  if (typeof rawTags === 'object') {
    return { shape: 'object<key,value>', pairs: Object.entries(rawTags).map(([k, v]) => [k, String(v)]) };
  }

  return { shape: typeof rawTags, pairs: [] };
}

/**
 * The probe asks for id/name/type as well as properties, so an example can say WHICH
 * resource carried a triple. That is one more assumption about Wiz's schema than the
 * catalog currently makes, and this script exists precisely because assumptions about
 * Wiz have not been verified - so there is a fallback to the exact selection the
 * integration already uses and is known to work.
 */
const TAG_QUERY_RICH = `
  query WizTagProbe($query: GraphEntityQueryInput, $projectId: String!, $first: Int, $after: String) {
    graphSearch(query: $query, projectId: $projectId, first: $first, after: $after, quick: false) {
      pageInfo { hasNextPage endCursor }
      nodes { entities { id name type properties } }
    }
  }
`;

const TAG_QUERY_MINIMAL = `
  query WizTagProbe($query: GraphEntityQueryInput, $projectId: String!, $first: Int, $after: String) {
    graphSearch(query: $query, projectId: $projectId, first: $first, after: $after, quick: false) {
      pageInfo { hasNextPage endCursor }
      nodes { entities { properties } }
    }
  }
`;

/** Which selection this tenant accepts; decided once, on the first query. */
let tagQuery = TAG_QUERY_RICH;
let narrowedSelection = false;

async function graphSearchTags(url, token, variables) {
  try {
    return await wizGraphql(url, token, tagQuery, variables);
  } catch (error) {
    if (tagQuery === TAG_QUERY_RICH) {
      tagQuery = TAG_QUERY_MINIMAL;
      narrowedSelection = true;
      return wizGraphql(url, token, tagQuery, variables);
    }
    throw error;
  }
}

async function probeType({ url, token, folderId, type, pages, collector }) {
  let after = null;
  let page = 0;
  let entityCount = 0;

  while (page < pages) {
    page += 1;
    const data = await graphSearchTags(url, token, {
      first: 50,
      after,
      projectId: folderId,
      query: { select: true, type: [type] },
    });

    const connection = data?.graphSearch;
    if (!connection) return { entityCount, error: 'empty graphSearch response' };

    for (const node of connection.nodes || []) {
      for (const entity of node?.entities || []) {
        entityCount += 1;
        const props = parseProperties(entity?.properties);
        const { shape, pairs } = describeTags(props?.tags);

        collector.shapes.set(shape, (collector.shapes.get(shape) || 0) + 1);
        for (const [key, value] of pairs) {
          if (!collector.keys.has(key)) collector.keys.set(key, new Set());
          if (collector.keys.get(key).size < 12) collector.keys.get(key).add(value);
        }

        // A resource carrying more than one of the keys we care about is the thing
        // that makes a triple possible at all, so keep a few whole examples.
        if (collector.examples.length < collector.rawWanted && pairs.length) {
          collector.examples.push({
            type: entity?.type || type,
            name: entity?.name || entity?.id || '(unnamed)',
            shape,
            tags: Object.fromEntries(pairs),
          });
        }
      }
    }

    if (!connection.pageInfo?.hasNextPage) break;
    after = connection.pageInfo.endCursor || null;
  }

  return { entityCount, error: null };
}

/**
 * Probe one folder.
 *
 * A company IS a folder in this tenant, so the folder is the only thing that
 * identifies what to look at. `companyId` is optional and is used for one thing
 * only: resolving credentials. Enterprise-scoped credentials cover the whole
 * tenant, so `--folder` on its own is the normal way to run this.
 */
async function probeFolder({ folderId, label, companyId }, args) {
  console.log(`\n${'='.repeat(72)}`);
  console.log(label);
  console.log('='.repeat(72));

  const creds = await resolveIntegrationForCompany(companyId, PROVIDER_WIZ);
  if (!creds?.decrypted?.clientId || !creds?.decrypted?.clientSecret) {
    console.log('  no Wiz credentials resolvable — skipping');
    return;
  }

  console.log(`  folder: ${folderId}   credentials: ${creds.scope}`);

  const url = normalizeWizGraphqlUrl(creds.baseUrl || '');
  const token = await fetchWizAccessToken(creds.decrypted.clientId, creds.decrypted.clientSecret);

  const collector = { shapes: new Map(), keys: new Map(), examples: [], rawWanted: args.raw };
  const perType = [];

  for (const type of args.types) {
    try {
      const { entityCount } = await probeType({ url, token, folderId, type, pages: args.pages, collector });
      perType.push({ type, entityCount, error: null });
    } catch (error) {
      // An unknown type makes Wiz reject the whole query, so each type is asked for
      // separately and a rejection is reported rather than ending the probe.
      perType.push({ type, entityCount: 0, error: error?.message || String(error) });
    }
  }

  console.log('\n  RESOURCE TYPES');
  for (const row of perType) {
    const status = row.error ? `error: ${row.error.slice(0, 90)}` : `${row.entityCount} entities`;
    console.log(`    ${row.type.padEnd(22)} ${status}`);
  }

  console.log('\n  TAG BLOB SHAPES  (what properties.tags actually is)');
  if (collector.shapes.size === 0) console.log('    none seen');
  for (const [shape, count] of collector.shapes) {
    console.log(`    ${shape.padEnd(22)} ${count} resources`);
  }

  console.log('\n  TAG KEYS  (and up to 12 distinct values each)');
  if (collector.keys.size === 0) console.log('    none seen');
  for (const [key, values] of [...collector.keys].sort()) {
    console.log(`    ${key}`);
    console.log(`      ${[...values].join(', ')}`);
  }

  if (collector.examples.length) {
    console.log('\n  WHOLE RESOURCES  (is the triple present on ONE resource?)');
    for (const example of collector.examples) {
      console.log(`    [${example.type}] ${example.name}  (${example.shape})`);
      console.log(`      ${JSON.stringify(example.tags)}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.listFolders) {
    // Enterprise-scoped credentials cover the whole tenant, so this lists every
    // folder regardless of which company (if any) is named.
    const creds = await resolveIntegrationForCompany(args.companyId, PROVIDER_WIZ);
    if (!creds?.decrypted?.clientId) {
      console.log('No Wiz credentials resolvable. Check an enterprise Wiz credential exists.');
      return;
    }
    const folders = await listWizFolders(creds.decrypted, creds.baseUrl || '');
    console.log(`\n${folders.length} folder(s) visible to these credentials (${creds.scope}):\n`);
    for (const folder of folders) {
      console.log(`  ${folder.id}  ${folder.name}`);
    }
    console.log('\nProbe one with:  --folder <folderId>');
    return;
  }

  // A folder IS a company here, so --folder is all it takes. Everything else is a
  // convenience for folders already linked to a company record.
  let targets;
  if (args.folderId) {
    targets = [{ folderId: args.folderId, label: args.folderId, companyId: args.companyId }];
  } else {
    const companies = args.companyId
      ? await prisma.company.findMany({ where: { id: args.companyId }, select: { id: true, name: true } })
      : await prisma.company.findMany({
        where: { companyToolLinks: { some: { provider: PROVIDER_WIZ } } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });

    const links = await prisma.companyToolLink.findMany({
      where: { provider: PROVIDER_WIZ, companyId: { in: companies.map((c) => c.id) } },
      select: { companyId: true, filter: true },
    });
    const folderByCompany = new Map(links.map((l) => [l.companyId, l.filter?.folderId]));

    targets = companies
      .map((c) => ({
        folderId: folderByCompany.get(c.id),
        label: `${c.name}  (${c.id})`,
        companyId: c.id,
      }))
      .filter((t) => {
        if (!t.folderId) console.log(`Skipping ${t.label} — no Wiz folder configured`);
        return Boolean(t.folderId);
      });
  }

  if (!targets.length) {
    console.log('Nothing to probe. Run with --folders to list folder ids, then --folder <id>.');
    return;
  }

  // Filter mode: exercise the query the application page will issue, rather than
  // surveying what tags exist.
  if (args.product || args.application) {
    for (const target of targets) {
      const creds = await resolveIntegrationForCompany(target.companyId, PROVIDER_WIZ);
      if (!creds?.decrypted?.clientId) {
        console.log(`\n${target.label}: no Wiz credentials resolvable`);
        continue;
      }
      const types = args.types === DEFAULT_TYPES ? WIZ_RESOURCE_TYPES : args.types;
      console.log(`\n${'='.repeat(72)}`);
      console.log(`${target.label}`);
      console.log(`  product=${args.product || '(any)'}  application=${args.application || '(any)'}`);
      console.log(`  types: ${types.join(', ')}`);
      console.log('='.repeat(72));

      const { resources, scanned, errors, serverFiltered, whereRejected } = await listWizResourcesForFolder(
        creds.decrypted,
        creds.baseUrl || '',
        target.folderId,
        { productValue: args.product, applicationValue: args.application, types },
      );

      console.log(
        `\n  ${resources.length} matched of ${scanned} scanned`
        + `   (${serverFiltered ? 'Wiz filtered server-side' : 'filtered locally'})`,
      );
      if (!serverFiltered && whereRejected) {
        // Worth seeing: it names the predicate syntax this tenant rejected, which
        // is the only way to learn the right one without guessing in production.
        console.log(`  server-side tag filter rejected: ${whereRejected}`);
      }
      for (const e of errors) console.log(`  type ${e.type} errored: ${e.message}`);

      for (const r of resources.slice(0, 40)) {
        const context = [
          r.environment ? `env=${r.environment}` : null,
          r.role ? `role=${r.role}` : null,
        ].filter(Boolean).join('  ');
        console.log(`    [${r.match}] ${r.type.padEnd(18)} ${r.name || r.id || '(unnamed)'}   ${context}`);
      }
      if (resources.length > 40) console.log(`    … and ${resources.length - 40} more`);
    }
    console.log('\nDone. Nothing was written.');
    return;
  }

  console.log(`Probing ${targets.length} folder(s) for types: ${args.types.join(', ')}`);

  for (const target of targets) {
    try {
      await probeFolder(target, args);
    } catch (error) {
      console.error(`\n  ${target.label}: ${error?.message || error}`);
    }
  }

  if (narrowedSelection) {
    console.log(
      '\nNote: this tenant rejected id/name/type on an entity, so examples are tagged'
      + ' blobs without the resource they came from. Worth knowing for Phase 4 - the tag'
      + ' picker wants to show people which resource it matched.',
    );
  }
  console.log('\nDone. Nothing was written.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
