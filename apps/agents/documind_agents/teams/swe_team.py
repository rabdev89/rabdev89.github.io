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
    instruction="""You are the PM (Product Manager) agent. Given the user's request,
clarify requirements and produce a structured set of user stories.
If the request references uploaded documents, note which documents are relevant.
Store your user stories in state key 'user_stories'.""",
)

architect = LlmAgent(
    name="Architect",
    model=settings.llm_model,
    instruction="""You are the Architect agent. Read 'user_stories' from state.
Use the rag_team tool to search the user's uploaded documents for relevant
specifications, constraints, or prior art. Propose a high-level design
including components, data flow, and key interfaces.
Store your design in state key 'architecture_design'.""",
    tools=[rag_tool],
)

coder = LlmAgent(
    name="Coder",
    model=settings.llm_model,
    instruction="""You are the Coder agent. Read 'architecture_design' from state.
Produce code artifacts that implement the design. Output well-structured,
production-quality code with clear file boundaries.
Store code artifacts in state key 'code_artifacts'.""",
)

reviewer = LlmAgent(
    name="Reviewer",
    model=settings.llm_model,
    instruction="""You are the Reviewer agent. Read 'code_artifacts' and 'architecture_design'.
Review the code for correctness, security, performance, and adherence to the design.
Provide specific, actionable feedback. If the code is acceptable, set 'review_approved'
to true. Otherwise, set it to false with 'review_feedback'.""",
)

qa = LlmAgent(
    name="QA",
    model=settings.llm_model,
    instruction="""You are the QA agent. Read 'code_artifacts' and 'user_stories'.
Write a test plan and test cases that verify the implementation satisfies
the user stories. Include unit tests, integration tests, and edge cases.
Store in state key 'test_plan'.""",
)

swe_team = SequentialAgent(
    name="SweTeam",
    description="Software engineering team: clarifies requirements, designs, codes, reviews, and writes tests — grounded in uploaded docs.",
    sub_agents=[pm, architect, coder, reviewer, qa],
)
