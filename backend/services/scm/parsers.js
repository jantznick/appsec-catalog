/**
 * Provider-agnostic dependency / framework / language detection.
 *
 * The only thing a provider must supply is a `getFileText(path) => Promise<string|null>` function
 * (404-tolerant). Everything here — manifest parsing, framework recognition, lockfile version
 * enrichment, normalization — is the same regardless of GitHub / GitLab / Bitbucket / Azure DevOps.
 */

// -------- Framework detection ----------------------------------------------------------------
// ecosystem -> [ [matcher, canonical label] ]. Matched against the normalized dependency name.
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

/** @returns {string|null} canonical framework label if `name` is a recognized framework. */
function frameworkLabel(ecosystem, name) {
  const rules = FRAMEWORK_RULES[ecosystem];
  if (!rules) return null;
  for (const [re, label] of rules) {
    if (re.test(name)) return label;
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

/**
 * pypi: pyproject.toml — supports PEP 621 `[project] dependencies = [...]` (+ optional-dependencies)
 * and Poetry `[tool.poetry.dependencies]` / group + dev dependency tables. No TOML lib, so this is
 * a section-aware line scan (best-effort but covers the common shapes).
 */
function parsePyprojectToml(text) {
  const out = [];
  const seen = new Set();
  const push = (name, range) => {
    const n = String(name || '').trim();
    if (!n || n.toLowerCase() === 'python' || seen.has(n.toLowerCase())) return;
    seen.add(n.toLowerCase());
    out.push({ ecosystem: 'pypi', name: n, versionRange: range || null, source: 'pyproject.toml' });
  };

  // PEP 621: dependencies = ["pkg>=1", ...] and [project.optional-dependencies] arrays.
  for (const m of text.matchAll(/dependencies\s*=\s*\[([\s\S]*?)\]/g)) {
    for (const s of m[1].matchAll(/['"]([^'"]+)['"]/g)) {
      const spec = s[1].trim();
      const nameMatch = spec.match(/^([A-Za-z0-9._-]+)/);
      if (nameMatch) push(nameMatch[1], spec.slice(nameMatch[1].length).trim() || null);
    }
  }

  // Poetry: within [tool.poetry(.group.*)?.dependencies] / [tool.poetry.dev-dependencies] tables,
  // lines like `name = "^1.2"` or `name = { version = "^1.2" }`.
  const lines = text.split('\n');
  let inPoetryDeps = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('[')) {
      inPoetryDeps = /^\[tool\.poetry(\.group\.[^.\]]+)?\.(dev-)?dependencies\]/.test(line);
      continue;
    }
    if (!inPoetryDeps || !line || line.startsWith('#')) continue;
    const m = line.match(/^["']?([A-Za-z0-9._-]+)["']?\s*=\s*(.+)$/);
    if (!m) continue;
    let range = m[2].trim();
    const vin = range.match(/version\s*=\s*["']([^"']+)["']/); // inline table form
    if (vin) range = vin[1];
    else range = range.replace(/^["']|["']$/g, '');
    push(m[1], range);
  }
  return out;
}

/** maven (Gradle): build.gradle / build.gradle.kts `implementation 'group:artifact:version'`. */
function parseBuildGradle(text) {
  const out = [];
  const re =
    /(?:implementation|api|compileOnly|runtimeOnly|testImplementation|testRuntimeOnly|annotationProcessor|kapt|developmentOnly|providedRuntime)\s*[(\s]\s*['"]([^'":]+):([^'":]+):?([^'"]*)['"]/g;
  let m;
  const seen = new Set();
  while ((m = re.exec(text)) !== null) {
    const name = `${m[1].trim()}:${m[2].trim()}`;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ ecosystem: 'maven', name, versionRange: (m[3] || '').trim() || null, source: 'build.gradle' });
  }
  return out;
}

// Root-level manifests to probe. Each entry: file + parser.
const MANIFESTS = [
  { file: 'package.json', parse: parsePackageJson },
  { file: 'requirements.txt', parse: parseRequirementsTxt },
  { file: 'pyproject.toml', parse: parsePyprojectToml },
  { file: 'go.mod', parse: parseGoMod },
  { file: 'pom.xml', parse: parsePomXml },
  { file: 'build.gradle', parse: parseBuildGradle },
  { file: 'build.gradle.kts', parse: parseBuildGradle },
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

// ecosystem -> { file, build(text) -> Map(normalizedName -> version) }
const LOCKFILES = {
  npm: { file: 'package-lock.json', build: versionsFromPackageLock },
  composer: { file: 'composer.lock', build: versionsFromComposerLock },
};

/**
 * Detect a repo's normalized top-level dependency inventory from its root manifests + lockfiles.
 * Provider-agnostic: the caller supplies a 404-tolerant file reader.
 *
 * @param {(path: string) => Promise<string|null>} getFileText
 * @param {{ onWarn?: (file: string, error: Error) => void }} [opts]
 * @returns {Promise<Array<object>>} dependency rows
 */
export async function detectDependencies(getFileText, { onWarn } = {}) {
  const manifestTexts = await Promise.all(MANIFESTS.map((mf) => getFileText(mf.file)));
  const rawRows = [];
  MANIFESTS.forEach((mf, i) => {
    const text = manifestTexts[i];
    if (!text) return;
    try {
      rawRows.push(...mf.parse(text));
    } catch (e) {
      onWarn?.(mf.file, e);
    }
  });

  // Enrich with resolved versions from lockfiles, per ecosystem present.
  const ecosystemsPresent = new Set(rawRows.map((r) => r.ecosystem));
  const versionMaps = {};
  await Promise.all(
    Object.entries(LOCKFILES).map(async ([eco, spec]) => {
      if (!ecosystemsPresent.has(eco)) return;
      const text = await getFileText(spec.file);
      if (text) versionMaps[eco] = { map: spec.build(text), file: spec.file };
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

  return dependencies;
}

/** Top languages (by bytes) as a comma-joined string, or '' if none. */
export function topLanguagesString(languages) {
  return Object.entries(languages || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([lang]) => lang)
    .join(', ');
}

/** Distinct recognized-framework labels as a comma-joined string, or '' if none. */
export function frameworkLabelsString(dependencies) {
  return [
    ...new Set((dependencies || []).filter((d) => d.isFramework && d.framework).map((d) => d.framework)),
  ].join(', ');
}
