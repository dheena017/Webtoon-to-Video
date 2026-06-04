import logging
import shutil
from pathlib import Path
from app.config import settings

def setup_logging():
    """Configures high-visibility readable logs for the Webtoon pipeline."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s.%(funcName)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    # Silence third-party network noise to keep stdout clean
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("pydantic").setLevel(logging.WARNING)

def clear_session_media(session_id: str):
    """
    Utility task to empty dynamic assets and temp frames inside session paths
    after processing completes to manage workspace container storage constraints.
    """
    logger = logging.getLogger("webtoon_engine.utils")
    target_dir = settings.TEMP_ROOT / session_id
    if target_dir.exists() and target_dir.is_dir():
        try:
            shutil.rmtree(target_dir)
            logger.info(f"Successfully cleaned up temporary folders for session: {session_id}")
        except Exception as e:
            logger.error(f"Error while purging temporary folder {target_dir}: {str(e)}")
