/**
 * GitHub App integration service.
 *
 * Auth model: a single GitHub App. Individual users authorize the app (OAuth user-to-server)
 * and install it on the repos they choose. We store only the installation id + user identity
 * (see model GitHubConnection); repo reads use installation access tokens minted on demand from
 * the App private key, so we never persist short-lived installation tokens.
 *
 * Never log tokens or raw file contents. Reuses integrationLog for structured logs.
 */
import { App, Octokit } from 'octokit';
import { integrationLog } from '../integrations/log.js';
import { PROVIDER_GITHUB } from '../integrations/constants.js';

let cachedApp = null;

/**
 * Normalize the configured private key. Supports a raw PEM, a PEM with escaped `\n`,
 * or a single-line base64 encoding of the whole PEM.
 * @param {string} raw
 * @returns {string}
 */
function normalizePrivateKey(raw) {
  const value = String(raw || '').trim();
  if (value.includes('BEGIN') && value.includes('PRIVATE KEY')) {
    // Already PEM; unescape literal \n if present.
    return value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;
  }
  // Assume base64-encoded PEM.
  try {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    if (decoded.includes('PRIVATE KEY')) {
      return decoded;
    }
  } catch {
    // fall through
  }
  return value;
}

/**
 * @returns {boolean} whether the GitHub App env is fully configured.
 */
export function isGithubConfigured() {
  return Boolean(
    process.env.GITHUB_APP_ID &&
      process.env.GITHUB_APP_SLUG &&
      process.env.GITHUB_APP_CLIENT_ID &&
      process.env.GITHUB_APP_CLIENT_SECRET &&
      process.env.GITHUB_APP_PRIVATE_KEY,
  );
}

/**
 * The install redirect URL. Requires GITHUB_APP_SLUG.
 * @param {string} state CSRF state
 * @returns {string}
 */
export function buildInstallUrl(state) {
  const slug = process.env.GITHUB_APP_SLUG;
  if (!slug) {
    const err = new Error('GITHUB_APP_SLUG is not configured');
    err.statusCode = 503;
    throw err;
  }
  const u = new URL(`https://github.com/apps/${slug}/installations/new`);
  u.searchParams.set('state', state);
  return u.toString();
}

/**
 * Lazily build (and cache) the octokit App instance.
 * @returns {App}
 */
export function getApp() {
  if (cachedApp) {
    return cachedApp;
  }
  if (!isGithubConfigured()) {
    const err = new Error(
      'GitHub App is not configured. Set GITHUB_APP_ID, GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET and GITHUB_APP_PRIVATE_KEY.',
    );
    err.statusCode = 503;
    throw err;
  }
  cachedApp = new App({
    appId: process.env.GITHUB_APP_ID,
    privateKey: normalizePrivateKey(process.env.GITHUB_APP_PRIVATE_KEY),
    oauth: {
      clientId: process.env.GITHUB_APP_CLIENT_ID,
      clientSecret: process.env.GITHUB_APP_CLIENT_SECRET,
    },
  });
  return cachedApp;
}

/**
 * Exchange an OAuth `code` (from the install callback) for the connecting user's identity.
 * @param {string} code
 * @returns {Promise<{ token: string, githubUserId: string, login: string, avatarUrl: string | null, scopes: string | null }>}
 */
export async function exchangeOAuthCode(code) {
  const app = getApp();
  const { authentication } = await app.oauth.createToken({ code });
  const token = authentication.token;
  const userOctokit = new Octokit({ auth: token });
  const { data: user } = await userOctokit.rest.users.getAuthenticated();
  return {
    token,
    githubUserId: String(user.id),
    login: user.login,
    avatarUrl: user.avatar_url || null,
    scopes: Array.isArray(authentication.scopes) ? authentication.scopes.join(',') : null,
  };
}

/**
 * Octokit authenticated as a specific installation (mints a short-lived install token).
 * @param {string|number} installationId
 * @returns {Promise<Octokit>}
 */
export async function getInstallationOctokit(installationId) {
  const app = getApp();
  return app.getInstallationOctokit(Number(installationId));
}

/**
 * List the repositories a user's installation can access (the repos they granted).
 * @param {string|number} installationId
 * @returns {Promise<Array<{ githubRepoId: string, fullName: string, owner: string, name: string, htmlUrl: string, defaultBranch: string|null, isPrivate: boolean, description: string|null }>>}
 */
export async function listInstallationRepos(installationId) {
  const octokit = await getInstallationOctokit(installationId);
  const repos = await octokit.paginate('GET /installation/repositories', { per_page: 100 });
  return repos.map((r) => ({
    githubRepoId: String(r.id),
    fullName: r.full_name,
    owner: r.owner?.login ?? r.full_name.split('/')[0],
    name: r.name,
    htmlUrl: r.html_url,
    defaultBranch: r.default_branch || null,
    isPrivate: Boolean(r.private),
    description: r.description || null,
  }));
}

