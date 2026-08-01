# DocuMind — Agentic RAG Chat SaaS

Upload documents and chat with an AI agent team that retrieves, analyzes, and cites your content.

## Architecture

```
Browser → Next.js (Clerk auth) → ADK Agent Service (Cloud Run)
                                       ↓
                                 Vertex Vector Search
                                       ↓
                              RootOrchestrator (ADK)
                              ├── RagTeam (Retriever → Analyzer → Writer ↔ Critic)
                              └── SweTeam (PM → Architect → Coder → Reviewer → QA)

Upload: Browser → presigned S3 PUT → EventBridge → Step Functions
        → Document AI → Chunk+Embed → Vector Search upsert
```

### Agent Teams

- **RagTeam**: Retrieves document chunks, analyzes them, drafts cited answers, and self-checks via a Critic loop.
- **SweTeam**: Clarifies requirements (PM), designs (Architect grounded via RagTeam), codes, reviews, and writes tests.
- **RootOrchestrator**: Routes user intent to the appropriate team.

## Tech Stack

| Layer       | Technology                                  |
|-------------|---------------------------------------------|
| Frontend    | Next.js 15 (App Router), TypeScript, Tailwind |
| Auth        | Clerk (organizations = workspaces)           |
| Agents      | Google ADK (Python), FastAPI, Cloud Run      |
| Vector DB   | Vertex AI Vector Search                      |
| Doc Parsing | GCP Document AI (Layout Processor)           |
| Upload      | AWS S3 + EventBridge + Step Functions        |
| Database    | Cloud SQL PostgreSQL (Prisma ORM)            |
| Cross-cloud | Workload Identity Federation (no long-lived keys) |
| Infra       | Terraform (GCP), AWS CDK (AWS)               |

## Monorepo Structure

```
├── apps/web/          # Next.js frontend + API routes
├── apps/agents/       # Python ADK agent service
├── infra/aws/         # CDK: S3, EventBridge, Step Functions, Lambdas
├── infra/gcp/         # Terraform: Cloud Run, Vector Search, Doc AI, Cloud SQL, WIF
├── packages/db/       # Prisma schema + migrations
└── packages/types/    # Shared TypeScript types
```

## Prerequisites

- Node.js 20+, pnpm 9+
- Python 3.12+, uv
- `gcloud` CLI, `aws` CLI
- Terraform 1.5+, AWS CDK
- Docker

## Setup

```bash
# 1. Clone and install
pnpm install

# 2. Copy env file and fill in values
cp .env.example .env.local

# 3. Generate Prisma client
pnpm db:generate

# 4. Run database migrations
pnpm db:migrate

# 5. Start the web app
pnpm dev

# 6. Start the agent service (in another terminal)
cd apps/agents
uv pip install -e ".[dev]"
uvicorn documind_agents.main:app --reload --port 8001
```

## Deploying Infrastructure

### GCP (Terraform)

```bash
cd infra/gcp
cp terraform.tfvars.example terraform.tfvars  # Fill in values
terraform init
terraform plan
terraform apply
```

### AWS (CDK)

```bash
cd infra/aws
pnpm install
npx cdk bootstrap
npx cdk deploy
```

## Environment Variables

See `.env.example` for the full list. Key variables:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — Clerk auth
- `DATABASE_URL` — Cloud SQL PostgreSQL connection string
- `S3_UPLOAD_BUCKET` — AWS S3 bucket for uploads
- `AGENT_SERVICE_URL` — URL of the ADK service (Cloud Run or local)
- `GCP_PROJECT_ID` — GCP project for Vertex AI / Document AI
- `GOOGLE_API_KEY` — Google AI API key for ADK
