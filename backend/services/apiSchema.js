import crypto from 'crypto';
import yaml from 'js-yaml';
import { getSensitiveFieldsConfig } from './scoringConfig.js';

export const API_SCHEMA_MAX_BYTES = 2 * 1024 * 1024;
const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;
const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);

function inferFormat(filename = '', content = '') {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'yaml';
  if (lower.endsWith('.json')) return 'json';

  const trimmed = content.trimStart();
  return trimmed.startsWith('{') ? 'json' : 'yaml';
}

function assertAllowedFilename(filename) {
  if (!filename) return;
  const lower = filename.toLowerCase();
  if (!lower.endsWith('.json') && !lower.endsWith('.yaml') && !lower.endsWith('.yml')) {
    throw new Error('Schema file must be .json, .yaml, or .yml');
  }
}

function parseSchema(content, format) {
  if (format === 'json') {
    return JSON.parse(content);
  }
  return yaml.load(content, { json: true });
}

function parseStoredSchema(schema) {
  return parseSchema(schema.content, schema.format || inferFormat(schema.filename, schema.content));
}

function validateOpenApiShape(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Schema must be a JSON or YAML object');
  }

  const openapi = typeof parsed.openapi === 'string' ? parsed.openapi.trim() : '';
  const swagger = typeof parsed.swagger === 'string' ? parsed.swagger.trim() : '';
  const isOpenApi3 = openapi.startsWith('3.');
  const isSwagger2 = swagger === '2.0';

  if (!isOpenApi3 && !isSwagger2) {
    throw new Error('Schema must be OpenAPI 3.x or Swagger 2.0');
  }

  if (!parsed.info || typeof parsed.info !== 'object' || Array.isArray(parsed.info)) {
    throw new Error('Schema must include an info object');
  }

  if (!parsed.paths || typeof parsed.paths !== 'object' || Array.isArray(parsed.paths)) {
    throw new Error('Schema must include a paths object');
  }
}

export function validateAndNormalizeApiSchema({ content, filename = 'openapi.yaml', contentType = 'text/plain' }) {
  if (typeof content !== 'string' || content.trim() === '') {
    throw new Error('Schema content is required');
  }

  assertAllowedFilename(filename);

  const sizeBytes = Buffer.byteLength(content, 'utf8');
  if (sizeBytes > API_SCHEMA_MAX_BYTES) {
    throw new Error('Schema must be 2 MB or smaller');
  }

  if (CONTROL_CHAR_REGEX.test(content)) {
    throw new Error('Schema appears to contain binary content');
  }

  const format = inferFormat(filename, content);
  let parsed;
  try {
    parsed = parseSchema(content, format);
  } catch (error) {
    throw new Error(`Schema is not valid ${format.toUpperCase()}: ${error.message}`);
  }

  validateOpenApiShape(parsed);

  return {
    filename: filename?.trim() || (format === 'json' ? 'openapi.json' : 'openapi.yaml'),
    contentType: contentType?.trim() || 'text/plain',
    content,
    format,
    sizeBytes,
    sha256: crypto.createHash('sha256').update(content).digest('hex'),
  };
}

export function apiSchemaSummary(schema) {
  if (!schema) return null;
  return {
    id: schema.id,
    filename: schema.filename,
    contentType: schema.contentType,
    format: schema.format,
    sizeBytes: schema.sizeBytes,
    sha256: schema.sha256,
    uploadedById: schema.uploadedById,
    uploadedAt: schema.uploadedAt,
    updatedAt: schema.updatedAt,
  };
}

function resolveRef(root, ref, seen = new Set()) {
  if (typeof ref !== 'string' || !ref.startsWith('#/') || seen.has(ref)) return null;
  seen.add(ref);
  return ref
    .slice(2)
    .split('/')
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce((current, part) => (current && typeof current === 'object' ? current[part] : null), root);
}

