import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.routes import process
from app.utils.helpers import setup_logging

# Configure system-wide logs
setup_logging()

# Initialize FastAPI App
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="A senior-engineered Webtoon-to-Video conversion engine. "
                "Provides dynamic endpoints for image strip crawling, "
                "automating page/frame vision panel cuts, moviepy rendering, "
                "and relational postgres logging.",
    version="1.0.0"
)

# Setup CORS for Frontend integrations (Universal defaults supporting dev and preview ports)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits all origins for simplified local React frontend calls
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Core API route endpoints
app.include_router(process.router)

# Mount media static directory so that produced MP4 files and sliced screenshots
# are directly streaming/playable and downloadable from browser endpoints
app.mount("/media", StaticFiles(directory=str(settings.MEDIA_ROOT)), name="media")


@app.get("/", tags=["System Information"])
async def root_status():
    """Liveliness check mapping engine state and active system parameters."""
    return {
        "engine": settings.PROJECT_NAME,
        "status": "online",
        "api_v1_path": settings.API_V1_STR,
        "media_storage_resolved": str(settings.MEDIA_ROOT),
        "supported_codecs": ["libx264 (MP4)", "aac (Audio)"]
    }


if __name__ == "__main__":
    # Start the server bound to all interfaces
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
