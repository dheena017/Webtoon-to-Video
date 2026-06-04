import os
import logging
import tempfile
from typing import List, Optional
import edge_tts
from pydub import AudioSegment
from pydub.effects import speedup

logger = logging.getLogger("webtoon_engine.audio")

async def generate_panel_audio(
    dialogue_list: List[str],
    target_duration: float,
    output_path: str,
    voice: Optional[str] = "en-US-GuyNeural"
) -> str:
    """
    Generates dynamic text-to-speech elements for an ordered sequence of storyboard dialogue transcripts,
    concatenates all sentences into a coherent wave, and applies advanced pitch-preserved time-stretching or
    silence-padding mechanisms using pydub to match the target duration perfectly.

    Args:
        dialogue_list (List[str]): Extracted dialog items to encode.
        target_duration (float): Exact target duration of the audio in seconds.
        output_path (str): File path to save the completed MP3/WAV segment.
        voice (Optional[str]): Standard edge-tts voice code.

    Returns:
        str: Absolute destination where the master timeline panel audio has been encoded.
    """
    if not dialogue_list or all(not text.strip() for text in dialogue_list):
        # Gracefully generate complete ambient silence if there is no audio transcript specified
        logger.warning(f"Empty dialogue list encountered for output: {output_path}. Defaulting to pure silence card.")
        silence_segment = AudioSegment.silent(duration=int(target_duration * 1000))
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        silence_segment.export(output_path, format="mp3")
        return output_path

    target_duration_ms = int(target_duration * 1000)
    temp_dir = tempfile.gettempdir()
    temp_files = []

    try:
        # Phase 1: Generate individual audio strips asynchronously
        for idx, text in enumerate(dialogue_list):
            if not text.strip():
                continue
            
            # Escape or skip empty texts
            temp_file_path = os.path.join(temp_dir, f"dialog_segment_{uuid_hex()}_{idx}.mp3")
            temp_files.append(temp_file_path)

            logger.info(f"Generating voice file for segment [{idx}]: '{text[:30]}...' via voice: {voice}")
            communicate = edge_tts.Communicate(text, voice or "en-US-GuyNeural")
            await communicate.save(temp_file_path)

        # Phase 2: Loading & Concatenating files using defensive format normalizer
        combined_audio = AudioSegment.empty()
        for idx, file_path in enumerate(temp_files):
            if not os.path.exists(file_path) or os.path.getsize(file_path) == 0:
                continue

            segment = AudioSegment.from_file(file_path, format="mp3")
            # Normalize tracks sample rate & active channels to avoid standard concat glitches
            normalized_seg = segment.set_frame_rate(44100).set_channels(2)
            
            # If combining multiple segments, introduce a short natural 100ms pause, except for last
            combined_audio += normalized_seg
            if idx < len(temp_files) - 1:
                combined_audio += AudioSegment.silent(duration=100)

        current_duration_ms = len(combined_audio)
        logger.info(f"Concat summary: initial raw voice length = {current_duration_ms}ms, target = {target_duration_ms}ms")

        # Phase 3: Alignment to target_duration
        if current_duration_ms == 0:
            logger.warning("Combined audio yielded zero duration. Exporting silence.")
            final_audio = AudioSegment.silent(duration=target_duration_ms)
        elif current_duration_ms > target_duration_ms:
            # Seamless speedup without pitch shifting using pydub.effects
            playback_speed = float(current_duration_ms) / float(target_duration_ms)
            logger.info(f"Action: Audio is longer than target. Compressing seamlessly with speedup factor: {playback_speed:.2f}x")
            
            # Pydub speedup effect typically expects playback_speed > 1.0
            if playback_speed > 1.0:
                try:
                    # speedup is pitch-preserved
                    final_audio = speedup(combined_audio, playback_speed=playback_speed)
                except Exception as stretch_err:
                    logger.error(f"Pydub speedup failed, falling back to direct curtailing: {str(stretch_err)}")
                    final_audio = combined_audio
            else:
                final_audio = combined_audio

            # Final precise microsecond crop
            final_audio = final_audio[:target_duration_ms]
        else:
            # Padding with tailing organic silence
            silence_needed_ms = target_duration_ms - current_duration_ms
            logger.info(f"Action: Audio is shorter than target. Appending {silence_needed_ms}ms of silence.")
            silence_padding = AudioSegment.silent(duration=silence_needed_ms)
            final_audio = combined_audio + silence_padding

        # Ensure absolute precision matching target_duration to avoid downstream video sync creep
        final_audio = final_audio[:target_duration_ms]

        # Phase 4: Export finished compilation stream
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        final_audio.export(output_path, format="mp3")
        logger.info(f"Audio compilation saved successfully at: {output_path} with final length {len(final_audio)}ms")

    except Exception as general_err:
        logger.error(f"Audio Engine pipeline failure: {str(general_err)}", exc_info=True)
        # Fallback safeguard: Output pure silence corresponding to expected duration so as to not break moviepy compiler
        try:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            fallback_silence = AudioSegment.silent(duration=target_duration_ms)
            fallback_silence.export(output_path, format="mp3")
            logger.info(f"Safeguard silent master audio exported safely to: {output_path}")
        except Exception as write_fallback_err:
            logger.critical(f"Fatal fallback sound export failure: {str(write_fallback_err)}")
            raise general_err
    finally:
        # Clean down any generated disk resources mapping temp MP3 files
        for f in temp_files:
            try:
                if os.path.exists(f):
                    os.remove(f)
            except Exception as rm_err:
                logger.debug(f"Failed clearing temporary fragment tracking block {f}: {str(rm_err)}")

    return output_path

def uuid_hex() -> str:
    import uuid
    return uuid.uuid4().hex[:8]
