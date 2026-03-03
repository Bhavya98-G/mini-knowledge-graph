# 🔗 Mini Knowledge Graph

An AI-powered web application that transforms a set of documents into an interactive, explorable **knowledge graph**. Upload your files, and the app automatically extracts entities and relationships using a large language model, then renders them as a live force-directed graph you can browse, edit, and curate.

---

## Table of Contents

- [How to Run](#how-to-run)
  - [Option A – Docker Compose (Recommended)](#option-a--docker-compose-recommended)
  - [Option B – Local Development (Manual)](#option-b--local-development-manual)
- [Project Structure](#project-structure)
- [What Is Done](#what-is-done)
  - [Backend](#backend)
  - [Frontend](#frontend)
- [What Is NOT Done (Future Work)](#what-is-not-done-future-work)
- [Tech Stack](#tech-stack)
- [Environment Variables](#environment-variables)

---

## How to Run

### Prerequisites

| Tool | Version |
|------|---------|
| Docker + Docker Compose | any recent |
| Node.js | ≥ 18 |
| Python | ≥ 3.11 |
| `uv` (Python package manager) | latest |
| A **Groq API key** | [get one free](https://console.groq.com) |

---

### Option A – Docker Compose (Recommended)

This starts PostgreSQL, the FastAPI backend, and the Vite/Nginx frontend all together.

```bash
# 1. Clone the repository
git clone <repo-url>
cd "mini knowledge graph"

# 2. Set your Groq API key in the root .env file
echo "GROQ_API_KEY=gsk_..." > .env

# 3. Build and start all services
docker compose up --build

# 4. Open the app
#    Frontend  →  http://localhost
#    API docs  →  http://localhost:8000/docs
```

To stop:
```bash
docker compose down          # keeps data volume
docker compose down -v       # also wipes the database
```

---

### Option B – Local Development (Manual)

#### 1. Start PostgreSQL

You need a running PostgreSQL instance. The default connection string is:
```
postgresql://postgres:postgres@localhost:5432/knowledgegraph
```
You can override it with the `DATABASE_URL` environment variable.

#### 2. Backend

```bash
cd backend

# The environment file is at the root level (.env.example). 
# Make sure your root .env is configured with GROQ_API_KEY, DATABASE_URL, and SECRET_KEY
# If you haven't yet, copy the root example file:
# cp ../.env.example ../.env

# Install dependencies with uv
uv sync

# Run the API server (auto-creates tables on first start)
uv run uvicorn main:app --reload --port 8000
```

API will be available at `http://localhost:8000`.  
Interactive Swagger docs: `http://localhost:8000/docs`

#### 3. Frontend

```bash
cd frontend

npm install
npm run dev
```

Frontend will be available at `http://localhost:5173`, with `/api` proxied automatically to the backend.

---

## Project Structure

```
mini knowledge graph/
├── backend/
│   ├── app/
│   │   ├── api/             # API routes (auth, entities, health, relationships, workspace)
│   │   ├── auth/            # JWT bearer, password hashing, and login/register services
│   │   ├── core/            # Config and database setup
│   │   ├── models/          # SQLAlchemy SQL models
│   │   ├── schemas/         # Pydantic validation models
│   │   ├── utils/           # Helper functions
│   │   └── worker/          # LangChain/Groq LLM extraction logic
│   ├── main.py              # FastAPI app setup, CORS, lifespan
│   ├── Dockerfile
│   └── pyproject.toml
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Routing shell (Dashboard | GraphView | Status | Help)
│   │   ├── api.js           # Axios wrappers for every backend endpoint
│   │   ├── index.css        # Full design system (dark theme, tokens, components)
│   │   └── pages/
│   │       ├── Dashboard.jsx      # File upload, workspace list cards
│   │       ├── GraphView.jsx      # Interactive force graph + sidebar
│   │       ├── StatusPage.jsx     # Health check and global stats
│   │       ├── HelpPage.jsx       # User guide
│   │       ├── Login.jsx          # Login form
│   │       ├── Register.jsx       # Registration form
│   │       └── ForgotPassword.jsx # Password reset form
│   ├── vite.config.js
│   └── package.json
│
├── docker-compose.yml
└── .env                      # Root env file (GROQ_API_KEY)
```

---

## What Is Done

### Backend

| Feature | Detail |
|--------|--------|
| **Authentication & Authorization** | Full JWT-based user authentication system with secure BCrypt password hashing. Protected endpoints demand a Bearer token. Includes Registration, Login, and Forgot/Reset Password workflows. |
| **Document ingestion** | Accepts 3–10 files per workspace (PDF, TXT, MD, CSV). PDFs parsed with `pdfplumber`; text files decoded as UTF-8. |
| **LLM extraction** | Uses `langchain-groq` with `llama-3.3-70b-versatile`. Text is chunked (~2 000 chars, sentence-aware) and each chunk is sent to the LLM in JSON mode to extract `entities` and `relationships`. |
| **Entity normalization** | Strips honorifics and articles (`Mr.`, `The`, `Dr.`, etc.); deduplicates across chunks by `(normalized_name, type)`. |
| **Relationship deduplication** | Drops self-referencing, cross-entity type mismatches, and duplicate `(source, target, type)` triples at extraction time and again after merge. |
| **Workspace lifecycle** | Max 5 workspaces; the oldest is auto-evicted when the cap is reached. |
| **AI workspace naming** | After extraction, a second LLM call generates a concise 2–5 word name (≤ 32 chars) summarizing the corpus. |
| **Full CRUD on entities** | Create, read, update (name + type), delete (cascades relationships & snippets). Duplicate-name guard returns HTTP 409. |
| **Full CRUD on relationships** | Create (with duplicate guard), delete. |
| **Entity merge** | Reassigns all relationships and snippets from `merge_id` to `keep_id`, removes self-loops and duplicate edges, then deletes the merged entity. |
| **Entity search** | Case-insensitive `ilike` filter on `/workspaces/{id}/entities?search=...`. |
| **Snippets** | Every extracted entity or relationship is linked back to the sentence it came from and the source document. |
| **Async API** | All route handlers are `async def`. The blocking Groq call runs in a `ThreadPoolExecutor` via `asyncio.run_in_executor`, keeping the event loop free for concurrent requests. |
| **Health & Stats endpoints** | `/api/health` pings the DB and Groq; `/api/stats` returns global counts. |
| **Retry logic** | LLM calls retry up to 3 times with exponential back-off on JSON decode errors or network failures. |
| **Database** | PostgreSQL with SQLAlchemy 2.0. Connection pool (`size=5`, `max_overflow=10`, `pool_recycle=300`). All FK cascades set to `DELETE`. Tables auto-created on startup. |

### Frontend

| Feature | Detail |
|--------|--------|
| **Authentication UI** | Dedicated pages for Login, Registration, and Forgot Password with strict client-side password validation (uppercase, lowercase, number, special char, min length 8) and smooth routing integration. |
| **Dashboard** | Drag-and-drop or click-to-browse file upload. Live file list with size display and remove button. Validation (min 3, max 10 files). |
| **AI loading overlay** | Full-screen animated overlay with rotating "reasoning" messages and a progress bar during upload + LLM processing. |
| **Workspace cards** | Show AI-generated name, creation date, and counts (documents / entities / relationships). Click to open the graph. |
| **Rename workspace** | Inline editable name on both the dashboard and the graph view. |
| **Delete workspace** | Confirmation dialog → soft delete with cascade. |
| **Force-directed graph** | Rendered with `react-force-graph-2d`. Custom canvas paint for nodes (sized by connection count), edges (with directional arrows), and edge labels (visible at zoom > 0.8×). |
| **Search / highlight** | Live entity search dims non-matching nodes and edges. Match count shown. |
| **Node click → sidebar** | Opens a detail panel: entity name, type, all source snippets, and relationship list. |
| **Edit entity** | In-sidebar form to change name or type (with dropdown + free-text "Custom" option). 409 conflicts surfaced as toast errors. |
| **Delete entity** | Confirmation dialog; graph updates in-place without reload. |
| **Merge entities** | Shift-click two nodes → "Merge" button. Keeps first-clicked entity, reassigns all connections. |
| **Create relationship** | Ctrl-click two nodes → type a relationship label → button creates the edge. |
| **Add entity** | "+ Entity" toolbar button opens a form bar; pressing Enter submits. If entity already exists, graph pans/zooms to it. |
| **Workspace rename (graph)** | Click the workspace title in the graph header to edit inline. |
| **Zoom controls** | +/− and center/fit buttons. D3 force parameters configured for stable layouts. |
| **Status page** | Live health check (DB + Groq) with visual indicators; global stats table. |
| **Help / Guide page** | Full in-app documentation covering all gestures, keyboard shortcuts, and workflows. |
| **Toast notifications** | Success / error / info toasts auto-dismiss after 3.5 s. |
| **Responsive layout** | Graph canvas resizes with the browser window. |

---

## What Is NOT Done (Future Work)

### Security & Auth
- **Input sanitisation / rate limiting** – No request-level rate limiting on the upload endpoint; a single user can exhaust LLM quota rapidly.

### Backend Performance
- **Task queue (worker-based ingestion)** – File processing is currently synchronous within a single request. For large corpora the HTTP timeout can be hit before extraction finishes. The right fix is a task queue (e.g. **Celery + Redis** or **ARQ**): the upload endpoint enqueues a job and immediately returns a job ID; the client polls a `/jobs/{id}/status` endpoint for progress.
- **Parallel per-chunk extraction** – Chunks for a single document are processed sequentially. They could be dispatched concurrently with `asyncio.gather`, subject to Groq rate limits.
- **Database migrations** – There is no Alembic migration history. Schema changes require a manual `Base.metadata.create_all`. Alembic is already listed as a dependency but migrations have not been authored.
- **Pagination** – `/api/workspaces` is hard-limited to 5. Entity lists have no pagination, so very large graphs return the full list in one response.

### Frontend UX
- **Workspace list improvements** – The dashboard workspace cards could show a mini graph thumbnail preview, tags/categories, and last-accessed timestamps. A search/filter bar over the workspace list would help when approaching the 5-workspace cap.
- **Smoother graph physics** – The force simulation settles acceptably but can still produce overlapping nodes on dense graphs. Better results are achievable with:
  - A `d3-force` collision radius that scales with node size.
  - Hierarchical / clustered layout modes (e.g. group nodes by entity type).
  - Animated edge updates instead of a full graph redraw on every mutation.
- **Graph export** – No way to download the graph as an image (PNG/SVG) or as structured data (JSON/CSV).
- **Undo / Redo** – Destructive actions (delete entity, merge) cannot be reversed.
- **Multi-selection** – Only two nodes can be picked for merge/connect at a time; bulk operations are unsupported.
- **WebSocket / SSE progress** – During LLM extraction, the frontend shows cycling messages without real server-side progress. A WebSocket or Server-Sent Events channel would let the server stream per-chunk progress to the client.
- **Mobile layout** – The graph view is usable on tablets but not on small phones.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **LLM** | Groq Cloud – `llama-3.3-70b-versatile` via `langchain-groq` |
| **Backend** | Python 3.12, FastAPI, Uvicorn, SQLAlchemy 2.0 |
| **Database** | PostgreSQL 16 |
| **PDF parsing** | `pdfplumber` |
| **Frontend** | React 18, Vite 5, `react-force-graph-2d` (D3 v7 under the hood) |
| **HTTP client** | Axios |
| **Routing** | React Router v6 |
| **Containerisation** | Docker, Docker Compose, Nginx (frontend reverse proxy) |
| **Package management** | `uv` (backend), `npm` (frontend) |

---

## Environment Variables

### Root `.env`

The main environment configuration should be placed at the project root `.env`:

```
GROQ_API_KEY=gsk_...
SECRET_KEY=your-secret-key-here

```

An example file is provided at the root folder: `.env.example`.
