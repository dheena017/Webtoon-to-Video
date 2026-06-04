import logging
import uuid
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, HttpUrl, Field
from typing import List, Dict, Any, Optional
import asyncpg
from supabase import create_client, Client

from app.services.scraper import WebtoonScraperService
from app.services.ocr import WebtoonPanelProcessor, slice_panels
from app.services.video import WebtoonVideoMaker
from app.config import settings

logger = logging.getLogger("webtoon_engine.api")

router = APIRouter(prefix="/api", tags=["Webtoon Processing"])

# Instantiate Services
scraper_service = WebtoonScraperService()
panel_service = WebtoonPanelProcessor()
video_service = WebtoonVideoMaker()


# ==========================================
# Schema Definitions
# ==========================================

class PanelDetail(BaseModel):
    panel_index: int
    image_path: str
    transcription: str
    sound_effect: str
    duration_sec: float


class ProcessUrlRequest(BaseModel):
    url: HttpUrl = Field(..., description="The main URL of the Webtoon episode to crawl and extract panel strips from")
    session_id: Optional[str] = Field(None, description="Client side unique session hash tracking requests")
    apply_audio: bool = Field(False, description="Whether to compile video with automatic procedural simulated audio / sound effects")


class ProcessUrlResponse(BaseModel):
    session_id: str
    status: str
    strip_count: int
    panel_count: int
    panels: List[PanelDetail]
    video_output_path: str
    video_download_url: str


class GenerateVideoRequest(BaseModel):
    url: str = Field(..., description="The main URL of the Webtoon episode to crawl and extract panel strips from")
    panels_config: List[Dict[str, Any]] = Field(
        default=[],
        description="Optional list of manual slicing coordinates, durations, motion types and speech narrations"
    )
    episode_id: Optional[str] = Field(None, description="Dynamic identifier representing the webtoon episode")


class GeneratedPanelInfo(BaseModel):
    id: int
    image_url: str
    speech_text: str
    sfx: str
    duration: float
    motion_type: str


class GenerateVideoResponse(BaseModel):
    project_id: str
    status: str
    video_url: str
    panels_processed: int
    message: str
    panels: List[GeneratedPanelInfo] = []


# ==========================================
# Database Persistence Integration (Supabase)
# ==========================================

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase_client: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("Supabase client initialized successfully.")
    except Exception as init_err:
        logger.error(f"Failed to initialize Supabase client with SUPABASE_URL: {str(init_err)}")
else:
    logger.warning("SUPABASE_URL or SUPABASE_KEY is missing. Supabase database logging will be bypassed.")


async def log_project_to_db(project_id: str, original_url: str, final_video_path: str):
    """
    Asynchronously logs the project status, original URL, and output MP4 paths into Supabase.
    Inserts a row into the 'generated_videos' table.
    """
    logger.info(f"Supabase database insertion triggered asynchronously for project/episode: {project_id}")
    
    if not supabase_client:
        logger.warning(
            f"Supabase database logging bypassed for project {project_id} "
            f"because Supabase client is not initialized (check SUPABASE_URL and SUPABASE_KEY config)."
        )
        return

    try:
        # Build the payload mapping
        data = {
            "episode_id": project_id,
            "original_url": original_url,
            "local_generated_mp4_path": final_video_path
        }
        
        # Synchronous execution of Supabase python-client table insert
        response = supabase_client.table("generated_videos").insert(data).execute()
        logger.info(f"Successfully logged video project metadata to Supabase: {response}")
    except Exception as db_err:
        # Prevent database issues from breaking the upstream HTTP pipeline (architectural requirement)
        logger.error(
            f"Supabase database logger exception captured for project_id {project_id}: {str(db_err)}. "
            f"The processing pipeline completed and successfully handled this without crashing."
        )


# ==========================================
# API Routing Services
# ==========================================

