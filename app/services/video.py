import os
import gc
import uuid
import logging
import numpy as np
from pathlib import Path
from PIL import Image
from typing import List, Dict, Any, Optional
from app.config import settings

logger = logging.getLogger("webtoon_engine.video")


def compile_video(panel_data: list, output_path: str) -> str:
    """
    Core pipeline function that compiles a sequence of static comic panels with custom
    durations and dynamic 'Ken Burns' camera movements into a high-fidelity video file.

    Loads images safely, applies robust mathematical resizing and centering transformations
    frame-by-frame, and exports using the H.264 codec at 24 FPS with a standard 16:9 or 9:16 aspect ratio.
    """
    logger.info(f"Initiating MoviePy compilation on {len(panel_data)} panels. Output: {output_path}")

    # Ensure output directory exists
    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)

    try:
        from moviepy.editor import ImageClip, concatenate_videoclips
    except ImportError as err:
        logger.error("Failed to load MoviePy. Ensure moviepy is properly installed.")
        raise RuntimeError(f"MoviePy dependency is missing: {str(err)}")

    if not panel_data:
        raise ValueError("The panels data sequence is empty. Cannot compile video.")

    # Determine optimal canvas viewport aspect ratio based on the first image's orientation
    first_img_path = Path(panel_data[0].get("image_path", ""))
    if first_img_path.exists():
        with Image.open(first_img_path) as first_img:
            img_w, img_h = first_img.size
            if img_h > img_w:
                # Typical long webtoon panels fit best in vertical 9:16 portrait viewport
                target_w, target_h = 1080, 1920
                logger.info("Auto-selected 9:16 Portrait Canvas (1080x1920) for vertical webtoon panel.")
            else:
                # Desktop standard 16:9 landscape viewport
                target_w, target_h = 1920, 1080
                logger.info("Auto-selected 16:9 Landscape Canvas (1920x1080) for landscape panel.")
    else:
        # Default fallback
        target_w, target_h = 1080, 1920
        logger.info("First panel not found. Defaulting to 9:16 Portrait Canvas (1080x1920).")

    video_clips = []

    try:
        for idx, panel in enumerate(panel_data):
            img_path = Path(panel.get("image_path", ""))
            duration = float(panel.get("duration", panel.get("duration_sec", settings.DEFAULT_PANEL_DURATION)))
            motion_type = panel.get("motion_type", panel.get("motion", "zoom_in")).lower()

            if not img_path.exists():
                logger.warning(f"Panel image file path not found: {img_path}. Skipping scene [{idx}].")
                continue

            # Load image using PIL first to resize it to cover the target size with safe margin.
            # This is an essential memory and performance optimization, avoiding resizing
            # massive raw source images inside the high-frequency frame loop.
            with Image.open(img_path) as raw_p:
                src_w, src_h = raw_p.size
                
                # We need a base pre-scaled image that has 15% extra padding to prevent black borders during zooming/panning
                factor = 1.15
                base_w = int(target_w * factor)
                base_h = int(target_h * factor)
                
                # Check aspect ratios to make sure we cover the base viewport
                src_ratio = src_w / src_h
                base_ratio = base_w / base_h
                
                if src_ratio > base_ratio:
                    new_h = base_h
                    new_w = int(base_h * src_ratio)
                else:
                    new_w = base_w
                    new_h = int(base_w / src_ratio)
                
                # Perform fast high-quality bilinear or lanczos pre-scaling
                pre_scaled_img = raw_p.resize((new_w, new_h), Image.Resampling.LANCZOS)

            # Define a frame transformation function that performs math-driven crop & resize
            def make_frame_at_t(get_frame, t, current_motion=motion_type, current_dur=duration, pil_ref=pre_scaled_img):
                p = t / current_dur
                p = max(0.0, min(1.0, p))  # Clamp progress ratio
                
                w_scaled, h_scaled = pil_ref.size

                # Math equations for dynamic scale factoring
                if current_motion == "zoom_in":
                    crop_scale = 1.15 - 0.10 * p
                elif current_motion == "zoom_out":
                    crop_scale = 1.05 + 0.10 * p
                else:
                    crop_scale = 1.10  # Mild static zoom for clean boundaries on pans

                crop_w = int(target_w * crop_scale)
                crop_h = int(target_h * crop_scale)

                # Clamp values to actual image bounds
                crop_w = min(crop_w, w_scaled)
                crop_h = min(crop_h, h_scaled)

                slack_w = w_scaled - crop_w
                slack_h = h_scaled - crop_h

                # Math equations for shifting camera offsets over time
                if "pan_left" in current_motion:
                    left = int(slack_w * (1.0 - p))
                    top = slack_h // 2
                elif "pan_right" in current_motion:
                    left = int(slack_w * p)
                    top = slack_h // 2
                elif "pan_down" in current_motion:
                    left = slack_w // 2
                    top = int(slack_h * p)
                elif "pan_up" in current_motion:
                    left = slack_w // 2
                    top = int(slack_h * (1.0 - p))
                else:
                    # Centered for standard zooms
                    left = slack_w // 2
                    top = slack_h // 2

                # Enforce bounds
                left = max(0, min(left, slack_w))
                top = max(0, min(top, slack_h))

                # Crop slice & upscale to exact target frame dimensions
                frame_cropped = pil_ref.crop((left, top, left + crop_w, top + crop_h))
                frame_resized = frame_cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)
                return np.array(frame_resized)

            # Create base ImageClip representing our pre-scaled canvas
            base_arr = np.array(pre_scaled_img)
            img_clip = ImageClip(base_arr).set_duration(duration)

            # Inject the custom frame transformations function using MoviePy fl_image mechanism
            animated_clip = img_clip.transform(make_frame_at_t)
            video_clips.append(animated_clip)

        if not video_clips:
            raise ValueError("All panel assets are missing or failed to open. Cannot compile composite clip.")

        logger.info("Concatenating sequential image clips into monolithic video timeline...")
        final_clip = concatenate_videoclips(video_clips, method="compose")

        # Compile and output mp4 frame buffer to file
        final_clip.write_videofile(
            str(out_file),
            fps=24,
            codec="libx264",
            threads=max(1, (os.cpu_count() or 2) - 1),
            logger=None
        )

        final_clip.close()
        logger.info("Video generation completed successfully without errors.")

    finally:
        # Explicitly clean up all MoviePy clip handlers from memory to completely avoid leaks
        logger.info("Clearing memory resources occupied by processing pipelines...")
        for clip in video_clips:
            try:
                clip.close()
            except Exception:
                pass
        
        # Force Python's garbage collection loop
        gc.collect()

    return str(out_file)