/**
 * Fetch a text file from a repo (404-tolerant). Falls back to the blob API for large files.
 * @returns {Promise<string|null>} file text, or null if absent.
 */
async function fetchFileText(octokit, owner, repo, path) {
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path });
    if (Array.isArray(data) || data.type !== 'file') {
      return null;
    }
    if (data.content) {
      return Buffer.from(data.content, data.encoding || 'base64').toString('utf8');
    }
    if (data.sha) {
      const { data: blob } = await octokit.rest.git.getBlob({ owner, repo, file_sha: data.sha });
      return Buffer.from(blob.content, blob.encoding || 'base64').toString('utf8');
    }
    return null;
  } catch (e) {
    if (e.status === 404) {
      return null;
    }
    throw e;
  }
}

// -------- Framework detection ----------------------------------------------------------------
// ecosystem -> { matcher(name) -> canonical label }. Matched against the normalized dep name.
const FRAMEWORK_RULES = {
  npm: [
    [/^react(-dom)?$/, 'React'],
    [/^next$/, 'Next.js'],
    [/^vue$/, 'Vue'],
    [/^@angular\/core$/, 'Angular'],
    [/^svelte$/, 'Svelte'],
    [/^@sveltejs\/kit$/, 'SvelteKit'],
    [/^express$/, 'Express'],
    [/^@nestjs\/core$/, 'NestJS'],
    [/^koa$/, 'Koa'],
    [/^fastify$/, 'Fastify'],
    [/^gatsby$/, 'Gatsby'],
    [/^nuxt$/, 'Nuxt'],
  ],
  pypi: [
    [/^django$/, 'Django'],
    [/^flask$/, 'Flask'],
    [/^fastapi$/, 'FastAPI'],
    [/^tornado$/, 'Tornado'],
    [/^pyramid$/, 'Pyramid'],
  ],
  maven: [
    [/spring-boot/, 'Spring Boot'],
    [/spring-webmvc/, 'Spring MVC'],
    [/quarkus/, 'Quarkus'],
    [/micronaut/, 'Micronaut'],
  ],
  go: [
    [/gin-gonic\/gin$/, 'Gin'],
    [/labstack\/echo/, 'Echo'],
    [/gofiber\/fiber/, 'Fiber'],
    [/beego/, 'Beego'],
  ],
  rubygems: [
    [/^rails$/, 'Ruby on Rails'],
    [/^sinatra$/, 'Sinatra'],
    [/^hanami$/, 'Hanami'],
  ],
  composer: [
    [/^laravel\/framework$/, 'Laravel'],
    [/^symfony\/framework-bundle$/, 'Symfony'],
    [/^symfony\/symfony$/, 'Symfony'],
    [/^cakephp\/cakephp$/, 'CakePHP'],
  ],
  nuget: [[/^Microsoft\.AspNetCore/i, 'ASP.NET Core']],
};

/**
 * @returns {string|null} canonical framework label if `name` is a recognized framework.
 */
function frameworkLabel(ecosystem, name) {
  const rules = FRAMEWORK_RULES[ecosystem];
  if (!rules) {
    return null;
  }
  for (const [re, label] of rules) {
    if (re.test(name)) {
      return label;
    }
  }
  return null;
}

const LOWERCASE_ECOSYSTEMS = new Set(['npm', 'pypi', 'composer', 'rubygems']);

function normalizeName(ecosystem, name) {
  const trimmed = String(name || '').trim();
  return LOWERCASE_ECOSYSTEMS.has(ecosystem) ? trimmed.toLowerCase() : trimmed;
}

// -------- Manifest parsers ------------------------------------------------------------------

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** npm: package.json dependencies + devDependencies. */
function parsePackageJson(text) {
  const json = safeJsonParse(text);
  if (!json) return [];
  const out = [];
  for (const group of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const deps = json[group];
    if (deps && typeof deps === 'object') {
      for (const [name, range] of Object.entries(deps)) {
        out.push({ ecosystem: 'npm', name, versionRange: String(range), source: 'package.json' });
      }
    }
  }
  return out;
}

/** pypi: requirements.txt lines like `name==1.2.3`, `name>=1.0`, `name`. */
function parseRequirementsTxt(text) {
  const out = [];
  for (const rawLine of String(text).split('\n')) {
    const line = rawLine.split('#')[0].trim();
    if (!line || line.startsWith('-')) continue; // skip flags like -r, -e
    const m = /^([A-Za-z0-9_.\-]+)\s*(\[[^\]]*\])?\s*(.*)$/.exec(line);
    if (!m) continue;
    out.push({
      ecosystem: 'pypi',
      name: m[1],
      versionRange: (m[3] || '').trim() || null,
      source: 'requirements.txt',
    });
  }
  return out;
}

