/**
 * Typed errors for the AI layer. Each carries an HTTP `status` and a stable
 * `code` so routes can translate them into consistent JSON responses.
 */

export class AiError extends Error {
  constructor(message, { status = 500, code = 'ai_error', cause } = {}) {
    super(message);
    this.name = 'AiError';
    this.status = status;
    this.code = code;
    if (cause) this.cause = cause;
  }
}

// The instance is missing an API key / model config. Features should fail closed.
export class AiConfigError extends AiError {
  constructor(message = 'AI is not configured on this server', opts = {}) {
    super(message, { status: 503, code: 'ai_not_configured', ...opts });
    this.name = 'AiConfigError';
  }
}

// The caller's company/user/feature is not allowed to use AI (gating or budget).
export class AiAccessError extends AiError {
  constructor(message = 'AI access denied', { reason, ...opts } = {}) {
    super(message, { status: 403, code: 'ai_access_denied', ...opts });
    this.name = 'AiAccessError';
    this.reason = reason || null;
  }
}
