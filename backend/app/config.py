from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    app_name: str = "Exam Platform"
    debug: bool = True
    database_url: str = "sqlite:///./exam_platform.db"
    secret_key: str = "change-me-in-production-please-use-a-real-secret"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480
    upload_dir: str = "storage/uploads"
    output_dir: str = "storage/outputs"

    gemini_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    openrouter_model: str = "openai/gpt-4o-mini"
    supabase_url: Optional[str] = None
    supabase_anon_key: Optional[str] = None
    supabase_service_role_key: Optional[str] = None

    class Config:
        env_file = ".env"


settings = Settings()