@router.post(
    "/generate",
    response_model=GenerateVideoResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Core sequential orchestrator: Crawling, slicing panels dynamically, compiling mp4 compilation, and logging to postgres"
)
async def generate_webtoon_video_endpoint(payload: GenerateVideoRequest):
    """
    Performs fully dynamic end-to-end orchestration flow:
    1. Await Scrape: Triggers WebtoonScraperService to fetch and download high-quality image strips.
    2. Slices OCR: Splits downloaded image files into separate panels using manual layouts or auto-slicers.
    3. Compiles Video: Runs WebtoonVideoMaker moviepy engines to construct custom cinematic motion animations.
    4. Tracks History: Persists project references asynchronously in relational PostgreSQL records for Mathesar UI.
    """
    project_id = payload.episode_id or f"proj_{uuid.uuid4().hex[:12]}"
    url_str = str(payload.url)
    
    logger.info(f"Initiated orchestrating pipeline for project: {project_id} | URL: {url_str}")
    
    try:
        # Step 1: Await the scraper
        logger.info(f"Step 1: Scraper downloading comic elements from {url_str}")
        scraper_result = await scraper_service.execute_task(url=url_str, session_id=project_id)
        downloaded_strips = scraper_result["strips"]
        
        if not downloaded_strips:
            raise ValueError("No viable image strip downloads returned by the scraper.")

        # Step 2: Pass down the downloaded files to the OCR slicer
        logger.info(f"Step 2: Preparing OCR panels slicing. Configurations: {len(payload.panels_config)} items")
        panels_metadata = []
        
        # Output directory is created dynamically based on project_id/episode_id
        session_panels_dir = settings.TEMP_ROOT / project_id / "panels"
        session_panels_dir.mkdir(parents=True, exist_ok=True)

        if payload.panels_config:
            # Apply dynamic coordinates slicing if provided by caller
            panel_global_index = 0
            for strip_path in downloaded_strips:
                sliced_paths = slice_panels(
                    source_image_path=strip_path,
                    panels_data=payload.panels_config,
                    output_dir=str(session_panels_dir)
                )
                
                # Align coordinate slice outputs with configuration metadata
                for idx, sliced_file_path in enumerate(sliced_paths):
                    cfg = payload.panels_config[idx % len(payload.panels_config)]
                    
                    duration = cfg.get("duration") or cfg.get("duration_sec") or settings.DEFAULT_PANEL_DURATION
                    motion = cfg.get("motion") or cfg.get("motion_type") or "zoom_in"
                    speech = cfg.get("speech_text") or cfg.get("dialogue") or f"Sub-panel {panel_global_index + 1}"
                    sfx = cfg.get("sfx", "")
                    
                    panels_metadata.append({
                        "panel_index": panel_global_index,
                        "image_path": sliced_file_path,
                        "duration_sec": float(duration),
                        "motion_type": str(motion),
                        "ocr_data": {
                            "narration": speech,
                            "dialogue": speech,
                            "sfx": sfx,
                            "confidence_score": 1.0
                        }
                    })
                    panel_global_index += 1
            
            # Fall back to automated white-space slice points if custom coordinates did not yield results
            if not panels_metadata:
                logger.warning("Custom coordinate maps yielded empty results. Falling back to automatic scanner.")
                panels_metadata = await panel_service.slice_and_ocr(strip_paths=downloaded_strips, session_id=project_id)
        else:
            # Auto slice detection points
            panels_metadata = await panel_service.slice_and_ocr(strip_paths=downloaded_strips, session_id=project_id)

        # Step 3: Pass sliced panels to the Video compiler
        logger.info(f"Step 3: Initiating Ken Burns video compiler for {len(panels_metadata)} sliced panels.")
        video_filename = f"webtoon_output_{project_id}.mp4"
        
        final_video_path = await video_service.compile_video(
            panels=panels_metadata,
            audio_paths=None,
            output_filename=video_filename
        )
        
        # Build local URL mapping directly to mounted media static location
        local_video_url = f"/media/output/{video_filename}"
        logger.info(f"Streamable video compiled successfully at route path: {local_video_url}")

        # Step 4: Include an asynchronous database insertion function to log metadata
        await log_project_to_db(
            project_id=project_id,
            original_url=url_str,
            final_video_path=str(final_video_path)
        )

        # Convert panels metadata for frontend consumption
        panels_outputList = []
        for p in panels_metadata:
            img_path_str = str(p.get("image_path", ""))
            
            # Robust URL resolver
            if "media/" in img_path_str:
                parts = img_path_str.split("media/")
                web_img_url = "/media/" + parts[-1]
            elif "media" in img_path_str:
                web_img_url = "/media/" + (img_path_str.split("temp/")[-1] if "temp/" in img_path_str else img_path_str)
            else:
                web_img_url = f"/media/temp/{project_id}/panels/{Path(img_path_str).name}"

            web_img_url = web_img_url.replace("\\", "/")

            speech_text = (
                p.get("ocr_data", {}).get("dialogue") or 
                p.get("ocr_data", {}).get("narration") or 
                p.get("ocr_data", {}).get("speech_text") or
                f"Panel {p.get('panel_index', 0) + 1}"
            )
            sfx = p.get("ocr_data", {}).get("sfx") or ""
            duration = p.get("duration_sec") or p.get("duration") or 4.0
            motion_type = p.get("motion_type") or "zoom_in"
            
            panels_outputList.append(
                GeneratedPanelInfo(
                    id=int(p.get("panel_index", 0) + 1),
                    image_url=web_img_url,
                    speech_text=speech_text,
                    sfx=sfx,
                    duration=float(duration),
                    motion_type=str(motion_type)
                )
            )

        return GenerateVideoResponse(
            project_id=project_id,
            status="success",
            video_url=local_video_url,
            panels_processed=len(panels_metadata),
            message="Webtoon processing and cinematic compilation completed successfully.",
            panels=panels_outputList
        )

    except ValueError as val_err:
        logger.error(f"Validation or data structure mismatch occurred during pipeline execution: {str(val_err)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Pipeline processing validation failure: {str(val_err)}"
        )
    except Exception as general_err:
        logger.error(f"Pipeline orchestration crash handled dynamically: {str(general_err)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Uncaught pipeline engine failure: {str(general_err)}"
        )