/** go.mod require directives (single-line and block form). Versions are resolved. */
function parseGoMod(text) {
  const out = [];
  const lines = String(text).split('\n');
  let inBlock = false;
  for (const raw of lines) {
    let line = raw.trim();
    if (line.startsWith('//')) continue;
    if (line.startsWith('require (')) {
      inBlock = true;
      continue;
    }
    if (inBlock && line === ')') {
      inBlock = false;
      continue;
    }
    if (line.startsWith('require ')) {
      line = line.slice('require '.length).trim();
    } else if (!inBlock) {
      continue;
    }
    line = line.replace(/\/\/.*$/, '').trim(); // strip trailing comments (e.g. // indirect)
    const m = /^(\S+)\s+(\S+)$/.exec(line);
    if (m) {
      out.push({ ecosystem: 'go', name: m[1], versionRange: m[2], version: m[2], source: 'go.mod' });
    }
  }
  return out;
}

/** maven: pom.xml <dependency> blocks. name = groupId:artifactId. */
function parsePomXml(text) {
  const out = [];
  const re = /<dependency>([\s\S]*?)<\/dependency>/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const block = m[1];
    const g = /<groupId>([^<]+)<\/groupId>/.exec(block);
    const a = /<artifactId>([^<]+)<\/artifactId>/.exec(block);
    const v = /<version>([^<]+)<\/version>/.exec(block);
    if (g && a) {
      out.push({
        ecosystem: 'maven',
        name: `${g[1].trim()}:${a[1].trim()}`,
        versionRange: v ? v[1].trim() : null,
        source: 'pom.xml',
      });
    }
  }
  return out;
}

/** composer: composer.json require / require-dev. */
function parseComposerJson(text) {
  const json = safeJsonParse(text);
  if (!json) return [];
  const out = [];
  for (const group of ['require', 'require-dev']) {
    const deps = json[group];
    if (deps && typeof deps === 'object') {
      for (const [name, range] of Object.entries(deps)) {
        if (name === 'php' || name.startsWith('ext-')) continue; // platform reqs, not packages
        out.push({ ecosystem: 'composer', name, versionRange: String(range), source: 'composer.json' });
      }
    }
  }
  return out;
}

/** rubygems: Gemfile `gem 'name', '~> x'`. */
function parseGemfile(text) {
  const out = [];
  const re = /^\s*gem\s+['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]+)['"])?/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({ ecosystem: 'rubygems', name: m[1], versionRange: m[2] || null, source: 'Gemfile' });
  }
  return out;
}

// Root-level manifests to probe. Each entry: file + parser.
const MANIFESTS = [
  { file: 'package.json', parse: parsePackageJson },
  { file: 'requirements.txt', parse: parseRequirementsTxt },
  { file: 'go.mod', parse: parseGoMod },
  { file: 'pom.xml', parse: parsePomXml },
  { file: 'composer.json', parse: parseComposerJson },
  { file: 'Gemfile', parse: parseGemfile },
];

// -------- Lockfile version enrichment -------------------------------------------------------

/** package-lock.json -> Map(name -> version). Supports npm v7+ "packages" and legacy "dependencies". */
function versionsFromPackageLock(text) {
  const json = safeJsonParse(text);
  const map = new Map();
  if (!json) return map;
  if (json.packages && typeof json.packages === 'object') {
    for (const [key, val] of Object.entries(json.packages)) {
      if (!key.startsWith('node_modules/')) continue;
      const name = key.slice('node_modules/'.length);
      if (val?.version && !name.includes('node_modules/')) {
        map.set(name.toLowerCase(), val.version);
      }
    }
  }
  if (json.dependencies && typeof json.dependencies === 'object') {
    for (const [name, val] of Object.entries(json.dependencies)) {
      if (val?.version && !map.has(name.toLowerCase())) {
        map.set(name.toLowerCase(), val.version);
      }
    }
  }
  return map;
}

/** composer.lock -> Map(name -> version). */
function versionsFromComposerLock(text) {
  const json = safeJsonParse(text);
  const map = new Map();
  if (!json) return map;
  for (const group of ['packages', 'packages-dev']) {
    if (Array.isArray(json[group])) {
      for (const pkg of json[group]) {
        if (pkg?.name && pkg?.version) {
          map.set(String(pkg.name).toLowerCase(), String(pkg.version).replace(/^v/, ''));
        }
      }
    }
  }
  return map;
}

