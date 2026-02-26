from pydantic_settings import BaseSettings
import os
from pathlib import Path
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = BASE_DIR / ".env.backend"


if ENV_PATH.exists():
    load_dotenv(str(ENV_PATH))
    print(f"DEBUG: Loaded environment from {ENV_PATH}")
else:
    print(f"DEBUG: .env.backend NOT FOUND at {ENV_PATH}")

class Settings(BaseSettings):
    PROJECT_NAME: str = os.getenv("APP_NAME", "ZERO ONE AI Backend")
    API_V1_STR: str = "/api/v1"
    MONGO_DEFAULT_URI: str = os.getenv("MONGO_DEFAULT_URI", "mongodb:
    TEST_URL: str | None = os.getenv("TEST_URL")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_BASE_URL: str = os.getenv("OPENAI_BASE_URL", "https:
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "google/gemini-2.0-flash-001")

    class Config:
        extra = "ignore"

settings = Settings()