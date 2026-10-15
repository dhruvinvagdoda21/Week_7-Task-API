const OpenAIModule = require('openai');
const OpenAI = OpenAIModule.default || OpenAIModule;
const getConfig = require('./config');

// maxRetries: 0 on purpose. The SDK retries twice by default; we do our own retries in call.js
// so the policy is visible, logged, and never retries 400/401/403.
function makeClient() {
  const c = getConfig();
  return new OpenAI({
    baseURL: c.baseURL,
    apiKey: c.apiKey || 'missing',
    timeout: c.timeoutMs,
    maxRetries: 0,
  });
}

module.exports = { makeClient };
