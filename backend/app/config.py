from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "Ocean Front Offline API"
    api_prefix: str = "/api"
    raw_data_dir: Path = PROJECT_ROOT / "data" / "raw"
    cache_dir: Path = PROJECT_ROOT / "data" / "cache"
    prototype_data_dir: Path = PROJECT_ROOT / "frontend" / "prototype" / "data"
    dataset_id: str = "global-daily-mesoscale-front-v1"
    dataset_version: str = "V1.0"
    ai_provider: str = "rules"
    local_llm_endpoint: str = "http://127.0.0.1:11434/api/generate"
    local_llm_model: str = "qwen2.5:1.5b-instruct"
    ai_timeout_seconds: float = 3.0
    monthly_execution_token: SecretStr | None = None
    case_store_path: Path | None = None
    synthetic_run_store_path: Path | None = None

    model_config = SettingsConfigDict(
        env_prefix="OCEAN_",
        env_file=PROJECT_ROOT / ".env",
        extra="ignore",
    )


settings = Settings()
