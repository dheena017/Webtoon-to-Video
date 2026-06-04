import os
import uuid
import logging
import httpx
from bs4 import BeautifulSoup
from pathlib import Path
from typing import List, Dict, Any
from app.config import settings

logger = logging.getLogger("webtoon_engine.scraper")

class WebtoonScraperService:
    """
    Scraper Service to extract and download webtoon strips.
    Supports standard BeautifulSoup parser for static pages with a fallback/alternative 
    Playwright implementation for Javascript-heavy dynamic rendering (like Naver/Webtoon lazylenders).
    """

    @staticmethod
    def _sanitize_filename(url: str, index: int) -> str:
        """Generates a clean file name preserving the extension or defaulting to png."""
        ext = ".png"
        if ".jpg" in url or ".jpeg" in url:
            ext = ".jpg"
        elif ".webp" in url:
            ext = ".webp"
        return f"strip_{index:03d}{ext}"

    async def download_image(self, img_url: str, download_dir: Path, index: int) -> Path:
        """Downloads a single image to a specified directory with clean retry logic."""
        filename = self._sanitize_filename(img_url, index)
        dest_path = download_dir / filename
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.webtoons.com/" # Bypasses referral checking anti-leeching mechanisms
        }

        async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=15.0) as client:
            try:
                response = await client.get(img_url)
                response.raise_for_status()
                with open(dest_path, "wb") as f:
                    f.write(response.content)
                logger.info(f"Downloaded strip to {dest_path}")
                return dest_path
            except Exception as e:
                logger.error(f"Failed to download image from {img_url}: {str(e)}")
                raise RuntimeError(f"Failed to fetch image item {index}: {str(e)}")

    async def scrape_via_beautifulsoup(self, url: str) -> List[str]:
        """
        Scrapes webtoon image URLs using requests and BeautifulSoup.
        Ideal for servers with standard static elements or bypassing lighter scrapers.
        """
        logger.info(f"Initiating BS4 scraping for URL: {url}")
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        
        async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=10.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            
        soup = BeautifulSoup(response.text, "html.parser")
        image_urls = []

        # Generic webtoon container detections (class names commonly matching Naver, Webtoons.com, Tapas, copy-pastes)
        # 1. Webtoons.com reader: <div class="viewer_lst"> -> <img src="...">
        viewer = soup.find(class_="viewer_lst") or soup.find(id="_imageList") or soup.find(class_="episode-view")
        
        if viewer:
            imgs = viewer.find_all("img")
            for img in imgs:
                src = img.get("data-url") or img.get("data-src") or img.get("src")
                if src and src.startswith("http"):
                    image_urls.append(src)
        else:
            # Fallback scan across any image with typical class/ID structures
            for img in soup.find_all("img"):
                cls = "".join(img.get("class", []))
                parent_cls = "".join(img.parent.get("class", [])) if img.parent else ""
                
                # Filter out small UI icons, logos, and scripts
                if any(x in (cls + parent_cls).lower() for x in ["comic", "episode", "strip", "viewer", "canvas"]):
                    src = img.get("data-src") or img.get("src")
                    if src and src.startswith("http") and not any(ic in src.lower() for ic in ["logo", "icon", "thumb", "badge"]):
                        image_urls.append(src)
                        
        # Ultimate fallback - grab images inside specific containers regardless of names
        if not image_urls:
            for img in soup.find_all("img"):
                src = img.get("src") or img.get("data-src")
                if src and "webtoon" in src.lower() and src.startswith("http"):
                    image_urls.append(src)

        return image_urls

    async def scrape_via_playwright(self, url: str) -> List[str]:
        """
        Scrapes dynamic, lazy-loaded webtoons using playwright browser automation.
        Scrolls through the page to load offscreen images.
        """
        logger.info(f"Initiating Playwright headless scraping for URL: {url}")
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            logger.warning("Playwright not installed or configured. Directing fallback to BeautifulSoup.")
            return await self.scrape_via_beautifulsoup(url)

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=settings.PLAYWRIGHT_HEADLESS)
            context = await browser.new_context(
                viewport={"width": 1280, "height": 800},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = await context.new_page()
            
            # Go to webtoon URL
            await page.goto(url, wait_until="load", timeout=settings.PLAYWRIGHT_TIMEOUT_MS)
            
            # Scroll down slowly to trigger all lazy-loaded images
            logger.info("Scrolling down webtoon strip to trigger lazy loading...")
            for i in range(5):
                await page.evaluate("window.scrollBy(0, window.innerHeight * 1.5)")
                await page.wait_for_timeout(800)
                
            # Extract image elements
            img_elements = await page.locator("img").all()
            image_urls = []
            
            for index, img in enumerate(img_elements):
                src = await img.get_attribute("data-url") or \
                      await img.get_attribute("data-src") or \
                      await img.get_attribute("src")
                
                if src and src.startswith("http"):
                    # Exclude typical user avatars, logos, social bookmarks
                    if not any(noise in src.lower() for noise in ["avatar", "logo", "icon", "banner", "footer"]):
                        image_urls.append(src)
                        
            await browser.close()
            return list(dict.fromkeys(image_urls)) # Remove duplicates preserving order

    async def execute_task(self, url: str, session_id: str) -> Dict[str, Any]:
        """
        Orchestrates scraping images. Creates a clean temp directory, 
        attempts extraction, and downloads discovered strips sequentially.
        """
        session_temp_dir = settings.TEMP_ROOT / session_id
        session_temp_dir.mkdir(parents=True, exist_ok=True)
        
        image_urls = []
        try:
            # Attempt Playwright first as Webtoons rely heavily on JS/Lazy loading
            image_urls = await self.scrape_via_playwright(url)
        except Exception as e:
            logger.warning(f"Playwright scrolling extraction failed ({str(e)}). Falling back to BeautifulSoup...")
            try:
                image_urls = await self.scrape_via_beautifulsoup(url)
            except Exception as e_bs:
                raise RuntimeError(f"Scraper pipeline failed completely: {str(e_bs)}")

        if not image_urls:
            raise ValueError("No matching webtoon comic strips or panel elements found on the target webpage.")

        logger.info(f"Discovered {len(image_urls)} strip images. Commencing downloads...")
        downloaded_paths = []
        
        for i, img_url in enumerate(image_urls[:20]): # Limit to first 20 strips to prevent token/computation bloat
            try:
                dest_file = await self.download_image(img_url, session_temp_dir, i)
                downloaded_paths.append(str(dest_file))
            except Exception as e_dl:
                logger.warning(f"Skipped downloading strip index {i}: {str(e_dl)}")

        return {
            "session_id": session_id,
            "strip_count": len(downloaded_paths),
            "strips": downloaded_paths
        }
