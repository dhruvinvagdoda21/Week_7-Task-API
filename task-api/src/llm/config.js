// Read settings at call time so tests (and a kill switch) can change them without a restart.
const num = (v, d) => (Number.isFinite(Number(v)) && v !== undefined && v !== '' ? Number(v) : d);

module.exports = () => ({
  baseURL: process.env.LLM_BASE_URL,
  apiKey: process.env.LLM_API_KEY,
  model: process.env.LLM_MODEL,
  stub: process.env.LLM_STUB === '1',
  enabled: process.env.LLM_ENABLED !== 'false',
  timeoutMs: num(process.env.LLM_TIMEOUT_MS, 30000), // explicit: the SDK default is 10 minutes
  maxAttempts: num(process.env.LLM_MAX_ATTEMPTS, 3), // 1 try + 2 retries, our own logic
  retryBaseMs: num(process.env.LLM_RETRY_BASE_MS, 1000),
  promptVersion: process.env.PROMPT_VERSION || 'v1',
});
