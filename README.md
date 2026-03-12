# SIGMA

SIGMA is a founder-facing knowledge assistant with a simple multi-tenant RAG workflow. Each founder gets a private knowledge base, uploads internal files, and chats with Horo to get short answers grounded in their own documents.

## What this prototype demonstrates

- **Private founder knowledge bases**
  - Documents, chat threads, and retrieval are scoped to the authenticated founder.
  - Other tenants' files are never searched.

- **Source-backed answers**
  - Horo answers from uploaded files and shows quick citations such as `Loan Policy, p. 3`.
  - Citations are rendered inline and can be inspected in the response UI.

- **Helpful failure mode**
  - If the answer is not supported by the founder's files, Horo should say it does not know and guide the founder to upload the right file.

- **Simple file upload flow**
  - Uploaded files are parsed, chunked, embedded, and stored for retrieval.
  - Chat answers are generated from the most relevant chunks for the active founder.

## Product brief

Founders keep important information in files such as pitch decks, policies, handbooks, and finance sheets. On SIGMA, each founder has a private knowledge base. Horo answers questions from the founder's own files, cites supporting pages, and avoids fabricating unsupported answers.

Example behaviors:

- **Loan policy question**
  - “What’s the maximum loan size for first-time borrowers?”
  - Horo answers and cites `Loan Policy (p. X)`.

- **Operational handbook question**
  - “List the onboarding steps for our program.”
  - Horo answers with multiple references to `Program Handbook` pages.

- **Missing information question**
  - “What’s our CAC?”
  - If the file is missing, Horo responds with an `I don’t know` style answer and suggests uploading the relevant finance or growth document.

## RAG approach

This prototype keeps retrieval simple, explainable, and tenant-scoped.

### Retrieval pipeline

1. **Upload → parse → chunk**
   - Documents are parsed, split with overlap, and tagged with document title + page.

2. **Embed + store**
   - Chunks are embedded and stored in Postgres with `pgvector`, keyed by `user_id`.

3. **Query-time retrieve**
   - Semantic search runs only over chunks belonging to the authenticated founder.
   - Top-k results (configurable) are returned with their metadata.

4. **Grounded generation**
   - Retrieved chunks are provided to the model; the assistant is expected to answer concisely and stay within evidence.

### Citations and provenance

- Inline markers like `[1]` map to document title, excerpt, and optional page.
- The UI renders inline markers plus a sources popover so founders can inspect evidence quickly.
- If evidence is weak or missing, the assistant should say it doesn’t know and prompt for the right file.

### Isolation and safety

- Retrieval, documents, and chat threads are filtered by `user_id`.
- Cross-tenant retrieval is disallowed by design; other tenants’ files are never searched.

## Demo authentication

The prototype includes simple JWT-based demo authentication to show tenant isolation with two founders:

- **Acme**
  - `founder@acme.io` / `acme-demo`

- **Nova**
  - `founder@nova.io` / `nova-demo`

Switching users shows that uploaded files, retrieval, and chat history remain private to each founder.

## Stack

- **Frontend**
  - Next.js
  - React
  - TanStack Query

- **Backend**
  - FastAPI
  - SQLAlchemy
  - Postgres
  - pgvector
  - LangChain
  - OpenAI models for chat and embeddings

## Local development

### Backend

From `backend/`:

```bash
uv sync
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Backend environment variables typically include:

- `DATABASE_URL`
- `OPENAI_API_KEY`
- `JWT_SECRET_KEY`
- `CORS_ORIGINS`

### Frontend

From `frontend/`:

```bash
pnpm install
pnpm dev
```

Set `NEXT_PUBLIC_API_BASE_URL` if the backend is not running at `http://localhost:8000/api`.

## Deliverable summary

This repo delivers:

- **A concise RAG prototype**
  - Founder-scoped retrieval over uploaded files

- **A functional chat and upload workflow**
  - Upload, retrieve, answer, and cite

- **A clear tenant isolation demo**
  - JWT auth with separate demo founders and isolated data
