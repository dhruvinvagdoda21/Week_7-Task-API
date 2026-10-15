# Build order (commit after each stage, in your own words)
| Stage | Add to server.js | Checkpoint | Commit message |
|---|---|---|---|
| 0 | express(), app.listen, one GET / "hello" route | curl -i localhost:3000/ -> 200 | Stage 0: hello server |
| 1 | Real GET / JSON and GET /health | both return JSON | Stage 1: root and health endpoints |
| 2 | tasks array, GET /tasks, GET /tasks/:id with 404 | /tasks/1 -> 200, /tasks/99 -> 404 | Stage 2: read endpoints with 404 |
| 3 | express.json(), POST /tasks with 201 and 400 | POST ok -> 201, {} -> 400 | Stage 3: create with validation |
| 4 | PUT and DELETE (200, 204, 400, 404) | full create/update/delete cycle | Stage 4: full CRUD |
| 5 | openapi.json and swagger-ui-express at /docs | Try it out works | Stage 5: Swagger UI |
| 6 | README, push to a public repo | stranger can run it in 5 min | Stage 6: publish and docs |

# Week 7 (A17): commit after each stage, in your own words
| Stage | Files that belong to it | Checkpoint | Commit message |
|---|---|---|---|
| 0 | JOB-CARD.md, .env.example, .gitignore, src/llm/hello.js, src/llm/client.js, src/llm/config.js | `npm run hello` prints a word containing "ready"; `git status` does not list .env | Stage 0: job card, provider working, key in .env |
| 1 | src/routes/triage.js, src/llm/schema.js, stub branch in src/llm/triage.js, server.js wiring, README curls | LLM_STUB=1: valid curl 200, broken curl 400 naming the field | Stage 1: endpoint, input validation, output schema, stub mode |
| 2 | prompts/triage-v1.md, prompt loading and model call in src/llm/triage.js, src/llm/call.js (basic call) | three real inputs give real answers | Stage 2: prompt v1 as a versioned file, wired to the endpoint |
| 3 | src/llm/parse.js, repair and quarantine in triage.js, src/llm/log.js | bad enum in the prompt gives 422 plus a quarantine line | Stage 3: parse, validate, repair once, quarantine on failure |
| 4 | retry policy, timeout and cost log in src/llm/call.js, kill switch, test/ | LLM_ENABLED=false answers instantly; wrong key fails fast with no retries | Stage 4: timeout, retry policy, cost logging, kill switch |
| 5 | evals/, README with a REAL score | `npm run eval` gives a score you wrote into the README | Stage 5: eval set, results, README, published |

Tip: the finished code has all stages merged. To commit honestly stage by stage, build each file in order, or at minimum read each one and run its checkpoint before committing it.
