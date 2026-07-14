import crypto from 'crypto';
import yaml from 'js-yaml';

export const API_SCHEMA_MAX_BYTES = 2 * 1024 * 1024;
const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

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
