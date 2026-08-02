# DocuMind -- Agentic RAG Chat SaaS

Upload documents and chat with an AI agent team that retrieves, analyzes, and cites your content. A multi-agent system powered by Google ADK routes queries to either a **RAG team** (document Q&A with citations) or a **Software Engineering team** (designs, code, tests grounded in your docs).

---

## Table of Contents

- [Architecture](#architecture)
- [Agent Teams](#agent-teams)
- [Tech Stack](#tech-stack)
- [Monorepo Structure](#monorepo-structure)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Infrastructure Deployment](#infrastructure-deployment)
- [CI/CD](#cicd)
- [Security](#security)
- [API Reference](#api-reference)
- [Further Reading](#further-reading)

---

## Architecture

```
                                       Upload Flow
                                       ----------
Browser ──presigned PUT──▶ S3 ──ObjectCreated──▶ EventBridge ──▶ Step Functions
                                                                  │
                                                      ┌───────────┼───────────┐
                                                      ▼           ▼           ▼
                                                MarkProcessing  DocAI   ChunkEmbed
                                                      │           │           │
                                                      ▼           ▼           ▼
                                                  Postgres   Document AI  Vertex AI
                                                              (GCP)     Embeddings
                                                                          │
                                                                          ▼
                                                                   Vector Search
                                                                    (upsert)

                                       Chat Flow
                                       ---------
Browser ──SSE──▶ Next.js BFF ──POST /run──▶ ADK Agent Svc (Cloud Run)
                   (Clerk JWT)                    │
                                           RootOrchestrator
                                           ├── RagTeam (Retriever → Analyzer → Writer ↔ Critic)
                                           └── SweTeam (PM → Architect → Coder ↔ Reviewer → QA)
                                                    │
                                             Vertex Vector Search
                                                    │
                                              Cloud SQL Postgres
```

### Cross-Cloud Design

DocuMind spans AWS and GCP without long-lived keys:

| Direction | Mechanism |
|-----------|-----------|
| AWS Lambda → GCP (Document AI, Vertex AI) | Workload Identity Federation (WIF). Lambda gets an OIDC token, exchanges it at GCP STS for short-lived service account credentials. |
| GCP Cloud Run → AWS S3 (if needed) | GCP-to-AWS OIDC federation into a read-only IAM role scoped to the uploads bucket. |
| Next.js → AWS (presign) | Server-side STS AssumeRole per request. |
| Next.js → GCP (admin dashboard) | Application Default Credentials on the Cloud Run deployment. |

---

## Agent Teams

### RootOrchestrator

An `LlmAgent` that classifies user intent (via a deterministic keyword/pattern scorer) and routes to the appropriate team:

| Intent | Route | Example |
|--------|-------|---------|
| `rag_query` | RagTeam | "What does the contract say about termination?" |
| `swe_request` | SweTeam | "Build an API based on the uploaded spec" |
| `greeting` | Direct response | "Hi, what can you do?" |
| `ambiguous` | Clarification prompt | "Tell me about the architecture" |

### RagTeam (SequentialAgent)

```
Retriever ──▶ Analyzer ──▶ ┌─ Writer ◀──▶ Critic ─┐ (LoopAgent, max 2 revisions)
                           └───────────────────────┘
```

1. **Retriever** -- queries Vertex Vector Search with the user's question, stores top-k chunks.
2. **Analyzer** -- extracts relevant facts from chunks, tags each with source metadata.
3. **Writer** -- drafts a cited answer using `[[page X, section "Y", filename "Z"]]` format.
4. **Critic** -- verifies every claim maps to a citation. Rejects with feedback or approves. Up to 2 revision rounds.

### SweTeam (SequentialAgent)

```
PM ──▶ Architect ──▶ ┌─ Coder ◀──▶ Reviewer ─┐ ──▶ QA
                     └────────────────────────┘
```

1. **PM** -- clarifies requirements, produces structured user stories with acceptance criteria.
2. **Architect** -- designs architecture, **calls RagTeam via `AgentTool`** to ground decisions in uploaded docs.
3. **Coder** -- implements the design as production-quality code.
4. **Reviewer** -- reviews for correctness, security, and architecture compliance. Up to 2 revision rounds.
5. **QA** -- writes unit tests, integration tests, edge cases, and acceptance tests.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| Auth & Multi-tenancy | Clerk (organizations = workspaces) |
| Agent Runtime | Google ADK (Python), FastAPI, GCP Cloud Run |
| Vector Database | Vertex AI Vector Search (namespace = workspace) |
| Document Parsing | GCP Document AI (Layout Parser Processor) |
| Upload Pipeline | AWS S3 + EventBridge + Step Functions + Lambda |
| Database | Cloud SQL PostgreSQL 16, Prisma ORM |
| Embeddings | Vertex AI `text-embedding-005` (768 dimensions) |
| Cross-Cloud Auth | Workload Identity Federation (no long-lived keys) |
| Infrastructure | Terraform (GCP), AWS CDK (AWS) |
| CI | GitHub Actions (typecheck, lint, mypy, cdk synth, terraform validate) |

---

## Monorepo Structure

```
documind/
├── apps/
│   ├── web/                    # Next.js 15 frontend + API routes
│   │   ├── app/
│   │   │   ├── (app)/          # Authenticated routes (dashboard, chat, admin)
│   │   │   └── api/            # API routes (chat, uploads, documents, admin)
│   │   ├── components/
│   │   │   ├── chat/           # Chat UI (interface, messages, citations, uploads)
│   │   │   └── admin/          # Admin dashboard (stats, traces, jobs, docs)
│   │   └── lib/                # Utilities (rate limiting, polling, classnames)
│   └── agents/                 # Python ADK agent service
│       └── documind_agents/
│           ├── teams/          # RagTeam + SweTeam definitions
│           ├── tools/          # Vector search, Postgres, intent classifier
│           ├── root.py         # RootOrchestrator
│           ├── main.py         # FastAPI app (SSE /run, /messages, /health)
│           └── config.py       # Pydantic settings
├── infra/
│   ├── aws/                    # CDK: S3, EventBridge, Step Functions, 6 Lambdas
│   │   ├── lib/                # IngestionStack definition
│   │   └── lambdas/            # Lambda handlers + shared utilities
│   └── gcp/                    # Terraform: Cloud Run, Vector Search, Doc AI, Cloud SQL, WIF
├── packages/
│   ├── db/                     # Prisma schema (9 models) + migrations + RLS
│   └── types/                  # Shared TypeScript types (agent events, API contracts)
├── .github/workflows/ci.yml   # CI pipeline
└── package.json                # pnpm monorepo root
```

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | Next.js frontend, CDK, Lambda bundling |
| pnpm | 9+ | Monorepo package manager |
| Python | 3.12+ | ADK agent service |
| uv | latest | Python package installer |
| gcloud CLI | latest | GCP authentication and deployment |
| aws CLI | v2 | AWS authentication and CDK deployment |
| Terraform | 1.5+ | GCP infrastructure provisioning |
| Docker | latest | Cloud Run container builds |

### Cloud Accounts

- **GCP Project** with billing enabled (Document AI, Vertex AI, Cloud Run, Cloud SQL)
- **AWS Account** (S3, EventBridge, Step Functions, Lambda)
- **Clerk account** at [clerk.com](https://clerk.com) with an application configured for Organizations
- (Post-MVP) **Stripe account** for usage metering

---

## Quick Start

### 1. Clone and install dependencies

```bash
git clone <repo-url> documind
cd documind
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local with your values (see Environment Variables below)
```

### 3. Set up the database

```bash
# Generate Prisma client
pnpm db:generate

# Run migrations (requires DATABASE_URL in .env.local)
pnpm db:migrate
```

### 4. Start the Next.js frontend

```bash
pnpm dev
# Runs on http://localhost:3000
```

### 5. Start the agent service

```bash
cd apps/agents
uv pip install -e ".[dev]"
uvicorn documind_agents.main:app --reload --port 8001
# Runs on http://localhost:8001
```

### 6. Verify

- Open http://localhost:3000 -- you should see the Clerk sign-in page.
- After signing in, create or select an organization (workspace).
- Navigate to **Dashboard** to see workspace stats.
- Go to **Chat** to start a conversation (requires documents to be uploaded first).
- Visit **Admin** to view document, trace, and conversation tables.

---

## Environment Variables

### Next.js (`apps/web/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key (from Clerk dashboard) |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Yes | e.g. `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Yes | e.g. `/sign-up` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AGENT_SERVICE_URL` | Yes | ADK service URL (e.g. `http://localhost:8001` or Cloud Run URL) |
| `S3_UPLOAD_BUCKET` | Yes | AWS S3 bucket name for document uploads |
| `AWS_REGION` | No | Defaults to `us-east-1` |

### Agent Service (`apps/agents/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_API_KEY` | Yes | Google AI API key for ADK / Gemini |
| `GCP_PROJECT_ID` | Yes | GCP project ID |
| `GCP_REGION` | No | Defaults to `us-central1` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `VERTEX_VECTOR_SEARCH_INDEX_ENDPOINT` | Yes | Vertex Vector Search endpoint resource name |
| `VERTEX_VECTOR_SEARCH_DEPLOYED_INDEX_ID` | Yes | Deployed index ID |
| `EMBEDDING_MODEL` | No | Defaults to `text-embedding-005` |
| `EMBEDDING_DIMENSIONS` | No | Defaults to `768` |
| `LLM_MODEL` | No | Defaults to `gemini-2.0-flash` |
| `MAX_CRITIC_REVISIONS` | No | Defaults to `2` |
| `MAX_CODE_REVIEW_ROUNDS` | No | Defaults to `2` |

### AWS Lambdas (set via CDK parameters)

| Parameter | Description |
|-----------|-------------|
| `GcpProjectId` | GCP project ID |
| `GcpProjectNumber` | GCP project number (numeric) |
| `GcpRegion` | GCP region |
| `GcpServiceAccountEmail` | WIF service account email |
| `DocumentAiProcessorId` | Document AI processor ID |
| `VectorSearchIndexEndpoint` | Vertex Vector Search endpoint |
| `VectorSearchIndexId` | Deployed index ID |
| `DatabaseUrl` | PostgreSQL connection string (via Cloud SQL Auth Proxy) |

---

## Infrastructure Deployment

### GCP (Terraform)

```bash
cd infra/gcp

# Create a GCS bucket for Terraform state
gsutil mb gs://documind-tf-state-<your-project-id>

# Configure the backend in main.tf
# Set: bucket = "documind-tf-state-<your-project-id>"

# Create terraform.tfvars
cat > terraform.tfvars <<EOF
project_id               = "your-gcp-project-id"
region                   = "us-central1"
aws_account_id           = "123456789012"
db_password              = "your-secure-password"
vector_search_dimensions = 768
EOF

terraform init
terraform plan
terraform apply
```

**Outputs you will need:**
- `cloud_run_url` -- set as `AGENT_SERVICE_URL` in the web app
- `cloud_sql_connection_name` -- for constructing `DATABASE_URL`
- `vector_search_index_id` / `vector_search_endpoint_id` -- for agent service config
- `document_ai_processor_id` -- for CDK parameters
- `wif_pool_provider` -- for Lambda WIF configuration

### AWS (CDK)

```bash
cd infra/aws
pnpm install

# Bootstrap CDK in your AWS account (one-time)
npx cdk bootstrap

# Deploy the ingestion stack
npx cdk deploy \
  --parameters GcpProjectId=your-project-id \
  --parameters GcpProjectNumber=123456789 \
  --parameters GcpServiceAccountEmail=documind-aws-ingestion@your-project.iam.gserviceaccount.com \
  --parameters DocumentAiProcessorId=<from-terraform-output> \
  --parameters VectorSearchIndexEndpoint=<from-terraform-output> \
  --parameters VectorSearchIndexId=<from-terraform-output> \
  --parameters DatabaseUrl=<your-database-url>
```

**Outputs you will need:**
- `UploadBucketName` -- set as `S3_UPLOAD_BUCKET` in the web app
- `StateMachineArn` -- visible in AWS Console for monitoring ingestion jobs

### Deploy the Agent Service to Cloud Run

```bash
cd apps/agents

# Build and push container
gcloud builds submit --tag gcr.io/<project-id>/documind-agents:latest

# The Terraform config already creates the Cloud Run service.
# Update it with the new image:
gcloud run services update documind-agents \
  --region us-central1 \
  --image gcr.io/<project-id>/documind-agents:latest
```

---

## CI/CD

GitHub Actions runs on every push to `main` and every PR:

| Job | What it checks |
|-----|---------------|
| **Web (Next.js)** | `pnpm install` → Prisma generate → TypeScript typecheck → ESLint |
| **Agents (Python)** | `uv pip install` → Ruff lint → mypy strict typecheck |
| **AWS CDK synth** | `npx cdk synth` (validates CloudFormation template) |
| **Terraform validate** | `terraform init -backend=false` → `terraform validate` |

---

## Security

### Authentication & Authorization
- **Clerk** handles user auth with JWT verification on every API route.
- **Organizations** map 1:1 to workspaces. Switching orgs switches data context.
- Every API route extracts `orgId` from the Clerk JWT and scopes all queries to that workspace.

### Row-Level Security (RLS)
- Postgres RLS policies on 6 tables (`documents`, `chunks`, `conversations`, `messages`, `agent_traces`, `ingestion_jobs`).
- The application sets `SET LOCAL app.current_workspace_id = '<id>'` in a transaction.
- Even if application code misses a filter, the database rejects cross-workspace reads/writes.

### Rate Limiting
- **Chat**: 60 requests/minute per workspace (token bucket, 1 token/second refill).
- **Uploads**: 20 requests/minute per workspace (~0.33 tokens/second refill).
- Returns `429 Too Many Requests` with `Retry-After` header.

### Input Validation
- Chat messages capped at 10,000 characters.
- Upload filenames: max 255 chars, alphanumeric + `._-()[]` whitelist, no path traversal.
- Content-type allowlist: PDF, DOCX, TXT, CSV, Markdown, XLS, XLSX.
- File size: 50 MB max.
- Conversation IDs must be valid UUIDs.

### HTTP Headers
- `Content-Security-Policy` with Clerk-scoped domains
- `Strict-Transport-Security` (HSTS preload, 2-year max-age)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` disabling camera, microphone, geolocation
- `X-Powered-By` header removed

### S3 Upload Security
- Presigned URLs expire after 10 minutes.
- `ContentLength` enforced on the `PutObjectCommand` so the signature is size-bound.
- Bucket has `BlockPublicAccess.BLOCK_ALL` and S3-managed encryption.

---

## API Reference

### Chat

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/chat` | Send a message. Returns SSE stream of agent events. Body: `{ conversationId, message }` |
| `GET` | `/api/conversations` | List conversations for the current workspace. |
| `GET` | `/api/conversations/[id]/messages` | Get messages for a conversation. |

#### SSE Event Types

| Event | Payload | Description |
|-------|---------|-------------|
| `agent_step` | `{ agent }` | An agent started processing (e.g., "Retriever", "Writer") |
| `tool_call` | `{ agent, tool }` | An agent called a tool (e.g., "vector_search") |
| `text` | `{ text }` | Streamed text token |
| `citations` | `{ citations: [{page, section, filename}] }` | Extracted citations from the response |
| `error` | `{ error }` | Error message |
| `done` | `{ message_id }` | Stream complete, message persisted |

### Documents

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/uploads/presign` | Get a presigned S3 URL. Body: `{ filename, contentType, size }` |
| `GET` | `/api/documents` | List documents for the current workspace. |
| `GET` | `/api/documents/[id]` | Get document status and metadata. |

### Admin

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/stats` | Workspace-level metrics (doc counts, chunks, conversations, traces). |
| `GET` | `/api/admin/traces?agent=X&limit=N` | Query agent traces with optional filters. |
| `GET` | `/api/admin/jobs` | List ingestion jobs with Step Functions ARN links. |
| `GET` | `/api/admin/conversations` | List conversations with message/trace counts. |

### Agent Service (internal)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/run` | SSE stream of agent events. Body: `{ workspace_id, user_id, conversation_id, message }` |
| `POST` | `/messages` | Get conversation history. Body: `{ conversation_id, workspace_id }` |
| `GET` | `/health` | Liveness check. Returns `{ status: "ok" }` |

---

## Further Reading

- [User Guide](./docs/USER_GUIDE.md) -- End-user guide for using DocuMind
- [Knowledge Base Transfer](./docs/KNOWLEDGE_BASE.md) -- Architecture deep-dive and operational runbook
- [Google ADK Documentation](https://adk.dev)
- [Clerk Documentation](https://clerk.com/docs)
- [Vertex AI Vector Search](https://cloud.google.com/vertex-ai/docs/vector-search/overview)
- [GCP Document AI](https://cloud.google.com/document-ai/docs)
- [AWS Step Functions](https://docs.aws.amazon.com/step-functions/)
