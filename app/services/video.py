import os
import logging
from typing import List, Dict, Any

from moviepy.config import change_settings
try:
    from moviepy.editor import ImageClip, AudioFileClip, concatenate_videoclips
except ImportError as e:
    from moviepy.video.VideoClip import ImageClip
    from moviepy.audio.io.AudioFileClip import AudioFileClip
    from moviepy.video.compositing.concatenate import concatenate_videoclips

logger = logging.getLogger("webtoon_engine.video")

async def compile_video(panel_data: List[Dict[str, Any]], output_path: str) -> str:
    """
    Cinematically combines downloaded manhwa frames, binds high-fidelity TTS voiceover
    tracks matching timing and margins, and produces a highly polished MP4 video file.

    Args:
        panel_data (List[Dict[str, Any]]): 
            Each dictionary contains:
                - 'image_path' (str): Physical path to the panel screenshot.
                - 'audio_path' (str): Location of the generated voice mp3 file.
                - 'duration' (float): Nominal duration fallback in seconds.
                - 'caption' (str, optional): Dialogue caption text for logging/subtitles.
        output_path (str): File destination where the video timeline should be written.

    Returns:
        str: Absolute system path of the completed master MP4 asset.
    """
    logger.info(f"Compiling cinematic timeline with {len(panel_data)} scenes.")
    clips = []
    
    try:
        for idx, panel in enumerate(panel_data):
            image_path = panel.get("image_path")
            audio_path = panel.get("audio_path")
            nominal_duration = panel.get("duration", 5.0)

            if not image_path or not os.path.exists(image_path):
                logger.warning(f"Image path missing or not found: {image_path}. Skipping slot {idx}.")
                continue

            # Load the individual image frame
            img_clip = ImageClip(image_path)

            audio_clip = None
            if audio_path and os.path.exists(audio_path):
                try:
                    logger.info(f"Loading dynamic voice narrative from track: {audio_path}")
                    # STRICT REQUIREMENT: Load corresponding .mp3 file using MoviePy's AudioFileClip
                    audio_clip = AudioFileClip(audio_path)
                    
                    # STRICT REQUIREMENT: Set the audio of the ImageClip to this AudioFileClip using .set_audio()
                    img_clip = img_clip.set_audio(audio_clip)
                    
                    # STRICT REQUIREMENT: Ensure the video duration precisely matches the audio duration
                    img_clip = img_clip.set_duration(audio_clip.duration)
                    logger.info(f"Bound panel {idx} duration to match voice track: {audio_clip.duration:.2f}s")
                except Exception as audio_err:
                    logger.error(f"Failed to integrate audio track at {audio_path}: {str(audio_err)}")
                    # Use fallback nominal duration
                    img_clip = img_clip.set_duration(nominal_duration)
            else:
                logger.warning(f"Audio file {audio_path} not found or undefined. Applying fallback nominal duration of {nominal_duration}s.")
                img_clip = img_clip.set_duration(nominal_duration)

            # Apply standard viewport resizing to ensure consistent aspect ratios (e.g. 1080p full-HD)
            img_clip = img_clip.resize(newsize=(1920, 1080))
            clips.append(img_clip)

        if not clips:
            raise ValueError("Zero valid frames compiled. All target images or audio were corrupted or missing.")

        # Conjoin the finished clips together on the primary sequence
        logger.info("Concatenating individual video clips into final narrative track...")
        final_video_clip = concatenate_videoclips(clips, method="compose")

        # Create output directory if nonexistent
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Write compilation to MP4 using standard professional rendering defaults
        logger.info(f"Rendering master MP4 payload to: {output_path}")
        final_video_clip.write_videofile(
            output_path,
            fps=24,
            codec="libx264",
            audio_codec="aac",
            temp_audiofile="temp-audio.m4a",
            remove_temp=True,
            logger=None
        )

        # Explicitly close all reader assets to release locks and native memory/channels
        final_video_clip.close()
        for c in clips:
            c.close()

        logger.info(f"Master cinematic rendering finished successfully: {output_path}")
        return output_path

    except Exception as compile_err:
        logger.critical(f"Cinematic compilation failed: {str(compile_err)}", exc_info=True)
        raise compile_err
