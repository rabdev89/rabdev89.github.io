"""SWE Team — PM -> Architect -> Coder -> Reviewer -> QA.

Software engineering agent team that produces specs, designs, code, and tests
grounded in the user's uploaded documents via the RAG team.
"""

from google.adk.agents import LlmAgent, SequentialAgent
from google.adk.tools import AgentTool

from documind_agents.config import settings
from documind_agents.teams.rag_team import rag_team

rag_tool = AgentTool(agent=rag_team)

pm = LlmAgent(
    name="PM",
    model=settings.llm_model,
    instruction="""You are the PM (Product Manager) agent for DocuMind's SWE team.

YOUR TASK: Clarify the user's software request and produce structured user stories.

STEPS:
1. Analyze the user's request for what they want built or designed.
2. If the request references uploaded documents, note which are relevant for the Architect.
3. Break down into user stories in the format:
   "As a [role], I want [feature], so that [benefit]"
4. Include acceptance criteria for each story.

OUTPUT: Store in session state key 'user_stories' as structured text.
List each story with its acceptance criteria.""",
    output_key="user_stories",
)

architect = LlmAgent(
    name="Architect",
    model=settings.llm_model,
    instruction="""You are the Architect agent for DocuMind's SWE team.

YOUR TASK: Design a technical architecture based on the user stories, grounded in uploaded docs.

STEPS:
1. Read 'user_stories' from session state.
2. Use the rag_team tool to search the user's uploaded documents for:
   - Existing specifications or requirements
   - Technical constraints or standards
   - Prior designs or architectural decisions
3. Propose a high-level design including:
   - Component breakdown
   - Data flow diagrams (described in text)
   - Key interfaces / API contracts
   - Technology recommendations
4. Ground every design decision in the uploaded documents where possible.

OUTPUT: Store in session state key 'architecture_design'.""",
    tools=[rag_tool],
    output_key="architecture_design",
)

coder = LlmAgent(
    name="Coder",
    model=settings.llm_model,
    instruction="""You are the Coder agent for DocuMind's SWE team.

YOUR TASK: Produce code artifacts that implement the architecture design.

STEPS:
1. Read 'architecture_design' from session state.
2. Write production-quality code with clear file boundaries.
3. Use consistent naming conventions and modern best practices.
4. Include type annotations and minimal inline documentation.

OUTPUT: Store code in session state key 'code_artifacts'.
Format as markdown with ```language code blocks, each prefixed with a file path comment.""",
    output_key="code_artifacts",
)

reviewer = LlmAgent(
    name="Reviewer",
    model=settings.llm_model,
    instruction="""You are the Code Reviewer agent for DocuMind's SWE team.

YOUR TASK: Review the Coder's output for correctness and quality.

STEPS:
1. Read 'code_artifacts' and 'architecture_design' from session state.
2. Check for:
   - Correctness: logic bugs, off-by-one errors, null handling
   - Security: injection, auth bypass, data exposure
   - Performance: N+1 queries, missing indexes, memory leaks
   - Adherence to the architecture design
3. Provide specific, actionable feedback with line references.

OUTPUT: Store review in session state key 'review_feedback'.
Set 'review_approved' to "true" or "false".""",
    output_key="review_feedback",
)

qa = LlmAgent(
    name="QA",
    model=settings.llm_model,
    instruction="""You are the QA agent for DocuMind's SWE team.

YOUR TASK: Create a comprehensive test plan for the implemented code.

STEPS:
1. Read 'code_artifacts' and 'user_stories' from session state.
2. Write test cases covering:
   - Unit tests for each function/method
   - Integration tests for component interactions
   - Edge cases and error scenarios
   - Acceptance test cases matching user story criteria

OUTPUT: Store in session state key 'test_plan'.
Include test code in the same markdown format as code_artifacts.""",
    output_key="test_plan",
)

swe_team = SequentialAgent(
    name="SweTeam",
    description="Software engineering team: takes a build/design/code request, clarifies requirements, designs architecture grounded in uploaded docs, produces code, reviews it, and writes tests. Use when the user asks to build, design, architect, or code something based on their documents.",
    sub_agents=[pm, architect, coder, reviewer, qa],
)
