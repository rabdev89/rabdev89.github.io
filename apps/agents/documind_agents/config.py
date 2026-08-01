from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    gcp_project_id: str = ""
    gcp_region: str = "us-central1"
    vertex_vector_search_index_endpoint: str = ""
    vertex_vector_search_index_id: str = ""
    database_url: str = "postgresql://localhost:5432/documind"
    embedding_model: str = "text-embedding-005"
    llm_model: str = "gemini-2.0-flash"
    max_critic_revisions: int = 2

    model_config = {"env_prefix": "", "env_file": ".env"}


settings = Settings()