// ecosystem -> { lockfile, build(text) -> Map(normalizedName -> version) }
const LOCKFILES = {
  npm: { file: 'package-lock.json', build: versionsFromPackageLock },
  composer: { file: 'composer.lock', build: versionsFromComposerLock },
};

/**
 * Pull languages, metadata, and a normalized top-level dependency inventory for a repo.
 * @param {string|number} installationId
 * @param {string} owner
 * @param {string} name
 * @returns {Promise<{ metadata: object, languages: object, dependencies: Array<object> }>}
 */
export async function fetchRepoIntel(installationId, owner, name) {
  const octokit = await getInstallationOctokit(installationId);

  const [repoRes, langRes] = await Promise.all([
    octokit.rest.repos.get({ owner, repo: name }),
    octokit.rest.repos.listLanguages({ owner, repo: name }).catch(() => ({ data: {} })),
  ]);
  const repo = repoRes.data;

  const metadata = {
    githubRepoId: String(repo.id),
    fullName: repo.full_name,
    owner: repo.owner?.login ?? owner,
    name: repo.name,
    htmlUrl: repo.html_url,
    defaultBranch: repo.default_branch || null,
    description: repo.description || null,
    isPrivate: Boolean(repo.private),
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    license: repo.license?.spdx_id || repo.license?.name || null,
  };

  // Parse manifests (404-tolerant, concurrent).
  const manifestTexts = await Promise.all(
    MANIFESTS.map((mf) => fetchFileText(octokit, owner, name, mf.file)),
  );
  const rawRows = [];
  MANIFESTS.forEach((mf, i) => {
    const text = manifestTexts[i];
    if (text) {
      try {
        rawRows.push(...mf.parse(text));
      } catch (e) {
        integrationLog('warn', {
          provider: PROVIDER_GITHUB,
          op: 'parse_manifest',
          file: mf.file,
          repo: repo.full_name,
          error: e.message,
        });
      }
    }
  });

  // Enrich with resolved versions from lockfiles, per ecosystem present.
  const ecosystemsPresent = new Set(rawRows.map((r) => r.ecosystem));
  const versionMaps = {};
  await Promise.all(
    Object.entries(LOCKFILES).map(async ([eco, spec]) => {
      if (!ecosystemsPresent.has(eco)) return;
      const text = await fetchFileText(octokit, owner, name, spec.file);
      if (text) {
        versionMaps[eco] = { map: spec.build(text), file: spec.file };
      }
    }),
  );

  // Normalize + dedupe (keep first occurrence per ecosystem+name).
  const seen = new Set();
  const dependencies = [];
  for (const row of rawRows) {
    const normName = normalizeName(row.ecosystem, row.name);
    if (!normName) continue;
    const key = `${row.ecosystem}::${normName}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let version = row.version || null;
    let resolvedFrom = version ? row.source : null;
    const lock = versionMaps[row.ecosystem];
    if (!version && lock) {
      const resolved = lock.map.get(normName);
      if (resolved) {
        version = resolved;
        resolvedFrom = lock.file;
      }
    }

    const framework = frameworkLabel(row.ecosystem, normName);
    dependencies.push({
      ecosystem: row.ecosystem,
      name: normName,
      version: version || null,
      versionRange: row.versionRange || null,
      isFramework: Boolean(framework),
      framework: framework || null,
      source: row.source,
      resolvedFrom: resolvedFrom || null,
    });
  }

  integrationLog('info', {
    provider: PROVIDER_GITHUB,
    op: 'fetch_repo_intel',
    repo: repo.full_name,
    languageCount: Object.keys(langRes.data || {}).length,
    dependencyCount: dependencies.length,
    frameworkCount: dependencies.filter((d) => d.isFramework).length,
  });

  return { metadata, languages: langRes.data || {}, dependencies };
}

/**
 * Replace the stored dependency inventory for a repo (delete-all + recreate), so a re-sync
 * reflects added and removed packages.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} githubRepoId GitHubRepo.id (our cuid, not the GitHub numeric id)
 * @param {Array<object>} rows
 */
export async function saveRepoDependencies(prisma, githubRepoId, rows) {
  await prisma.$transaction([
    prisma.repoDependency.deleteMany({ where: { githubRepoId } }),
    ...(rows.length
      ? [
          prisma.repoDependency.createMany({
            data: rows.map((r) => ({
              githubRepoId,
              ecosystem: r.ecosystem,
              name: r.name,
              version: r.version,
              versionRange: r.versionRange,
              isFramework: r.isFramework,
              framework: r.framework,
              source: r.source,
              resolvedFrom: r.resolvedFrom,
            })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);
}
