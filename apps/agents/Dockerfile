FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY pyproject.toml .
RUN uv pip install --system --no-cache .

COPY documind_agents/ documind_agents/

EXPOSE 8001

CMD ["uvicorn", "documind_agents.main:app", "--host", "0.0.0.0", "--port", "8001"]
