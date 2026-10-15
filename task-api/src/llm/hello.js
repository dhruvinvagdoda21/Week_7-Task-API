// Stage 0: prove you can get one word out of a model. Run: node --env-file=.env src/llm/hello.js
const { makeClient } = require('./client');
const getConfig = require('./config');

(async () => {
  const res = await makeClient().chat.completions.create({
    model: getConfig().model,
    messages: [{ role: 'user', content: 'Reply with exactly the word: ready' }],
  });
  console.log(res.choices[0].message.content);
})().catch((e) => {
  console.error('hello failed:', e.status || '', e.message);
  process.exit(1);
});
