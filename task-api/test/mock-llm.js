// A tiny fake OpenAI-compatible server so the pipeline can be tested with no key and no quota.
// It is a TEST DOUBLE: it proves retries, repair, quarantine, timeout and kill-switch logic.
// It says nothing about how good a real model is; that is what `npm run eval` is for.
const http = require('http');

const GOOD = { category: 'study', priority: 'high', confidence: 0.93, reason: 'Coursework with a deadline.' };
const completion = (content) => ({
  id: 'mock-1', object: 'chat.completion', created: 0, model: 'mock',
  choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 },
});

function startMock() {
  const state = { mode: 'good', calls: 0, bodies: [] };
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      state.calls++;
      state.bodies.push(JSON.parse(raw || '{}'));
      const n = state.calls;
      const send = (code, obj, headers = {}) => {
        res.writeHead(code, { 'Content-Type': 'application/json', ...headers });
        res.end(JSON.stringify(obj));
      };
      const ok = (text) => send(200, completion(text));
      switch (state.mode) {
        case 'good': return ok(JSON.stringify(GOOD));
        case 'fenced': return ok('Sure! Here is the JSON:\n```json\n' + JSON.stringify(GOOD) + '\n```');
        case 'bad_then_good': return ok(n === 1 ? JSON.stringify({ ...GOOD, category: 'hobby' }) : JSON.stringify(GOOD));
        case 'always_bad': return ok(JSON.stringify({ ...GOOD, category: 'hobby' }));
        case 'extra_field': return ok(JSON.stringify({ ...GOOD, secret: 'x' }));
        case 'not_json': return ok('I am sorry, I cannot help with that.');
        case 'slow': return setTimeout(() => ok(JSON.stringify(GOOD)), 3000);
        case 'rate_limit_then_good': return n <= 2 ? send(429, { error: { message: 'slow down' } }, { 'Retry-After': '0' }) : ok(JSON.stringify(GOOD));
        case 'always_500': return send(500, { error: { message: 'boom' } });
        case 'unauthorized': return send(401, { error: { message: 'bad key' } });
        default: return send(500, { error: { message: 'unknown mock mode' } });
      }
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, state, port: server.address().port })));
}

module.exports = { startMock };
