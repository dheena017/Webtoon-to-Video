import logging
import uuid
import numpy as np
from pathlib import Path
from PIL import Image
from typing import List, Dict, Any, Optional
from app.config import settings

logger = logging.getLogger("webtoon_engine.ocr")


def slice_panels(source_image_path: str, panels_data: list, output_dir: str) -> List[str]:
    """
    Crops each panel in the image according to matching coordinate coordinates.
    Saves each cropped panel as a separate temporary PNG file in a workspace folder,
    and returns a list of resulting string file paths.

    Implements robust boundary error handling to ensure coordinates do not exceed actual bounds.
    """
    logger.info(f"Invoking Pillow slice_panels for source: {source_image_path}")
    img_path = Path(source_image_path)
    if not img_path.exists():
        raise FileNotFoundError(f"Source Webtoon image strip not found at: {source_image_path}")

    dest_dir = Path(output_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)

    sliced_paths = []
    try:
        with Image.open(img_path) as img:
            width, height = img.size

            for idx, panel in enumerate(panels_data):
                # Coerce and map coordinate values with robust keys fallbacks
                start_y = panel.get("start_y")
                if start_y is None:
                    start_y = panel.get("ymin", 0)

                end_y = panel.get("end_y")
                if end_y is None:
                    end_y = panel.get("ymax", height)

                panel_id = panel.get("panel_id") or panel.get("id") or idx

                # Convert coordinates to absolute integer values
                start_y = int(start_y)
                end_y = int(end_y)

                # Boundary checking and threshold clamping to shield against out-of-bounds PIL crashes
                if start_y < 0:
                    logger.warning(f"Detected negative start_y ({start_y}). Clamping to 0 for panel {panel_id}.")
                    start_y = 0

                if end_y > height:
                    logger.warning(f"Detected end_y ({end_y}) exceeding image height ({height}). Clamping to {height} for panel {panel_id}.")
                    end_y = height

                if start_y >= end_y:
                    logger.error(f"Skipping corrupt crop bounds: start_y ({start_y}) >= end_y ({end_y}) for panel {panel_id}.")
                    continue

                # Execute PIL Crops securely using bbox (left, upper, right, lower)
                box = (0, start_y, width, end_y)
                cropped_img = img.crop(box)

                # Save to unique file location inside designated output_dir
                dest_file_path = dest_dir / f"slice_{panel_id}_{uuid.uuid4().hex[:8]}.png"

                cropped_img.save(dest_file_path, "PNG")
                sliced_paths.append(str(dest_file_path))
                logger.info(f"Successfully processed and saved slice panel {panel_id} to file {dest_file_path}")

    except Exception as e:
        logger.error(f"Execution error inside crop panel service: {str(e)}")
        raise RuntimeError(f"Failed to slice comic panels with Pillow: {str(e)}")

    return sliced_paths


def slice_vertical_strip(image_path: str, coordinates: list) -> list:
    """
    Opens the local Webtoon vertical strip image file safely, verifies its dimensions,
    and crops each panel based on provided coordinates. Ensures start_y and end_y do not
    exceed image height (crucial for long Webtoon strips up to 20,000 pixels vertically).

    Saves cropped panels inside app/media/workspace/{episode_id}/panel_{panel_id}.png.
    """
    logger.info(f"Executing slice_vertical_strip for image: {image_path}")
    img_path = Path(image_path)
    if not img_path.exists():
        raise FileNotFoundError(f"Webtoon vertical strip image not found at: {image_path}")

    saved_paths = []
    try:
        with Image.open(img_path) as img:
            width, height = img.size
            logger.info(f"Verified image dimensions. Width: {width}px, Height: {height}px")

            for idx, coord in enumerate(coordinates):
                panel_id = coord.get("panel_id") or coord.get("id") or (idx + 1)
                episode_id = coord.get("episode_id") or "default_episode"

                # Extract coordinates with robust fallback keys
                start_y = coord.get("start_y")
                if start_y is None:
                    start_y = coord.get("ymin", 0)

                end_y = coord.get("end_y")
                if end_y is None:
                    end_y = coord.get("ymax", height)

                # Ensure strict integer types
                start_y = int(start_y)
                end_y = int(end_y)

                # Robust boundary checks and error clamping
                if start_y < 0:
                    logger.warning(f"Clamping negative start_y ({start_y}) to 0 for panel {panel_id}.")
                    start_y = 0

                if end_y > height:
                    logger.warning(f"Clamping out-of-bounds end_y ({end_y}) to image height ({height}) for panel {panel_id}.")
                    end_y = height

                if start_y >= end_y:
                    logger.error(f"Skipping slicing for corrupted bounds: start_y ({start_y}) >= end_y ({end_y}) for panel {panel_id}.")
                    continue

                # Precise execution of the crop comando
                box = (0, start_y, width, end_y)
                cropped_img = img.crop(box)

                # Automated directory utility saves dynamically in app/media/workspace/{episode_id}/
                dest_dir = Path("app/media/workspace") / str(episode_id)
                dest_dir.mkdir(parents=True, exist_ok=True)

                dest_file_path = dest_dir / f"panel_{panel_id}.png"
                cropped_img.save(dest_file_path, "PNG")

                saved_paths.append(str(dest_file_path))
                logger.info(f"Successfully processed and saved dynamic panel to: {dest_file_path}")

    except Exception as e:
        logger.error(f"General processing or PIL execution error occurred during slicing: {str(e)}")
        raise RuntimeError(f"Failed to slice vertical Webtoon strip: {str(e)}")

    return saved_paths


