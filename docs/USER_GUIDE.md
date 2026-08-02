# DocuMind User Guide

A step-by-step guide for end users of DocuMind. This covers signing up, creating workspaces, uploading documents, chatting with the AI agent team, and using the admin dashboard.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Workspaces](#2-workspaces)
3. [Uploading Documents](#3-uploading-documents)
4. [Chatting with Your Documents](#4-chatting-with-your-documents)
5. [Understanding Agent Teams](#5-understanding-agent-teams)
6. [Reading Citations](#6-reading-citations)
7. [Admin Dashboard](#7-admin-dashboard)
8. [Troubleshooting](#8-troubleshooting)
9. [Limits and Quotas](#9-limits-and-quotas)

---

## 1. Getting Started

### Sign Up

1. Navigate to the DocuMind URL (e.g., `https://your-documind-domain.com`).
2. Click **Sign Up** to create an account via Clerk.
3. You can sign up with email/password, Google, or GitHub (depending on configuration).
4. After signing up, you'll be prompted to create or join an organization.

### Sign In

1. Navigate to the DocuMind URL.
2. Click **Sign In** and enter your credentials.
3. If you belong to multiple organizations, select which one to work in.

---

## 2. Workspaces

A **workspace** is an isolated environment for a team. Each workspace has its own documents, conversations, and agent history. Workspaces map to Clerk Organizations.

### Create a Workspace

1. Click your profile icon in the top-left corner.
2. Select **Create Organization**.
3. Enter a name for your workspace (e.g., "Marketing Team", "Engineering Docs").
4. Invite team members by email (optional).

### Switch Workspaces

1. Click the organization switcher in the navigation bar.
2. Select a different organization.
3. All data (documents, conversations, admin views) will switch to the selected workspace.

### Invite Members

1. Go to **Organization Settings** in Clerk (via the profile menu).
2. Click **Invite Member** and enter their email.
3. Members inherit access to all documents and conversations in the workspace.

---

## 3. Uploading Documents

DocuMind supports the following file types:

| Format | Extensions | Max Size |
|--------|-----------|----------|
| PDF | `.pdf` | 50 MB |
| Word | `.doc`, `.docx` | 50 MB |
| Plain Text | `.txt` | 50 MB |
| CSV | `.csv` | 50 MB |
| Markdown | `.md` | 50 MB |
| Excel | `.xls`, `.xlsx` | 50 MB |

### How to Upload

1. Navigate to **Dashboard** or open a **Chat**.
2. Click the **Upload** button (paper clip icon in chat, or the upload area on the dashboard).
3. Select one or more files from your computer.
4. The upload begins immediately. You'll see a progress indicator.

### Document Processing Pipeline

After upload, each document goes through an automated pipeline:

```
UPLOADING → PROCESSING → READY
                ↘ FAILED (if an error occurs)
```

1. **UPLOADING** -- File is being transferred to secure cloud storage (AWS S3).
2. **PROCESSING** -- The document is being parsed (GCP Document AI for layout/OCR), split into semantic chunks, embedded into vectors, and indexed for search.
3. **READY** -- The document is fully indexed and available for chat queries.
4. **FAILED** -- Something went wrong. Check the error message in the Admin dashboard.

Processing typically takes 30 seconds to 5 minutes depending on document size and complexity.

### Filename Rules

- Maximum 255 characters.
- Allowed characters: letters, numbers, spaces, periods, hyphens, underscores, parentheses, brackets.
- No path separators (`/`, `\`) or directory traversal (`..`).

---

## 4. Chatting with Your Documents

### Start a New Conversation

1. Navigate to **Chat** in the sidebar.
2. Click **New Chat** (the `+` button).
3. Type your question in the message input and press Enter or click Send.

### How Chat Works

When you send a message, the following happens behind the scenes:

1. An **intent classifier** determines whether your question is about document content (RAG) or a software engineering request (SWE).
2. The system routes your query to the appropriate **agent team**.
3. Agents process your query in a pipeline, and you see real-time progress indicators (e.g., "Retriever is thinking...", "Writer is drafting...").
4. The response streams in token-by-token with inline citations.

### Conversation History

- Previous conversations appear in the left sidebar.
- Conversations are automatically titled based on your first message.
- Click any conversation to resume it.
- The conversation list refreshes every 15 seconds.

### Tips for Better Results

- **Be specific**: "What does Section 3.2 say about termination clauses?" works better than "Tell me about the contract."
- **Reference documents by name**: "According to the Q3 report..." helps the Retriever focus.
- **Ask follow-up questions**: The system remembers conversation context.
- **Upload relevant docs first**: The AI can only answer from documents in your workspace.

---

## 5. Understanding Agent Teams

### RAG Team (Document Q&A)

Used when you ask questions about your uploaded documents. The team works in sequence:

| Agent | What it Does | What You See |
|-------|-------------|-------------|
| Retriever | Searches your documents for relevant passages | "Searching documents..." |
| Analyzer | Extracts key facts from the found passages | "Analyzing results..." |
| Writer | Drafts an answer with inline citations | Text starts streaming |
| Critic | Verifies every claim has an accurate citation | (Runs silently, may trigger a rewrite) |

**When is it used?**
- "What does the document say about X?"
- "Summarize the report"
- "Compare the two uploaded specs"
- "Find all mentions of revenue targets"
- Any question ending with `?` when no build/code keywords are present

### SWE Team (Software Engineering)

Used when you want to build, design, or code something. The team works in sequence:

| Agent | What it Does | What You See |
|-------|-------------|-------------|
| PM | Clarifies requirements, writes user stories | Structured requirements appear |
| Architect | Designs the system, cites your uploaded docs | Architecture document appears |
| Coder | Writes production code | Code blocks stream in |
| Reviewer | Reviews code for bugs, security, quality | (May trigger a code revision) |
| QA | Writes test plans and test code | Test plan appears |

**When is it used?**
- "Build an API for user management"
- "Design a database schema based on the uploaded spec"
- "Implement the authentication flow from the requirements doc"
- "Write tests for the payment module"

**Key feature**: The Architect calls the RAG team internally to ground its design decisions in your uploaded documents. This means software designs are informed by your actual specs, not just general knowledge.

---

## 6. Reading Citations

Every factual claim in a RAG response includes a citation in this format:

```
[[page 3, section "Revenue Projections", filename "Q3-Report.pdf"]]
```

This means:
- **page 3** -- the claim comes from page 3 of the source document.
- **section "Revenue Projections"** -- the specific section heading.
- **filename "Q3-Report.pdf"** -- which uploaded document it came from.

### Verifying Citations

If you want to verify a citation:
1. Note the filename and page number.
2. Open the original document.
3. Navigate to the cited page and section.
4. The cited information should be present in that location.

The Critic agent verifies citations before the response is finalized, but you can always double-check.

---

## 7. Admin Dashboard

The admin dashboard provides workspace-level visibility into documents, conversations, agent behavior, and ingestion jobs.

### Accessing the Dashboard

Navigate to **Admin** in the sidebar. The dashboard has five tabs:

### Overview Tab

Shows high-level metrics:
- **Documents**: Total count and breakdown by status (uploading, processing, ready, failed).
- **Chunks**: Total indexed chunks across all documents.
- **Conversations**: Total conversations and messages.
- **Agent Runs**: Total agent trace entries with average latency.
- **Agent Usage**: Bar chart showing which agents are used most frequently.

### Documents Tab

Table of all uploaded documents with:
- Filename, MIME type, size.
- Status badge (color-coded: green = ready, yellow = processing, red = failed).
- Upload timestamp.

### Jobs Tab

Table of ingestion pipeline jobs with:
- Associated document.
- Pipeline state (PENDING, RUNNING, SUCCEEDED, FAILED).
- Start and end timestamps.
- **Execution** link that opens the AWS Step Functions console for the specific run (click to see the visual state machine and debug failures).

### Traces Tab

Detailed log of every agent step for debugging and optimization:
- Agent name, step type, latency, token usage.
- Expandable rows showing full input/output JSON for each step.
- **Filter by agent**: Use the dropdown to show traces for a specific agent (e.g., only "Retriever" or only "Critic").
- **Latency badges**: Green (< 2s), yellow (2-5s), red (> 5s).

### Conversations Tab

Table of all workspace conversations with:
- Title (auto-generated from the first message).
- Message count and agent trace count.
- Last active timestamp.

---

## 8. Troubleshooting

### "No workspace selected"

You need to select or create a Clerk organization. Click the organization switcher in the navigation bar.

### Document stuck in "PROCESSING"

The ingestion pipeline may have encountered an issue:
1. Go to **Admin > Jobs** and find the job for your document.
2. Click the **Execution** link to view the Step Functions execution in AWS Console.
3. Check which step failed and the error message.
4. Common causes: Document AI quota exceeded, network timeout, unsupported document format within a PDF.

### Document shows "FAILED"

1. Go to **Admin > Documents** to see the error message.
2. Common causes:
   - Scanned PDF with no recognizable text (try a higher-quality scan).
   - File is corrupted or password-protected.
   - Document AI processing quota exceeded (wait and retry).

### Chat returns "Agent service unavailable"

The ADK agent service on Cloud Run may be:
- Scaled to zero (cold start can take 10-30 seconds on first request).
- Experiencing an error. Check Cloud Run logs in the GCP Console.

### "Rate limit exceeded"

You've exceeded the per-workspace rate limit:
- **Chat**: 60 messages per minute.
- **Uploads**: 20 uploads per minute.
- Wait for the `Retry-After` period shown in the error, then try again.

### Citations are missing or incorrect

The Critic agent should catch most issues, but if citations seem wrong:
1. The source document may have ambiguous section headings.
2. The document may have been parsed with layout issues (common with complex multi-column PDFs).
3. Try asking a more specific question to narrow the search scope.

### Empty responses

If the AI returns no useful content:
1. Make sure you've uploaded documents to the current workspace.
2. Check that documents are in "READY" status (not still processing).
3. Try rephrasing your question with more specific keywords.

---

## 9. Limits and Quotas

| Limit | Value |
|-------|-------|
| Max file size | 50 MB per file |
| Max filename length | 255 characters |
| Chat message length | 10,000 characters |
| Chat rate limit | 60 messages/minute per workspace |
| Upload rate limit | 20 uploads/minute per workspace |
| Supported file types | PDF, DOC, DOCX, TXT, CSV, MD, XLS, XLSX |
| Critic revision rounds | 2 max |
| Code review rounds | 2 max |
| Vector search top-k | 5-8 (adaptive) |
| Embedding dimensions | 768 (text-embedding-005) |
| Presigned URL expiry | 10 minutes |
| Ingestion pipeline timeout | 30 minutes |

---

*For deployment and technical documentation, see the [README](../README.md) and [Knowledge Base](./KNOWLEDGE_BASE.md).*
