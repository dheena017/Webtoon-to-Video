import os
from pydantic_settings import BaseSettings if "BaseSettings" in globals() else object
from pathlib import Path

# Setup base directories
BASE_DIR = Path(__file__).resolve().parent.parent
MEDIA_DIR = BASE_DIR / "media"
TEMP_DIR = MEDIA_DIR / "temp"
OUTPUT_DIR = MEDIA_DIR / "output"

# Ensure all directories exist
for folder in [MEDIA_DIR, TEMP_DIR, OUTPUT_DIR]:
    folder.mkdir(parents=True, exist_ok=True)

class Settings:
    PROJECT_NAME: str = "Webtoon-to-Video Engine"
    API_V1_STR: str = "/api"
    
    # Storage Paths
    MEDIA_ROOT: Path = MEDIA_DIR
    TEMP_ROOT: Path = TEMP_DIR
    OUTPUT_ROOT: Path = OUTPUT_DIR
    
    # Playwright Settings
    PLAYWRIGHT_HEADLESS: bool = True
    PLAYWRIGHT_TIMEOUT_MS: int = 30000
    
    # OCR / Vision Settings (Placeholder configs)
    OCR_API_URL: str = os.getenv("OCR_API_URL", "https://api.vision-ocr-placeholder.local/v1/analyze")
    OCR_API_KEY: str = os.getenv("OCR_API_KEY", "mock-ocr-key-1234")
    
    # Video Generation Config
    DEFAULT_PANEL_DURATION: float = 4.0  # seconds per panel
    DEFAULT_VIDEO_FPS: int = 24
    DEFAULT_RESOLUTION: tuple[int, int] = (1080, 1920) # Portrait aspect ratio default for mobile vertical formats

settings = Settings()
