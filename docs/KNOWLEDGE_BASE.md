# DocuMind Knowledge Base Transfer

Complete technical reference, architecture deep-dive, operational runbook, and decision log for anyone inheriting, maintaining, or extending the DocuMind platform.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Deep Dive](#2-architecture-deep-dive)
3. [Data Model](#3-data-model)
4. [Agent System (Google ADK)](#4-agent-system-google-adk)
5. [Ingestion Pipeline (AWS)](#5-ingestion-pipeline-aws)
6. [GCP Infrastructure](#6-gcp-infrastructure)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Security Model](#8-security-model)
9. [Operational Runbook](#9-operational-runbook)
10. [Decision Log](#10-decision-log)
11. [Extending the System](#11-extending-the-system)
12. [Known Limitations](#12-known-limitations)

---

## 1. System Overview

DocuMind is a multi-tenant, cross-cloud SaaS where users upload documents and interact with them through AI agent teams. The system spans two clouds:

- **AWS**: Document storage (S3), event-driven ingestion (EventBridge + Step Functions + Lambda).
- **GCP**: Document parsing (Document AI), vector embeddings and search (Vertex AI), agent runtime (ADK on Cloud Run), database (Cloud SQL).

The frontend is a Next.js 15 application deployed to Vercel (or any Node.js host), authenticated via Clerk.

### Why Two Clouds?

- AWS S3 + EventBridge + Step Functions provides a mature, event-driven upload pipeline with visual state machine debugging.
- GCP offers Document AI (best-in-class OCR/layout), Vertex AI Vector Search (managed vector DB), and Google ADK (native multi-agent framework for Gemini).
- Workload Identity Federation (WIF) eliminates long-lived cross-cloud keys.

---

## 2. Architecture Deep Dive

### Request Flow: Chat

```
1. Browser sends message via POST /api/chat (Clerk JWT in cookie)
2. Next.js route handler:
   a. Validates JWT → extracts orgId (workspace) and userId
   b. Rate-limit check (token bucket, 60/min per workspace)
   c. Input validation (UUID format, message length)
   d. Finds or creates Workspace row in Postgres
   e. Proxies request to ADK agent service: POST /run
3. ADK FastAPI service:
   a. Gets or creates ADK Session (keyed by conversation_id, stores workspace_id in state)
   b. Ensures Conversation row exists in Postgres (auto-titles from first message)
   c. Saves user message to Postgres
   d. Runs RootOrchestrator via Runner.run_async()
   e. Streams SSE events: agent_step, tool_call, text, citations, error, done
   f. On completion: saves assistant message + extracted citations to Postgres
   g. Flushes agent traces to Postgres
4. Next.js streams the SSE response body through to the browser
5. Browser EventSource parses events and renders incrementally
```

### Request Flow: Upload

```
1. Browser sends POST /api/uploads/presign (Clerk JWT)
2. Next.js route handler:
   a. Validates JWT → extracts orgId
   b. Rate-limit check (20/min per workspace)
   c. Validates filename (length, characters, no traversal), content type, size
   d. Generates document UUID and S3 key: {orgId}/{docId}/{sanitizedFilename}
   e. Creates presigned PUT URL (10 min expiry, ContentLength-bound)
   f. Ensures Workspace row exists
   g. Creates Document row with status=UPLOADING
   h. Returns { uploadUrl, documentId, s3Key }
3. Browser PUTs file directly to S3 using the presigned URL
4. S3 emits ObjectCreated event to EventBridge
5. EventBridge rule triggers Step Functions state machine
6. Step Functions pipeline:
   a. MarkProcessing: sets Document.status = PROCESSING, creates IngestionJob row
   b. CallDocumentAI: sends file to GCP Document AI via WIF, gets layout/OCR output
   c. ChunkAndEmbed: semantic chunking (800-1200 chars, 100 overlap) + Vertex AI embeddings
   d. UpsertVectors: writes vectors to Vertex Vector Search with namespace=workspace_id
   e. MarkReady: sets Document.status = READY
   f. On any error → MarkFailed: sets status = FAILED with error message
```

### Streaming Architecture

The SSE streaming chain has three segments:

```
ADK Runner (async generator) → FastAPI StreamingResponse → Next.js Response passthrough → Browser EventSource
```

Each agent step emits events as the LLM generates tokens. The `TraceCollector` records timing for each step. On stream completion, citations are extracted via regex from the full text and emitted as a final `citations` event.

---

## 3. Data Model

### Prisma Schema (9 Models)

```
Workspace (1) ──< Document (N)
Workspace (1) ──< Chunk (N)
Workspace (1) ──< Conversation (N)
Workspace (1) ──< WorkspaceMember (N) >── User (1)
Document (1) ──< Chunk (N)
Document (1) ──< IngestionJob (N)
Conversation (1) ──< Message (N)
Message (1) ──< AgentTrace (N)
User (1) ──< Conversation (N)
```

### Key Design Decisions

**Workspace as isolation boundary**: Every data table either has a direct `workspace_id` column or joins to one through its parent chain. This enables both application-level filtering and database-level RLS.

**Document status as enum**: `UPLOADING | PROCESSING | READY | FAILED`. The frontend polls status via `GET /api/documents/[id]`. No WebSocket needed for MVP -- polling at 5-second intervals is sufficient.

**Citations as JSON column**: Messages store citations as a `Json?` column rather than a separate table. This simplifies queries and matches the append-only nature of chat messages. Schema:

```json
[
  { "page": 3, "section": "Revenue", "filename": "Q3-Report.pdf" },
  { "page": 7, "section": "Risks", "filename": "Q3-Report.pdf" }
]
```

**Agent traces as structured records**: Each agent step (retrieval, analysis, writing, critique, tool calls) is a separate `AgentTrace` row with JSON `input` and `output` columns. This enables the admin dashboard trace explorer and latency analysis.

### Database Indexes

```sql
documents:   (workspace_id, status)
chunks:      (workspace_id), (document_id)
conversations: (workspace_id)
messages:    (conversation_id)
agent_traces: (message_id)
ingestion_jobs: (document_id)
```

### Row-Level Security

RLS policies use `current_setting('app.current_workspace_id', true)` to scope queries. The `withWorkspaceRls()` helper in `packages/db/src/index.ts` wraps Prisma operations in a transaction that sets this variable:

```typescript
export async function withWorkspaceRls<T>(
  workspaceId: string,
  fn: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_workspace_id = '${workspaceId}'`
    );
    return fn(tx as unknown as PrismaClient);
  });
}
```

Tables with indirect workspace relationships use subqueries:
- `messages` → joins through `conversations.workspace_id`
- `agent_traces` → joins through `messages` → `conversations.workspace_id`
- `ingestion_jobs` → joins through `documents.workspace_id`

---

## 4. Agent System (Google ADK)

### Framework: Google ADK

DocuMind uses the [Google Agent Development Kit](https://adk.dev) (version 1.2.0+). Key ADK constructs used:

| Construct | Usage |
|-----------|-------|
| `LlmAgent` | Every individual agent (Retriever, Writer, Critic, PM, Coder, etc.) |
| `SequentialAgent` | Pipelines: RagTeam, SweTeam |
| `LoopAgent` | Writer-Critic loop (max 2 iterations), Coder-Reviewer loop (max 2 iterations) |
| `AgentTool` | Wraps RagTeam so SweTeam's Architect can call it as a tool |
| `FunctionTool` | Wraps Python functions as agent tools (vector_search, fetch_chunk, classify_intent, etc.) |
| `Runner` | Executes the agent graph, yields streaming events |
| `InMemorySessionService` | Manages ADK sessions keyed by conversation_id |

### Agent Graph

```
RootOrchestrator (LlmAgent)
├── classify_intent (FunctionTool) -- deterministic routing signal
├── RagTeam (SequentialAgent)
│   ├── Retriever (LlmAgent) -- vector_search, list_workspace_documents tools
│   ├── Analyzer (LlmAgent) -- fetch_chunk, get_document_metadata tools
│   └── WriterCriticLoop (LoopAgent, max_iterations=2)
│       ├── Writer (LlmAgent)
│       └── Critic (LlmAgent)
└── SweTeam (SequentialAgent)
    ├── PM (LlmAgent)
    ├── Architect (LlmAgent) -- rag_tool (AgentTool wrapping RagTeam)
    ├── CoderReviewerLoop (LoopAgent, max_iterations=2)
    │   ├── Coder (LlmAgent)
    │   └── Reviewer (LlmAgent)
    └── QA (LlmAgent)
```

### Session State Keys

Agents communicate through ADK session state (dict-like store per conversation):

| Key | Set By | Read By | Type |
|-----|--------|---------|------|
| `workspace_id` | Session init | All agents (via tools) | `str` |
| `retrieved_chunks` | Retriever | Analyzer | `list[dict]` |
| `analyzed_facts` | Analyzer | Writer, Critic | `list[dict]` |
| `draft_answer` | Writer | Critic | `str` |
| `draft_citations` | Writer | Critic | `list[dict]` |
| `critic_approved` | Critic | LoopAgent (termination) | `"true" \| "false"` |
| `critic_feedback` | Critic | Writer (revision) | `str` |
| `user_stories` | PM | Architect, QA | `str` |
| `architecture_design` | Architect | Coder | `str` |
| `code_artifacts` | Coder | Reviewer, QA | `str` |
| `review_approved` | Reviewer | LoopAgent (termination) | `"true" \| "false"` |
| `review_feedback` | Reviewer | Coder (revision) | `str` |
| `test_plan` | QA | (final output) | `str` |

### Intent Classifier

The intent classifier (`tools/intent.py`) is deterministic (no LLM call). It uses keyword matching and regex patterns:

- **SWE keywords** (33): build, create, implement, code, architect, schema, etc.
- **SWE patterns** (4 regexes): "build/create/implement ... app/api/service", "design ... system/architecture", etc.
- **RAG keywords** (27): what does, explain, summarize, compare, according to, in the document, etc.
- **Greeting patterns** (3 regexes): hi/hello/hey, thanks, what can you do.

**Scoring**: keyword match = +1, pattern match = +3. SWE needs score >= 2 and > RAG score. Questions (ending with `?`) get +1 RAG score. Default (no matches) routes to RAG with 0.5 confidence.

The LLM in RootOrchestrator can override the classifier based on conversation context.

### Tools

All tools are defined as Python functions wrapped with `FunctionTool`:

| Tool | File | Used By | Description |
|------|------|---------|-------------|
| `classify_intent` | `tools/intent.py` | RootOrchestrator | Deterministic intent routing signal |
| `vector_search` | `tools/vector_search.py` | Retriever | Queries Vertex AI Vector Search |
| `list_workspace_documents` | `tools/postgres.py` | Retriever | Lists documents in a workspace |
| `get_document_metadata` | `tools/postgres.py` | Analyzer | Gets document details by ID |
| `fetch_chunk` | `tools/postgres.py` | Analyzer | Gets full chunk text by ID |

### Tracing

The `TraceCollector` (in `tracing.py`) records each agent step's start/end time:

```python
trace_collector.start_step("Retriever", "respond")
# ... agent runs ...
trace_collector.end_step("Retriever", "respond")
trace_collector.start_step("Retriever", "tool:vector_search")
# ... tool call ...
trace_collector.end_step("Retriever", "tool:vector_search")
```

On stream completion, `trace_collector.flush()` writes all trace entries to the `agent_traces` table in Postgres with latency_ms calculated.

### LLM Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `LLM_MODEL` | `gemini-2.0-flash` | Model for all agents |
| `EMBEDDING_MODEL` | `text-embedding-005` | Model for chunk embeddings |
| `EMBEDDING_DIMENSIONS` | `768` | Vector dimensionality (immutable once index is created) |
| `MAX_CRITIC_REVISIONS` | `2` | Max Writer-Critic loop iterations |
| `MAX_CODE_REVIEW_ROUNDS` | `2` | Max Coder-Reviewer loop iterations |

---

## 5. Ingestion Pipeline (AWS)

### CDK Stack: `IngestionStack`

Defined in `infra/aws/lib/ingestion-stack.ts`. Provisions:

- **S3 Bucket** (`documind-uploads-{account_id}`): encrypted (S3-managed), all public access blocked, CORS for PUT, EventBridge notifications enabled.
- **6 Lambda Functions** (Node.js 22, esbuild-bundled):
  - `mark_processing`: Updates document status, creates ingestion job.
  - `call_document_ai`: Calls GCP Document AI via WIF for OCR/layout.
  - `chunk_and_embed`: Semantic chunking + Vertex AI embedding.
  - `upsert_vectors`: Writes vectors to Vertex Vector Search.
  - `mark_ready`: Marks document as ready.
  - `mark_failed`: Records error on failure.
- **Step Functions State Machine** (`DocuMindIngestDocument`): Linear pipeline with catch-all failure handler.
- **EventBridge Rule**: Triggers state machine on S3 `Object Created` events.

### Lambda Shared Utilities

Located in `infra/aws/lambdas/_shared/`:

| File | Purpose |
|------|---------|
| `gcp-auth.ts` | Exchanges AWS STS token for GCP access token via WIF. Caches the token. |
| `db.ts` | Postgres client using connection string from env var. |
| `document-ai.ts` | Helper for calling Document AI REST API with WIF token. |
| `vertex.ts` | Helper for Vertex AI embedding and Vector Search APIs. |
| `types.ts` | Shared type definitions for pipeline state. |

### WIF Token Exchange (AWS → GCP)

```
1. Lambda calls STS GetCallerIdentity to get its own ARN
2. Lambda calls STS AssumeRoleWithWebIdentity (self) to get an OIDC token
3. Lambda POSTs to GCP STS token endpoint with:
   - grant_type: urn:ietf:params:oauth:grant-type:token-exchange
   - audience: //iam.googleapis.com/projects/{number}/locations/global/workloadIdentityPools/{pool}/providers/{provider}
   - subject_token: the AWS OIDC token
4. GCP STS returns a federated access token
5. Lambda calls GCP IAM generateAccessToken to get a service account access token
6. Token is cached for its lifetime (typically 1 hour)
```

### Chunking Strategy

In `chunk_and_embed`:
- **Target chunk size**: 800-1200 characters.
- **Overlap**: 100 characters between chunks.
- **Splitting**: Prefers splitting on paragraph boundaries, then sentence boundaries, then word boundaries.
- **Metadata per chunk**: document_id, workspace_id, ordinal, page number, section heading.

### Error Handling

- Each Lambda step has `addCatch(markFailedTask)` so any failure routes to the error handler.
- Document AI and Vector Search calls have retry with exponential backoff (2-3 retries).
- The state machine has a 30-minute overall timeout.
- Failed documents show the error message in the admin dashboard.

---

## 6. GCP Infrastructure

### Terraform Resources (`infra/gcp/main.tf`)

| Resource | Name | Purpose |
|----------|------|---------|
| Cloud SQL (Postgres 16) | `documind-db` | Primary database (db-f1-micro for dev, scale up for prod) |
| Cloud Run v2 | `documind-agents` | Hosts the FastAPI/ADK agent service |
| Vertex AI Index | `documind-documents` | Vector search index (TreeAH, STREAM_UPDATE) |
| Vertex AI Index Endpoint | `documind-documents-endpoint` | Serving endpoint for the index |
| Document AI Processor | `documind-layout` | LAYOUT_PARSER_PROCESSOR for OCR/layout |
| WIF Pool | `documind-aws-pool` | Identity pool for AWS → GCP auth |
| WIF Provider | `documind-aws-provider` | AWS provider in the pool |
| Service Account (agent) | `documind-agent-svc` | Cloud Run identity (aiplatform.user + cloudsql.client) |
| Service Account (WIF) | `documind-aws-ingestion` | Lambda identity (documentai.apiUser + aiplatform.user) |

### Vector Search Index Configuration

- **Dimensions**: 768 (matches `text-embedding-005` output).
- **Algorithm**: TreeAH (Approximate Nearest Neighbors).
- **Shard size**: SMALL (suitable for MVP scale).
- **Update method**: STREAM_UPDATE (real-time upserts, no batch rebuild needed).
- **Namespace**: Each workspace's vectors are tagged with `namespace=workspace_id`. Queries filter by namespace for tenant isolation.

**Important**: Dimensions are immutable after index creation. If you change the embedding model, you must create a new index and re-embed all documents.

### Cloud Run Scaling

- **Min instances**: 0 (scales to zero when idle -- expect cold starts of 10-30s).
- **Max instances**: 10.
- **CPU**: 2 vCPU.
- **Memory**: 1 GiB.
- **Invoker**: `allUsers` (the Next.js BFF authenticates via Clerk; the agent service trusts the BFF).

For production, consider:
- Setting `min_instance_count = 1` to avoid cold starts.
- Adding Cloud Run authentication (IAM invoker role for the Next.js service account).
- Increasing memory for large document workloads.

---

## 7. Frontend Architecture

### Next.js App Router Layout

```
app/
├── layout.tsx              # Root: ClerkProvider + global styles
├── page.tsx                # Landing / sign-in redirect
├── global-error.tsx        # Root error boundary (inline styles, no CSS deps)
├── (app)/                  # Authenticated group
│   ├── layout.tsx          # Sidebar + main content area
│   ├── error.tsx           # App-level error boundary
│   ├── not-found.tsx       # 404 page
│   ├── dashboard/page.tsx  # Stats cards + quick actions
│   ├── chat/
│   │   ├── page.tsx        # New chat redirect
│   │   └── [conversationId]/page.tsx  # Chat interface
│   └── admin/page.tsx      # Admin dashboard (tabbed)
└── api/
    ├── health/route.ts     # Liveness check
    ├── chat/route.ts       # Chat proxy → ADK service
    ├── uploads/presign/route.ts  # S3 presigned URL generation
    ├── documents/          # Document listing + status
    ├── conversations/      # Conversation listing + messages
    └── admin/              # Admin stats, traces, jobs, conversations
```

### Key Components

| Component | File | Description |
|-----------|------|-------------|
| `ChatInterface` | `components/chat/chat-interface.tsx` | Main chat UI. Manages SSE stream, renders messages, shows agent step indicators. |
| `ChatMessage` | `components/chat/chat-message.tsx` | Renders a single message with markdown (headings, lists, bold, inline code) and fenced code blocks with language headers. |
| `AgentStepIndicator` | `components/chat/agent-step-indicator.tsx` | Shows which agent is active (e.g., "Retriever is searching...") with tool-specific labels. |
| `ConversationList` | `components/chat/conversation-list.tsx` | Sidebar list of past conversations. Polls every 15 seconds. |
| `FileUploadButton` | `components/chat/file-upload-button.tsx` | Upload button with presigned URL flow. |
| `Sidebar` | `components/sidebar.tsx` | Navigation sidebar. Shows conversation list when on chat pages. |
| `AdminDashboard` | `components/admin/admin-dashboard.tsx` | Tabbed admin view (overview, documents, jobs, traces, conversations). |

### SSE Parsing

The `ChatInterface` component connects to `/api/chat` via `fetch()` and reads the response body as a stream. It parses SSE events by tracking `currentEventType`:

```
event: agent_step     → update active agent indicator
event: tool_call      → show tool-specific label (e.g., "Searching vectors...")
event: text           → append token to message display
event: citations      → render citation chips below the message
event: error          → show error notification
event: done           → finalize message, re-enable input
```

### Middleware

`apps/web/middleware.ts` uses Clerk's `clerkMiddleware` to protect all routes except `/`, `/sign-in`, `/sign-up`, and `/api/health`.

---

## 8. Security Model

### Defense in Depth

```
Layer 1: Clerk JWT validation (middleware)
Layer 2: orgId extraction in each API route (no orgId = 403)
Layer 3: Prisma queries filter by workspace_id
Layer 4: PostgreSQL RLS policies (SET LOCAL + policy check)
```

### Threat Model Summary

| Threat | Mitigation |
|--------|-----------|
| Cross-workspace data access | RLS + application-level workspace_id filtering |
| Prompt injection via document content | Agent instructions explicitly forbid using info not in analyzed facts |
| Upload of malicious files | Content-type allowlist, size limit, filename sanitization, S3 isolation |
| Rate abuse | Token-bucket rate limiters per workspace |
| XSS via chat messages | React auto-escapes. CSP restricts script sources. |
| CSRF | Clerk session cookies with SameSite. CORS on S3. |
| Clickjacking | X-Frame-Options: DENY |
| Long-lived cross-cloud keys | WIF for AWS→GCP; no static credentials anywhere |

### Content Security Policy

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.com https://*.clerk.accounts.dev;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://*.clerk.com https://img.clerk.com;
font-src 'self';
connect-src 'self' https://*.clerk.com https://*.clerk.accounts.dev;
frame-src 'self' https://*.clerk.com https://*.clerk.accounts.dev;
worker-src 'self' blob:;
```

---

## 9. Operational Runbook

### Monitoring Checklist

| What | Where | Alert Threshold |
|------|-------|----------------|
| Agent service health | `GET /health` on Cloud Run URL | 5xx > 1% |
| SSE stream errors | Cloud Run logs, filter `event: error` | Any occurrence |
| Ingestion failures | Step Functions console, filter "FAILED" | Any occurrence |
| Document processing time | `agent_traces` table, filter step="tool:vector_search" | Avg > 10s |
| Database connections | Cloud SQL metrics | > 80 active connections |
| Vector Search latency | Vertex AI metrics | p99 > 500ms |
| Rate limit hits | Application logs, filter "429" | > 10/hour per workspace |

### Common Operations

#### Reprocess a failed document

```sql
-- 1. Find the document
SELECT id, filename, status, error FROM documents WHERE workspace_id = '<ws_id>' AND status = 'FAILED';

-- 2. Reset status to UPLOADING
UPDATE documents SET status = 'UPLOADING', error = NULL WHERE id = '<doc_id>';

-- 3. Delete any partial chunks
DELETE FROM chunks WHERE document_id = '<doc_id>';

-- 4. Re-trigger ingestion by re-uploading the same file to S3
-- (The EventBridge rule will pick it up automatically)
```

#### Check agent trace latency

```sql
SELECT agent_name, step, AVG(latency_ms) as avg_ms, MAX(latency_ms) as max_ms, COUNT(*) as count
FROM agent_traces
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY agent_name, step
ORDER BY avg_ms DESC;
```

#### Check workspace isolation (RLS test)

```sql
-- Set workspace context
SET LOCAL app.current_workspace_id = 'workspace-a-id';

-- This should only return workspace A's documents
SELECT * FROM documents;

-- This should return zero rows (workspace B's data is invisible)
-- even if you know a document ID from workspace B
SELECT * FROM documents WHERE id = 'known-workspace-b-doc-id';
```

#### Scale Cloud Run for production

```bash
gcloud run services update documind-agents \
  --min-instances 1 \
  --max-instances 50 \
  --cpu 4 \
  --memory 2Gi \
  --region us-central1
```

#### Rotate the database password

```bash
# 1. Generate new password
NEW_PW=$(openssl rand -base64 32)

# 2. Update in Terraform
# Edit infra/gcp/terraform.tfvars: db_password = "<new>"
terraform apply

# 3. Update Cloud Run env
gcloud run services update documind-agents \
  --set-env-vars "DATABASE_URL=postgresql://documind:${NEW_PW}@/..."

# 4. Update AWS Lambda env via CDK
cd infra/aws
npx cdk deploy --parameters DatabaseUrl="postgresql://documind:${NEW_PW}@/..."

# 5. Update .env.local for the web app
```

### Backup and Recovery

- **Database**: Cloud SQL automated backups (configure in GCP Console, daily recommended).
- **S3 uploads**: Enable versioning on the bucket for accidental deletion recovery.
- **Vector Search index**: Vectors can be reconstructed by re-running the ingestion pipeline on all READY documents. Keep S3 originals as the source of truth.
- **Terraform state**: Stored in GCS bucket (`documind-tf-state-{project_id}`). Enable versioning.

---

## 10. Decision Log

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Google ADK over LangGraph/CrewAI | Native Gemini integration, first-class SequentialAgent/LoopAgent constructs, AgentTool for cross-team composition, built-in session management | LangGraph (more flexible but more boilerplate), CrewAI (less control over routing) |
| Deterministic intent classifier | Fast (no LLM call), predictable, debuggable. LLM can override when context matters. | LLM-only classification (slower, costs tokens, less predictable) |
| Cross-cloud (AWS + GCP) | Best-of-breed: S3+EventBridge+StepFunctions for event-driven pipelines; Document AI + Vertex for AI services. WIF eliminates key management. | GCP-only (Cloud Storage + Cloud Functions -- less mature orchestration), AWS-only (Textract + Bedrock -- less capable OCR) |
| Vertex Vector Search over Pinecone/Weaviate | Managed, same-cloud as agents, namespace support for tenancy, stream updates | Pinecone (simpler API but another vendor), pgvector (same DB but slower at scale) |
| Prisma over Drizzle/raw SQL | Type-safe, migration system, shared between Next.js and Lambda | Drizzle (lighter but less ecosystem), raw SQL (no type safety) |
| Token bucket rate limiting | Simple, in-memory, per-workspace. Good enough for MVP. | Redis-backed (distributed, but adds another dependency for MVP) |
| SSE over WebSocket | Unidirectional (server → client) fits chat streaming. Simpler infrastructure, works through CDNs, no connection upgrade. | WebSocket (bidirectional but unnecessary complexity for streaming text) |
| In-memory ADK session service | Sufficient for single Cloud Run instance MVP. Sessions persist conversation state within the instance lifetime. | Firestore-backed sessions (durable, but adds GCP dependency and latency) |
| Clerk Organizations as workspaces | Built-in org management, invitation flows, role-based access. Maps naturally to multi-tenancy. | Custom auth (more work), Auth0 Organizations (similar but pricier at scale) |

---

## 11. Extending the System

### Adding a New Agent Tool

1. Create a new function in `apps/agents/documind_agents/tools/`:

```python
from google.adk.tools import FunctionTool

def my_new_tool(param1: str, param2: int) -> dict:
    """Tool description shown to the LLM."""
    # Implementation
    return {"result": "..."}

my_new_tool_fn = FunctionTool(func=my_new_tool)
```

2. Add the tool to the relevant agent in its team file:

```python
agent = LlmAgent(
    name="MyAgent",
    tools=[my_new_tool_fn],  # Add here
    ...
)
```

### Adding a New Agent to an Existing Team

1. Define the agent in the team file (e.g., `teams/rag_team.py`):

```python
new_agent = LlmAgent(
    name="NewAgent",
    model=settings.llm_model,
    instruction="...",
    output_key="new_agent_output",
)
```

2. Add it to the SequentialAgent's `sub_agents` list at the appropriate position.

### Adding a New Team

1. Create `apps/agents/documind_agents/teams/new_team.py`.
2. Define agents and compose them into a `SequentialAgent`.
3. Import and add to `RootOrchestrator.sub_agents` in `root.py`.
4. Update the intent classifier in `tools/intent.py` with keywords/patterns for the new team.
5. Update RootOrchestrator's instruction with routing rules for the new intent.

### Adding a New API Route

1. Create the route file in `apps/web/app/api/<path>/route.ts`.
2. Always start with Clerk auth:

```typescript
const { orgId } = await auth();
if (!orgId) return NextResponse.json({ error: "No workspace" }, { status: 403 });
```

3. Apply rate limiting if the route is user-facing.
4. Scope all database queries by workspace.

### Adding Stripe Billing (Post-MVP)

Planned integration points:
- `Workspace.plan` field already exists (`free` default).
- Add Stripe customer ID to the Workspace model.
- Create a webhook handler at `/api/webhooks/stripe`.
- Meter chat messages and document uploads per billing period.
- Enforce plan-specific limits in rate limiters.

---

## 12. Known Limitations

| Limitation | Impact | Mitigation Path |
|-----------|--------|-----------------|
| In-memory ADK sessions | Sessions lost on Cloud Run instance restart | Migrate to Firestore-backed session service |
| In-memory rate limiter | Not shared across Next.js instances | Add Redis for distributed rate limiting |
| No real-time upload status | Users must poll or refresh for document status updates | Add Pusher/Ably channel for real-time push |
| Cloud SQL public IP (dev) | Security concern for production | Switch to private IP + Cloud SQL Auth Proxy |
| Cloud Run allUsers invoker | Agent service is publicly accessible | Add IAM authentication for Cloud Run |
| Single embedding model | Cannot change dimensions after index creation | Plan migration path before changing models |
| No PII redaction | Sensitive data in documents is stored and indexed as-is | Add a Document AI de-identification processor step |
| No eval harness | Agent quality not systematically measured | Build scripted eval suite against known Q&A pairs |
| No model A/B testing | Cannot compare Critic effectiveness across models | Add model parameter to Critic, log comparison traces |
| Cold starts | Cloud Run scales to zero; first request takes 10-30s | Set min instances to 1+ in production |

---

*For user-facing documentation, see the [User Guide](./USER_GUIDE.md). For setup instructions, see the [README](../README.md).*
