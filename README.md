# Best Shopping Assistant

An AI shopping assistant that turns a plain-language request ("waterproof hiking shoes
under $200") into a short list of real, currently available products with an honest,
comparative recommendation.

The system is stateless and one-off by design: each request carries its own conversation
history, and there is no database. A FastAPI backend runs a small pipeline of three agents,
and a Next.js frontend provides the chat UI.

## How it works

Each call to `POST /recommend` runs through three agents in sequence:

1. **Planner Agent** (`backend/app/agents/planner_agent.py`) — reads the conversation and
   extracts a structured query (category, product, brand, budget, purpose). If it can't
   perform a useful search yet, it asks a clarifying question instead of guessing. After
   10 clarifying exchanges with no resolution, the request is marked too ambiguous.
2. **Search Agent** (`backend/app/agents/search_agent.py`) — uses OpenAI's web search tool
   to find real, currently available products matching the structured query, then extracts
   them into a clean, structured list. Products outside budget (with some tolerance) are
   filtered out.
3. **Comparison Agent** (`backend/app/agents/comparison_agent.py`) — compares the candidate
   products against the user's stated purpose and budget, gives balanced pros/cons per
   product, and recommends exactly one.

The frontend (`frontend/app/page.tsx`) is a single-page chat UI that keeps conversations in
local storage, sends the full conversation on every message, and renders the returned
products and comparison.

## Project structure

```
backend/
  app/
    main.py                  # FastAPI app, /recommend endpoint
    agents/
      planner_agent.py
      search_agent.py
      comparison_agent.py
  requirements.txt
  Dockerfile
frontend/
  app/
    page.tsx                 # chat UI
    layout.tsx
  package.json
  Dockerfile
docker-compose.yml
docker-compose.override.yml   # local dev: backend live-reload
```

## Running locally

### Option 1: Docker (recommended)

Create `backend/.env` with your OpenAI API key:

```
OPENAI_API_KEY=sk-...
```

Then from the repo root:

```bash
docker compose up -d
```

This builds and starts both services:

- Backend at `http://127.0.0.1:8000` (docs at `/docs`)
- Frontend at `http://127.0.0.1:3000`

`docker-compose.override.yml` is applied automatically and gives the backend
live-reload — edits under `backend/` take effect immediately, no rebuild needed.
The frontend is a static production build, so after changing frontend code, rebuild it:

```bash
docker compose up -d --build frontend
```

Other useful commands:

```bash
docker compose ps        # check container status
docker compose logs -f   # tail logs from both services
docker compose down      # stop and remove both containers
```

### Option 2: Run without Docker

**Backend:**

```bash
cd backend
pip install -r requirements.txt
```

Create `backend/.env` with your OpenAI API key:

```
OPENAI_API_KEY=sk-...
```

Then start the API:

```bash
python -m uvicorn app.main:app --reload
```

The API is served at `http://127.0.0.1:8000` (docs at `/docs`).

**Frontend:**

```bash
cd frontend
npm install
```

Create `frontend/.env.local` (see `.env.local.example`):

```
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Then start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API

### `POST /recommend`

Request:

```json
{
  "message": "waterproof hiking shoes under $200",
  "conversation": []
}
```

Response:

```json
{
  "status": "ready | needs_clarification | invalid",
  "message": "string",
  "conversation": [{ "role": "user | assistant", "content": "string" }],
  "products": [],
  "comparison": null
}
```

`products` and `comparison` are only populated once `status` is `"ready"`.