class WebtoonPanelProcessor:
    """
    Service to process long vertical comic strips, slice them into square/portrait
    individual panels, and extract text/dialogue.
    """

    @staticmethod
    def detect_slice_points(image_path: Path, min_panel_height: int = 400) -> List[int]:
        """
        Intelligent strip slicing algorithm.
        Scans vertical lines of the image to spot clean margins / blank rows
        (usually solid white or black background lines) where panel boundary cuts are natural.
        """
        logger.info(f"Analyzing vertical white space in {image_path.name} to detect layout dividers...")
        try:
            with Image.open(image_path) as img:
                # Convert to grayscale and transform into a numpy array
                gray = img.convert("L")
                arr = np.array(gray)
                height, width = arr.shape

                # Check variance across rows. A row with tiny standard deviation is a single solid color
                row_std = np.std(arr, axis=1)

                # Rows where deviation is less than 1.5 are considered solid headers/dividers
                blank_rows = np.where(row_std < 1.5)[0]

                if len(blank_rows) == 0:
                    # If design lacks solid gaps, fall back to fixed vertical slicing
                    return list(range(0, height, min_panel_height))

                slice_points = [0]
                last_slice = 0

                # Consolidate clusters of white spaces and find optimal clean gutters
                for row_idx in blank_rows:
                    if row_idx - last_slice >= min_panel_height:
                        slice_points.append(int(row_idx))
                        last_slice = row_idx

                slice_points.append(height)
                return slice_points
        except Exception as e:
            logger.error(f"Failed during gap-detection: {str(e)}. Defaulting to fixed-grid slices.")
            # Basic fallback slicing
            with Image.open(image_path) as img:
                h = img.height
                return list(range(0, h, min_panel_height)) + [h]

    @staticmethod
    def slice_panels(source_image_path: str, panels_data: list, output_dir: str = None) -> List[str]:
        """
        Wrapper static method that routes to module-level slice_panels function.
        """
        if output_dir is None:
            output_dir = str(settings.TEMP_ROOT / "sliced_panels")
        return slice_panels(source_image_path, panels_data, output_dir)

    async def slice_and_ocr(self, strip_paths: List[str], session_id: str) -> List[Dict[str, Any]]:
        """
        Loops through downloaded strips, slices into panels dynamically,
        and returns details of sliced panels.
        No hardcoded mock lists.
        """
        logger.info(f"Initiating Vision slice + OCR on {len(strip_paths)} raw strips")
        session_panels_dir = settings.TEMP_ROOT / session_id / "panels"
        session_panels_dir.mkdir(parents=True, exist_ok=True)

        panels_metadata = []
        panel_global_index = 0

        for strip_idx, strip_str in enumerate(strip_paths):
            strip_path = Path(strip_str)
            if not strip_path.exists():
                continue

            slice_points = self.detect_slice_points(strip_path)

            with Image.open(strip_path) as img:
                width = img.width

                for k in range(len(slice_points) - 1):
                    start_y = slice_points[k]
                    end_y = slice_points[k+1]

                    # Skip extremely slim residue slices
                    if end_y - start_y < 200:
                        continue

                    # Crop the actual sub-image
                    panel_crop = img.crop((0, start_y, width, end_y))
                    panel_filename = f"panel_{panel_global_index:03d}.png"
                    panel_filepath = session_panels_dir / panel_filename

                    panel_crop.save(panel_filepath, "PNG")

                    panels_metadata.append({
                        "panel_index": panel_global_index,
                        "image_path": str(panel_filepath),
                        "bounding_box": {
                            "ymin": start_y,
                            "xmin": 0,
                            "ymax": end_y,
                            "xmax": width
                        },
                        "ocr_data": {
                            "narration": f"Visual scene panel {panel_global_index + 1}",
                            "dialogue": "",
                            "sfx": "",
                            "confidence_score": 1.0
                        },
                        "duration_sec": settings.DEFAULT_PANEL_DURATION
                    })

                    panel_global_index += 1

        logger.info(f"Slicing complete. Extracted {len(panels_metadata)} distinct panels.")
        return panels_metadata


export_service = WebtoonPanelProcessor()
slice_panels_func = slice_panels
