/**
 * Provider-abstracted model client. Anthropic and OpenAI are both implemented.
 *
 * The single-choke-point design lives above this file (runAi). Features describe
 * WHAT they want in a vendor-neutral way — a system prompt, a message array, and
 * (optionally) a tool schema for structured output — and this client decides HOW
 * to call the selected provider and normalizes the result to one shape:
 *
 *   { text, toolUse: { name, input } | null,
 *     usage: { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens },
 *     model, stopReason, latencyMs }
 *
 * Tools are passed in Anthropic's native shape — { name, description,
 * input_schema } — because input_schema is plain JSON Schema, identical to what
 * OpenAI wants under function `parameters`. The OpenAI branch translates.
 */
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { AiConfigError, AiError } from './errors.js';

let anthropicClient = null;
let openaiClient = null;

function getAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiConfigError('ANTHROPIC_API_KEY is not set');
  }
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      ...(process.env.ANTHROPIC_BASE_URL ? { baseURL: process.env.ANTHROPIC_BASE_URL } : {}),
    });
  }
  return anthropicClient;
}

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new AiConfigError('OPENAI_API_KEY is not set');
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
    });
  }
  return openaiClient;
}

/**
 * True when the given provider has the minimum config to make AI calls. With no
 * argument, true when ANY supported provider is configured.
 */
export function isAiConfigured(provider) {
  if (provider === 'anthropic') return Boolean(process.env.ANTHROPIC_API_KEY);
  if (provider === 'openai') return Boolean(process.env.OPENAI_API_KEY);
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
}

// Auth failures are a server-side config problem, not a bad request; surface 503.
function wrapProviderError(err) {
  const status = err?.status || 502;
  return new AiError(err?.message || 'Model request failed', {
    status: status === 401 ? 503 : status,
    code: 'ai_model_error',
    cause: err,
  });
}

// ---- Anthropic -------------------------------------------------------------

function anthropicUsage(usage = {}) {
  return {
    inputTokens: usage.input_tokens || 0,
    outputTokens: usage.output_tokens || 0,
    cacheReadTokens: usage.cache_read_input_tokens || 0,
    cacheWriteTokens: usage.cache_creation_input_tokens || 0,
  };
}

async function callAnthropic({ model, system, messages, maxTokens, tools, toolChoice }) {
  const client = getAnthropic();
  const started = Date.now();
  let resp;
  try {
    resp = await client.messages.create({
      model,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages,
      ...(tools ? { tools } : {}),
      ...(toolChoice ? { tool_choice: toolChoice } : {}),
    });
  } catch (err) {
    throw wrapProviderError(err);
  }
  const latencyMs = Date.now() - started;

  const blocks = Array.isArray(resp.content) ? resp.content : [];
  const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  const toolUseBlock = blocks.find((b) => b.type === 'tool_use');

  return {
    text,
    toolUse: toolUseBlock ? { name: toolUseBlock.name, input: toolUseBlock.input } : null,
    usage: anthropicUsage(resp.usage),
    model: resp.model || model,
    stopReason: resp.stop_reason || null,
    latencyMs,
  };
}

// ---- OpenAI ----------------------------------------------------------------

function openaiUsage(usage = {}) {
  const cached = usage.prompt_tokens_details?.cached_tokens || 0;
  return {
    // Match Anthropic's convention: input_tokens EXCLUDES cached tokens, which
    // are reported (and priced) separately. OpenAI's prompt_tokens INCLUDES the
    // cached ones, so subtract to keep cost math consistent across providers.
    inputTokens: Math.max((usage.prompt_tokens || 0) - cached, 0),
    outputTokens: usage.completion_tokens || 0,
    cacheReadTokens: cached,
    cacheWriteTokens: 0, // OpenAI has no separate cache-write bucket
  };
}

// Translate Anthropic-style tool schemas -> OpenAI function tools.
function toOpenAiTools(tools) {
  if (!tools) return undefined;
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

function toOpenAiToolChoice(toolChoice) {
  if (!toolChoice) return undefined;
  if (toolChoice.type === 'tool' && toolChoice.name) {
    return { type: 'function', function: { name: toolChoice.name } };
  }
  return toolChoice; // pass through 'auto' / 'required' / etc.
}

async function callOpenAI({ model, system, messages, maxTokens, tools, toolChoice }) {
  const client = getOpenAI();
  // OpenAI carries the system prompt as a message, not a top-level param.
  const fullMessages = system ? [{ role: 'system', content: system }, ...messages] : messages;

  const started = Date.now();
  let resp;
  try {
    resp = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: fullMessages,
      ...(tools ? { tools: toOpenAiTools(tools) } : {}),
      ...(toolChoice ? { tool_choice: toOpenAiToolChoice(toolChoice) } : {}),
    });
  } catch (err) {
    throw wrapProviderError(err);
  }
  const latencyMs = Date.now() - started;

  const choice = resp.choices?.[0];
  const message = choice?.message || {};
  const text = typeof message.content === 'string' ? message.content.trim() : '';

  let toolUse = null;
  const call = message.tool_calls?.[0];
  if (call?.function) {
    let input = {};
    try {
      input = call.function.arguments ? JSON.parse(call.function.arguments) : {};
    } catch {
      // Leave input as {} — runAi/feature validation treats missing input as a
      // failed structured response rather than trusting garbage.
      input = {};
    }
    toolUse = { name: call.function.name, input };
  }

  return {
    text,
    toolUse,
    usage: openaiUsage(resp.usage),
    model: resp.model || model,
    stopReason: choice?.finish_reason || null,
    latencyMs,
  };
}

// ---- Dispatch --------------------------------------------------------------

/**
 * Call the model. See file header for the normalized return shape.
 * @param {object} opts
 * @param {'anthropic'|'openai'} [opts.provider]
 */
export async function callModel({
  provider = 'anthropic',
  model,
  system,
  messages,
  maxTokens,
  tools,
  toolChoice,
}) {
  const args = { model, system, messages, maxTokens, tools, toolChoice };
  if (provider === 'anthropic') return callAnthropic(args);
  if (provider === 'openai') return callOpenAI(args);
  throw new AiError(`Unsupported AI provider: ${provider}`, { status: 400, code: 'ai_bad_provider' });
}
