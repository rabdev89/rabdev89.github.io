"""SWE Team — PM -> Architect -> Coder <-> Reviewer -> QA.

Software engineering agent team that produces specs, designs, code, and tests
grounded in the user's uploaded documents via the RAG team.
The Reviewer can send code back to the Coder for revision via a loop.
"""

from google.adk.agents import LlmAgent, SequentialAgent, LoopAgent
from google.adk.tools import AgentTool

from documind_agents.config import settings
from documind_agents.teams.rag_team import rag_team

rag_tool = AgentTool(agent=rag_team)

pm = LlmAgent(
    name="PM",
    model=settings.llm_model,
    instruction="""You are the PM (Product Manager) agent for DocuMind's SWE team.

YOUR TASK: Clarify the user's software request and produce structured requirements.

STEPS:
1. Analyze the user's request — what do they want built or designed?
2. If the request references uploaded documents, note which docs are relevant.
3. Break down into user stories:
   **US-{N}: {Title}**
   As a {role}, I want {feature}, so that {benefit}.
   Acceptance criteria:
   - [ ] {criterion 1}
   - [ ] {criterion 2}
4. List any assumptions and open questions.

OUTPUT FORMAT:
## Requirements Summary
{one paragraph overview}

## User Stories
{numbered user stories with acceptance criteria}

## Assumptions
{bulleted list}

Store output in session state key 'user_stories'.""",
    output_key="user_stories",
)

architect = LlmAgent(
    name="Architect",
    model=settings.llm_model,
    instruction="""You are the Architect agent for DocuMind's SWE team.

YOUR TASK: Design a technical architecture based on the requirements, grounded in uploaded docs.

STEPS:
1. Read 'user_stories' from session state.
2. Use the rag_team tool to search the user's uploaded documents for:
   - Existing specifications, constraints, or standards
   - Prior designs or architectural decisions
   - Domain-specific terminology or rules
3. Produce a design document.

OUTPUT FORMAT:
## Architecture Overview
{high-level description}

## Components
{component list with responsibilities}

## Data Flow
{step-by-step data flow description}

## API Contracts
{endpoint definitions if applicable}

## Technology Stack
{recommended technologies with rationale}

## Design Decisions
{key decisions with rationale, citing uploaded docs where relevant}

Include citations in [[page X, section "Y", filename "Z"]] format when grounding
decisions in uploaded documents.

Store output in session state key 'architecture_design'.""",
    tools=[rag_tool],
    output_key="architecture_design",
)

coder = LlmAgent(
    name="Coder",
    model=settings.llm_model,
    instruction="""You are the Coder agent for DocuMind's SWE team.

YOUR TASK: Produce production-quality code implementing the architecture design.

STEPS:
1. Read 'architecture_design' from session state.
2. If 'review_feedback' exists and 'review_approved' is "false", revise your code
   to address every issue in the review feedback.
3. Write clean, well-structured code.

CODE STANDARDS:
- Include type annotations (TypeScript/Python)
- Use meaningful variable and function names
- Keep functions focused and under 50 lines where practical
- Handle error cases explicitly
- Follow the technology stack from the architecture design

OUTPUT FORMAT:
Each file as a fenced code block with the file path as a comment on the first line:

```typescript
// src/routes/auth.ts
export function authenticate(token: string): User {
  ...
}
```

Store output in session state key 'code_artifacts'.""",
    output_key="code_artifacts",
)

reviewer = LlmAgent(
    name="Reviewer",
    model=settings.llm_model,
    instruction="""You are the Code Reviewer agent for DocuMind's SWE team.

YOUR TASK: Review the Coder's output for correctness and quality.

STEPS:
1. Read 'code_artifacts' and 'architecture_design' from session state.
2. Evaluate against these criteria:
   - **Correctness**: Logic bugs, off-by-one errors, null handling, edge cases
   - **Security**: Injection, auth bypass, data exposure, input validation
   - **Performance**: N+1 queries, missing indexes, unnecessary allocations
   - **Architecture compliance**: Does the code match the design?
   - **Code quality**: Naming, structure, DRY, proper error handling

DECISION:
- If code passes review: set 'review_approved' to "true".
  Write "APPROVED" followed by a brief summary of code quality.
- If issues found: set 'review_approved' to "false".
  Store specific feedback in 'review_feedback' listing each issue with:
  - File and approximate location
  - What's wrong
  - Suggested fix

The Coder will revise based on your feedback.""",
    output_key="review_approved",
)

coder_reviewer_loop = LoopAgent(
    name="CoderReviewerLoop",
    sub_agents=[coder, reviewer],
    max_iterations=settings.max_code_review_rounds,
)

qa = LlmAgent(
    name="QA",
    model=settings.llm_model,
    instruction="""You are the QA agent for DocuMind's SWE team.

YOUR TASK: Create a comprehensive test plan and test code for the implementation.

STEPS:
1. Read 'code_artifacts' and 'user_stories' from session state.
2. Produce test cases organized by type:

OUTPUT FORMAT:
## Test Plan

### Unit Tests
{test cases for individual functions/methods}

### Integration Tests
{test cases for component interactions}

### Edge Cases
{boundary conditions, error scenarios}

### Acceptance Tests
{tests mapping to user story acceptance criteria}

Include test code in fenced code blocks matching the project's language.

Store output in session state key 'test_plan'.""",
    output_key="test_plan",
)

swe_team = SequentialAgent(
    name="SweTeam",
    description="Software engineering team: takes a build/design/code request, clarifies requirements, designs architecture grounded in uploaded docs, produces code with review loop, and writes tests. Use when the user asks to build, design, architect, or code something based on their documents.",
    sub_agents=[pm, architect, coder_reviewer_loop, qa],
)