class WebtoonVideoMaker:
    """
    Video service using MoviePy to transition static cropped panels into cinematic
    animated stories with Ken Burns (pan & zoom) transitions, custom durations,
    and synchronized audio overlay files. Maintains backwards compatibility.
    """

    async def compile_video(
        self,
        panels: List[Dict[str, Any]],
        audio_paths: Optional[List[str]] = None,
        output_filename: str = "webtoon_video_final.mp4"
    ) -> Path:
        """
        Retrieves panel information and maps it into the robust compile_video pipeline function.
        Incorporate optional localized voiceovers/soundtrack assets.
        """
        logger.info(f"Retrofitting WebtoonVideoMaker interface for compatibilities of output file {output_filename}")
        dest_path = settings.OUTPUT_ROOT / output_filename
        
        # Execute compiling
        compile_video(panel_data=panels, output_path=str(dest_path))

        # Check for post-compilation audio attachment if files are available
        if audio_paths and any(Path(p).exists() for p in audio_paths):
            logger.info("Found custom audio paths requested. Overlaying soundtracks...")
            try:
                from moviepy.editor import VideoFileClip, AudioFileClip, concatenate_audioclips
                
                # Re-load compiled clip to append audio track
                video_clip = VideoFileClip(str(dest_path))
                
                audio_objs = []
                for p in audio_paths:
                    ap = Path(p)
                    if ap.exists():
                        audio_objs.append(AudioFileClip(str(ap)))
                
                if audio_objs:
                    final_audio = concatenate_audioclips(audio_objs)
                    # Limit audio size to video duration to stay safe
                    final_audio = final_audio.set_duration(video_clip.duration)
                    video_clip = video_clip.set_audio(final_audio)
                    
                    temp_out = dest_path.with_name(f"temp_audio_{dest_path.name}")
                    video_clip.write_videofile(
                        str(temp_out),
                        fps=24,
                        codec="libx264",
                        audio_codec="aac",
                        threads=max(1, (os.cpu_count() or 2) - 1),
                        logger=None
                    )
                    
                    video_clip.close()
                    final_audio.close()
                    for au in audio_objs:
                        au.close()
                        
                    # Swap files
                    dest_path.unlink()
                    temp_out.rename(dest_path)
                    logger.info("Audio overlays applied successfully during back-compatibility step.")
            except Exception as ex:
                logger.error(f"Failed overlaying audio: {str(ex)}. Proceeding with silent/base composite file.")

        return dest_path


async def create_webtoon_video(
    image_paths: List[str],
    durations: List[float],
    movement_styles: List[str],
    audio_paths: Optional[List[str]] = None,
    output_filename: str = "webtoon_video_final.mp4"
) -> Path:
    """
    Stand-alone pipeline function for media processing.
    Converts a sequence of static image paths, durations, and movement styles
    into a continuous high-fidelity video clip sequence with optional audio overlays.
    """
    logger.info(f"Executing create_webtoon_video stand-alone pipeline for {len(image_paths)} components.")
    
    panels_payload = []
    for idx, img_path in enumerate(image_paths):
        duration = durations[idx] if idx < len(durations) else settings.DEFAULT_PANEL_DURATION
        motion = movement_styles[idx] if idx < len(movement_styles) else "zoom_in"
        
        panels_payload.append({
            "image_path": img_path,
            "duration_sec": duration,
            "motion_type": motion
        })
        
    maker = WebtoonVideoMaker()
    return await maker.compile_video(
        panels=panels_payload,
        audio_paths=audio_paths,
        output_filename=output_filename
    )
