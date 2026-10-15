const OpenAIModule = require('openai');
const { makeClient } = require('./client');
const getConfig = require('./config');
const { logCall } = require('./log');

class LlmError extends Error {
  constructor(status, message, kind) {
    super(message);
    this.httpStatus = status; // what OUR endpoint should answer
    this.kind = kind;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retry-After is either seconds ("2") or an HTTP date. Handle both.
function retryAfterMs(headers) {
  const h = headers && (typeof headers.get === 'function' ? headers.get('retry-after') : headers['retry-after']);
  if (h === undefined || h === null || h === '') return null;
  if (/^\d+(\.\d+)?$/.test(String(h).trim())) return Number(h) * 1000;
  const t = Date.parse(h);
  return Number.isNaN(t) ? null : Math.max(0, t - Date.now());
}

// Which failures are worth another try? Timeouts, 429, 5xx, dropped connections. Never 400/401/403.
function classify(err) {
  // instanceof, not err.name: the SDK's error classes all report name === 'Error'.
  // Check the timeout class first because it is a subclass of the connection error.
  if (err instanceof OpenAIModule.APIConnectionTimeoutError) return { retry: true, kind: 'timeout' };
  if (err instanceof OpenAIModule.APIConnectionError) return { retry: true, kind: 'connection' };
  const s = err && err.status;
  if (s === 429) return { retry: true, kind: 'rate_limit' };
  if (s >= 500) return { retry: true, kind: 'server_error' };
  return { retry: false, kind: s ? `http_${s}` : 'unknown' };
}

// One model call with the retry policy. meta = { repair: boolean } is only used for the cost log.
async function callModel(messages, meta = {}) {
  const cfg = getConfig();
  const client = makeClient();
  let last;
  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    const t0 = Date.now();
    try {
      const res = await client.chat.completions.create({
        model: cfg.model,
        messages,
        temperature: 0,
      });
      logCall({
        prompt_version: cfg.promptVersion,
        model: cfg.model,
        input_tokens: res.usage?.prompt_tokens ?? null,
        output_tokens: res.usage?.completion_tokens ?? null,
        duration_ms: Date.now() - t0,
        repair: !!meta.repair,
        attempt,
        outcome: 'ok',
      });
      return res.choices?.[0]?.message?.content ?? '';
    } catch (err) {
      last = classify(err);
      logCall({
        prompt_version: cfg.promptVersion,
        model: cfg.model,
        duration_ms: Date.now() - t0,
        repair: !!meta.repair,
        attempt,
        outcome: last.kind,
        will_retry: last.retry && attempt < cfg.maxAttempts,
      });
      if (!last.retry || attempt === cfg.maxAttempts) {
        if (last.kind === 'timeout') throw new LlmError(504, `The model did not answer within ${cfg.timeoutMs / 1000}s.`, 'timeout');
        if (err.status === 401 || err.status === 403) throw new LlmError(502, 'The model provider rejected our credentials (check LLM_API_KEY).', 'auth');
        if (err.status === 400) throw new LlmError(502, 'The model provider rejected the request (check LLM_MODEL and base URL).', 'bad_request');
        throw new LlmError(502, 'The model provider is unavailable. Try again later.', last.kind);
      }
      // exponential backoff with jitter: 1s, 2s, 4s... plus up to 250ms; obey Retry-After when present
      const wait = retryAfterMs(err.headers) ?? cfg.retryBaseMs * 2 ** (attempt - 1) + Math.random() * 250;
      await sleep(wait);
    }
  }
}

module.exports = { callModel, LlmError, retryAfterMs, classify };