# ==========================================
# Legacy Conversion Support (Compatibility)
# ==========================================

@router.post(
    "/process-url", 
    response_model=ProcessUrlResponse, 
    status_code=status.HTTP_201_CREATED,
    summary="Scrape Webtoon, slice panels with custom OCR margins, and compiles MP4 compilation video"
)
async def process_webtoon_url(payload: ProcessUrlRequest):
    """
    Legacy Orchestration route aligning with earlier iteration visual previews.
    """
    session_hash = payload.session_id or f"sess_{uuid.uuid4().hex[:12]}"
    url_str = str(payload.url)

    logger.info(f"Incoming conversion task for session: {session_hash}, Target: {url_str}")
    
    try:
        # Step 1: Scrape Webtoon image strips
        scraper_result = await scraper_service.execute_task(url=url_str, session_id=session_hash)
        downloaded_strips = scraper_result["strips"]
        
        # Step 2: Slice strips into individual panel squares and run virtual Vision AI OCR
        panels_metadata = await panel_service.slice_and_ocr(strip_paths=downloaded_strips, session_id=session_hash)
        
        # Step 3: Trigger video compilation sequence
        video_output_name = f"webtoon_output_{session_hash}.mp4"
        final_video_path = await video_service.compile_video(
            panels=panels_metadata,
            audio_paths=None,
            output_filename=video_output_name
        )
        
        # Format list response structures
        panels_output = []
        for p in panels_metadata:
            panels_output.append(
                PanelDetail(
                    panel_index=p["panel_index"],
                    image_path=str(p["image_path"]),
                    transcription=p["ocr_data"]["dialogue"] or p["ocr_data"]["narration"],
                    sound_effect=p["ocr_data"]["sfx"],
                    duration_sec=float(p["duration_sec"])
                )
            )

        download_url = f"/media/output/{video_output_name}"

        # Trigger DB write asynchronously
        await log_project_to_db(
            project_id=session_hash,
            original_url=url_str,
            final_video_path=str(final_video_path)
        )

        return ProcessUrlResponse(
            session_id=session_hash,
            status="completed",
            strip_count=len(downloaded_strips),
            panel_count=len(panels_metadata),
            panels=panels_output,
            video_output_path=str(final_video_path),
            video_download_url=download_url
        )

    except ValueError as ve:
        logger.error(f"Validation failure during conversion: {str(ve)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, 
            detail=f"Invalid webtoon format: {str(ve)}"
        )
    except Exception as e:
        logger.error(f"Uncaught pipeline crash occurred: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while processing webtoon: {str(e)}"
        )