function schemaDisplayName(schema) {
  if (!schema || typeof schema !== 'object') return null;
  if (schema.$ref) return schema.$ref.split('/').pop();
  if (schema.title) return schema.title;
  if (schema.type) return schema.type;
  return null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileSensitiveRules() {
  return getSensitiveFieldsConfig().rules.map((rule) => ({
    ...rule,
    keyRegex: rule.keyTerms.length > 0
      ? new RegExp(`(${rule.keyTerms.map(escapeRegExp).join('|')})`, 'i')
      : null,
    valueRegexes: rule.valuePatterns.map((pattern) =>
      new RegExp(pattern.replace(/^\(\?i\)/, ''), 'i'),
    ),
  }));
}

function redactValue(value) {
  const stringValue = String(value);
  if (stringValue.length <= 4) return '***';
  if (/@/.test(stringValue)) {
    const [local, domain] = stringValue.split('@');
    return `${local.slice(0, 2)}***@${domain || '***'}`;
  }
  if (/^\d{3}-\d{2}-\d{4}$/.test(stringValue)) {
    return `***-**-${stringValue.slice(-4)}`;
  }
  if (stringValue.length > 16) {
    return `${stringValue.slice(0, 4)}...${stringValue.slice(-4)}`;
  }
  return `${stringValue.slice(0, 2)}***`;
}

function sampleValuesFromSchema(schema) {
  const values = [];
  if (!schema || typeof schema !== 'object') return values;
  if (schema.example !== undefined) values.push(schema.example);
  if (schema.default !== undefined) values.push(schema.default);
  if (Array.isArray(schema.enum)) values.push(...schema.enum);
  return values.filter((value) => ['string', 'number', 'boolean'].includes(typeof value));
}

function findingFromRule(rule, match) {
  return {
    ruleId: rule.id,
    label: rule.label,
    classification: rule.classification,
    severity: rule.severity,
    why: rule.why,
    reviewGuidance: rule.reviewGuidance,
    match,
  };
}

function matchSensitiveRules(rules, path, propertySchema) {
  const findings = [];
  for (const rule of rules) {
    if (rule.keyRegex?.test(path)) {
      findings.push(findingFromRule(rule, {
        source: 'field name',
        evidence: path,
      }));
      continue;
    }

    const values = sampleValuesFromSchema(propertySchema);
    let matched = false;
    for (const value of values) {
      for (const regex of rule.valueRegexes) {
        if (regex.test(String(value))) {
          findings.push(findingFromRule(rule, {
            source: 'example/default/enum value',
            evidence: redactValue(value),
          }));
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
  }
  return findings;
}

function collectSensitiveFields(root, schema, prefix = '', seenRefs = new Set(), depth = 0, rules = compileSensitiveRules()) {
  if (!schema || typeof schema !== 'object' || depth > 8) return [];

  if (schema.$ref) {
    const resolved = resolveRef(root, schema.$ref, seenRefs);
    return collectSensitiveFields(root, resolved, prefix, seenRefs, depth + 1, rules);
  }

  if (schema.allOf || schema.anyOf || schema.oneOf) {
    return [...(schema.allOf || []), ...(schema.anyOf || []), ...(schema.oneOf || [])].flatMap((subSchema) =>
      collectSensitiveFields(root, subSchema, prefix, seenRefs, depth + 1, rules),
    );
  }

  if (schema.items) {
    return collectSensitiveFields(root, schema.items, prefix ? `${prefix}[]` : 'items[]', seenRefs, depth + 1, rules);
  }

  const fields = [];
  const properties = schema.properties && typeof schema.properties === 'object' ? schema.properties : {};
  for (const [name, propertySchema] of Object.entries(properties)) {
    const path = prefix ? `${prefix}.${name}` : name;
    const format = propertySchema?.format ? String(propertySchema.format) : '';
    const type = propertySchema?.type ? String(propertySchema.type) : schemaDisplayName(propertySchema);
    const findings = matchSensitiveRules(rules, path, propertySchema);

    if (findings.length > 0) {
      fields.push({
        path,
        type: type || 'unknown',
        format: format || null,
        findings,
      });
    }

    fields.push(...collectSensitiveFields(root, propertySchema, path, new Set(seenRefs), depth + 1, rules));
  }

  return fields;
}

function getSchemaFromMediaObject(mediaObject) {
  if (!mediaObject || typeof mediaObject !== 'object') return null;
  if (mediaObject.schema) return mediaObject.schema;
  const firstContent = Object.values(mediaObject.content || {})[0];
  return firstContent?.schema || null;
}

function getPreferredContentEntry(content = {}) {
  if (!content || typeof content !== 'object') return null;
  return (
    content['application/json'] ||
    content['application/problem+json'] ||
    Object.values(content)[0] ||
    null
  );
}

function getMediaObjectExample(mediaObject) {
  if (!mediaObject || typeof mediaObject !== 'object') return undefined;
  if (mediaObject.example !== undefined) return mediaObject.example;
  const firstExample = Object.values(mediaObject.examples || {})[0];
  if (firstExample && typeof firstExample === 'object' && firstExample.value !== undefined) {
    return firstExample.value;
  }
  return undefined;
}

function sampleValueForSchema(root, schema, seenRefs = new Set(), depth = 0, propertyName = '') {
  if (!schema || typeof schema !== 'object' || depth > 6) return null;

  if (schema.$ref) {
    const resolved = resolveRef(root, schema.$ref, seenRefs);
    return sampleValueForSchema(root, resolved, seenRefs, depth + 1, propertyName);
  }

  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];

  const composed = schema.allOf || schema.anyOf || schema.oneOf;
  if (Array.isArray(composed) && composed.length > 0) {
    const objectSamples = composed
      .map((subSchema) => sampleValueForSchema(root, subSchema, new Set(seenRefs), depth + 1, propertyName))
      .filter((sample) => sample && typeof sample === 'object' && !Array.isArray(sample));
    if (objectSamples.length > 0) return Object.assign({}, ...objectSamples);
    return sampleValueForSchema(root, composed[0], new Set(seenRefs), depth + 1, propertyName);
  }

  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  if (type === 'array') {
    return [sampleValueForSchema(root, schema.items, new Set(seenRefs), depth + 1, propertyName)];
  }

  if (type === 'object' || schema.properties) {
    const sample = {};
    for (const [name, propertySchema] of Object.entries(schema.properties || {})) {
      sample[name] = sampleValueForSchema(root, propertySchema, new Set(seenRefs), depth + 1, name);
    }
    return sample;
  }

  const lowerName = String(propertyName).toLowerCase();
  if (type === 'integer' || type === 'number') return 123;
  if (type === 'boolean') return true;
  if (schema.format === 'date-time') return '2026-07-14T12:00:00Z';
  if (schema.format === 'date') return '2026-07-14';
  if (schema.format === 'email' || lowerName.includes('email')) return 'user@example.com';
  if (schema.format === 'uuid' || lowerName === 'id' || lowerName.endsWith('id')) return '123e4567-e89b-12d3-a456-426614174000';
  if (lowerName.includes('token')) return 'sample-token';
  if (lowerName.includes('password')) return 'sample-password';
  return 'string';
}

function buildRequestSample(root, operation) {
  const contentEntry = getPreferredContentEntry(operation.requestBody?.content);
  if (!contentEntry) return null;
  const explicitExample = getMediaObjectExample(contentEntry);
  return explicitExample !== undefined
    ? explicitExample
    : sampleValueForSchema(root, contentEntry.schema);
}

function buildResponseSample(root, operation) {
  const entries = Object.entries(operation.responses || {});
  const [statusCode, response] =
    entries.find(([code]) => code.startsWith('2')) ||
    entries.find(([code]) => code === 'default') ||
    entries[0] ||
    [];
  if (!response) return null;

  const contentEntry = getPreferredContentEntry(response.content);
  if (!contentEntry) return { statusCode, body: null };
  const explicitExample = getMediaObjectExample(contentEntry);
  return {
    statusCode,
    body: explicitExample !== undefined
      ? explicitExample
      : sampleValueForSchema(root, contentEntry.schema),
  };
}

function collectOperationSensitiveFields(root, operation) {
  const results = [];

  const requestSchema = getSchemaFromMediaObject(operation.requestBody);
  for (const field of collectSensitiveFields(root, requestSchema)) {
    results.push({ location: 'request', ...field });
  }

  for (const [statusCode, response] of Object.entries(operation.responses || {})) {
    const responseSchema = getSchemaFromMediaObject(response);
    for (const field of collectSensitiveFields(root, responseSchema)) {
      results.push({ location: `response ${statusCode}`, ...field });
    }
  }

  const seen = new Set();
  return results.filter((field) => {
    const key = `${field.location}:${field.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function summarizeAuth(root, operation, pathItem) {
  const security = operation.security ?? pathItem.security ?? root.security ?? [];
  const schemes = root.components?.securitySchemes || root.securityDefinitions || {};
  if (!Array.isArray(security) || security.length === 0) {
    return {
      required: false,
      schemes: [],
    };
  }

  const names = [...new Set(security.flatMap((requirement) => Object.keys(requirement || {})))];
  return {
    required: names.length > 0,
    schemes: names.map((name) => {
      const scheme = schemes[name] || {};
      return {
        name,
        type: scheme.type || 'unknown',
        scheme: scheme.scheme || null,
        in: scheme.in || null,
      };
    }),
  };
}

export function buildApiSchemaVisualization(schema) {
  if (!schema) return null;

  const parsed = parseStoredSchema(schema);
  validateOpenApiShape(parsed);

  const endpoints = [];
  for (const [pathName, pathItem] of Object.entries(parsed.paths || {})) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const [methodName, operation] of Object.entries(pathItem)) {
      const method = methodName.toLowerCase();
      if (!HTTP_METHODS.has(method) || !operation || typeof operation !== 'object') continue;

      endpoints.push({
        id: `${method.toUpperCase()} ${pathName}`,
        method: method.toUpperCase(),
        path: pathName,
        summary: operation.summary || operation.operationId || '',
        description: operation.description || '',
        tags: Array.isArray(operation.tags) ? operation.tags : [],
        auth: summarizeAuth(parsed, operation, pathItem),
        sensitiveFields: collectOperationSensitiveFields(parsed, operation),
        samples: {
          request: buildRequestSample(parsed, operation),
          response: buildResponseSample(parsed, operation),
        },
      });
    }
  }

  const authSchemes = parsed.components?.securitySchemes || parsed.securityDefinitions || {};
  return {
    title: parsed.info?.title || schema.filename || 'API schema',
    version: parsed.info?.version || null,
    openapi: parsed.openapi || parsed.swagger,
    endpoints,
    authSchemes: Object.entries(authSchemes).map(([name, scheme]) => ({
      name,
      type: scheme?.type || 'unknown',
      scheme: scheme?.scheme || null,
      in: scheme?.in || null,
    })),
    sensitiveFieldCount: endpoints.reduce((count, endpoint) => count + endpoint.sensitiveFields.length, 0),
  };
}
