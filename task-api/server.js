const express = require('express');
const swaggerUi = require('swagger-ui-express');
const openapi = require('./openapi.json');
const triageRouter = require('./src/routes/triage');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

// ---- Stage 2: in-memory "database" (gone when the server stops) ----
let tasks = [
  { id: 1, title: 'Learn Express', done: false },
  { id: 2, title: 'Build a CRUD API', done: false },
  { id: 3, title: 'Push to GitHub', done: false },
];
let nextId = 4;

const isBlank = (v) => typeof v !== 'string' || v.trim() === '';
const findTask = (req) => tasks.find((t) => t.id === Number(req.params.id));
const notFound = (req, res) => res.status(404).json({ error: `Task ${req.params.id} not found` });

// ---- Stage 1: root and health ----
app.get('/', (req, res) =>
  res.json({ name: 'Task API', version: '1.0', endpoints: ['/tasks'] })
);
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ---- Stage 2: read ----
app.get('/tasks', (req, res) => res.json(tasks));

// ---- Week 7: LLM triage endpoint (POST /tasks/triage) ----
app.use('/tasks/triage', triageRouter);

app.get('/tasks/:id', (req, res) => {
  const task = findTask(req);
  if (!task) return notFound(req, res);
  res.json(task);
});

// ---- Stage 3: create ----
app.post('/tasks', (req, res) => {
  const { title } = req.body || {};
  if (isBlank(title)) {
    return res.status(400).json({ error: 'title is required and must be a non-empty string' });
  }
  const task = { id: nextId++, title: title.trim(), done: false };
  tasks.push(task);
  res.status(201).json(task);
});

// ---- Stage 4: update and delete ----
app.put('/tasks/:id', (req, res) => {
  const task = findTask(req);
  if (!task) return notFound(req, res);
  const { title, done } = req.body || {};
  if (title === undefined && done === undefined) {
    return res.status(400).json({ error: 'send title and/or done in the request body' });
  }
  if (title !== undefined && isBlank(title)) {
    return res.status(400).json({ error: 'title must be a non-empty string' });
  }
  if (done !== undefined && typeof done !== 'boolean') {
    return res.status(400).json({ error: 'done must be true or false' });
  }
  if (title !== undefined) task.title = title.trim();
  if (done !== undefined) task.done = done;
  res.json(task);
});

app.delete('/tasks/:id', (req, res) => {
  const task = findTask(req);
  if (!task) return notFound(req, res);
  tasks = tasks.filter((t) => t.id !== task.id);
  res.status(204).end();
});

// ---- Stage 5: Swagger UI ----
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

// Broken JSON in a request body -> 400 instead of an HTML error page
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid JSON body' });
  res.status(500).json({ error: 'internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Task API running on http://localhost:${PORT}`));
}

module.exports = app;
