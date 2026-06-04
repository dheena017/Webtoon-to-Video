import os
import sys
import asyncio
import logging
from pathlib import Path
import urllib.parse

# Setup clean, visible console logs
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("WebtoonDownloader")

async def parse_and_download_webtoon(url: str, output_folder: str = "webtoon_downloads"):
    """
    Spawns a sandboxed Playwright session, crawls the viewer list,
    progressively scrolls to force lazy-loaders, and stores high-res webtoon strips.
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.error("Playwright library is not installed! Run: pip install playwright && playwright install chromium")
        sys.exit(1)

    # Resolve local download directory
    dest_dir = Path(output_folder)
    dest_dir.mkdir(parents=True, exist_ok=True)
    logger.info(f"Target download folder verified: {dest_dir.resolve()}")

    async with async_playwright() as p:
        logger.info("Launching headless Chromium browser instance...")
        browser = await p.chromium.launch(headless=True)
        
        # Configure user-agent to bypass basic cloudflare/crawler-detection firewalls
        context = await browser.new_context(
            viewport={"width": 1280, "height": 1000},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        
        # Add custom headers to bypass Referer anti-leech restrictions on assets
        await context.set_extra_http_headers({
            "Referer": "https://www.webtoons.com/"
        })

        page = await context.new_page()
        
        logger.info(f"Navigating to episode Url: {url}")
        # Navigate and wait for DOM load
        await page.goto(url, wait_until="load", timeout=45000)

        # --- BYPASS POPUPS (Age / Content Advisories) ---
        # Webtoon age warnings usually have button selectors like: 
        # a#btn_accept, button.btn_confirm, button.age_gate_agree, or general confirmation buttons
        logger.info("Verifying and clearing modal gates/popup barriers...")
        try:
            # Check for standard dialog prompts & accept buttons, click if visible within 3s
            dialog_selectors = [
                "button:has-text('Confirm')",
                "a:has-text('Agree')",
                "button:has-text('Agree')",
                ".btn_confirm",
                "#btn_accept",
                "a.btn_okay"
            ]
            for selector in dialog_selectors:
                element = page.locator(selector)
                if await element.count() > 0 and await element.is_visible():
                    logger.info(f"Advisory panel found matching '{selector}'. Triggering acceptance click...")
                    await element.click()
                    await page.wait_for_timeout(1000)
                    break
        except Exception as e_warn:
            logger.debug(f"Proceeding past normal popups (no active barriers met: {str(e_warn)})")

        # --- SEQUENTIAL SMOOTH SCROLLING (Lazy Loading Bypass) ---
        # Webtoons uses deferred placeholders that only load once their bounding-boxes breach the viewport.
        logger.info("Commencing progressive scrolling sequence to load hidden strip images...")
        
        last_height = await page.evaluate("document.body.scrollHeight")
        reached_bottom = False
        scroll_attempts = 0
        max_attempts = 15 # Guard against endless scroll loops
        
        while not reached_bottom and scroll_attempts < max_attempts:
            # Scroll down by 1.2x viewport increments
            await page.evaluate("window.scrollBy(0, window.innerHeight * 1.2)")
            await page.wait_for_timeout(600) # Give frames a brief window to fetch
            
            new_height = await page.evaluate("document.body.scrollHeight")
            current_scroll_y = await page.evaluate("window.scrollY + window.innerHeight")
            
            if current_scroll_y >= new_height - 100:
                reached_bottom = True
                logger.info("Arrived successfully at footer bounds of the webtoon episode.")
            
            scroll_attempts += 1
            if scroll_attempts % 3 == 0:
                logger.info(f"Loaded scroll depth step: {scroll_attempts} / {max_attempts}...")

        # --- URL IMAGE EXTRACTION ---
        # Select imagery items loaded under the main viewer layouts (e.g. #_imageList or .viewer_lst)
        logger.info("Extracting high-resolution webtoon comic image elements...")
        
        # Locates image urls. Checks custom attributes like data-url or data-src often used to serve clean images.
        img_elements = await page.locator("img").all()
        download_urls = []
        
        for img in img_elements:
            try:
                src_candidates = [
                    await img.get_attribute("data-url"),
                    await img.get_attribute("data-src"),
                    await img.get_attribute("src")
                ]
                # Filter down to the first valid absolute HTTP url found
                src = next((s for s in src_candidates if s and s.startswith("http")), None)
                
                if src:
                    # Ignore typical layout UI noise (avatars, icons, banners, navigation badges)
                    if not any(noise in src.lower() for noise in ["logo", "avatar", "icon", "thumb", "badge", "ad_banner", "button"]):
                        download_urls.append(src)
            except Exception:
                continue

        # Filter out duplicates while retaining the original reader order
        download_urls = list(dict.fromkeys(download_urls))
        total_strips = len(download_urls)
        logger.info(f"Successfully isolated {total_strips} unique high-res panel files.")

        if total_strips == 0:
            logger.warning("No comic images matched. Image wrapper elements may use different selector namespaces.")
            await browser.close()
            return

        # --- STREAMED CHUNKED DOWNLOADS WITH AUTHS ---
        # Fetch directly inside Playwright context to leverage persistent sessions & cookies
        for index, media_url in enumerate(download_urls, start=1):
            file_extension = ".png"
            if ".jpg" in media_url or ".jpeg" in media_url:
                file_extension = ".jpg"
            elif ".webp" in media_url:
                file_extension = ".webp"
                
            panel_filename = f"episode_panel_{index:03d}{file_extension}"
            panel_dest = dest_dir / panel_filename
            
            logger.info(f"Downloading panel [{index}/{total_strips}]: {panel_filename}")
            
            try:
                # Issue HTTP request directly using the custom page frame to auto-inherit referrers & bypass captcha filters
                async with page.expect_response(media_url, timeout=12000) as response_info:
                    # Trigger a lightweight navigation or direct fetch in browser memory
                    await page.evaluate(f"fetch('{media_url}')")
                
                response = await response_info.value
                body_content = await response.body()
                
                with open(panel_dest, "wb") as f:
                    f.write(body_content)
                    
            except Exception as e_down:
                logger.warning(f"Browser-side fetch failed for panel {index}. Retrying with direct clean python request context... Detail: {str(e_down)}")
                try:
                    import httpx
                    headers = {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                        "Referer": "https://www.webtoons.com/"
                    }
                    async with httpx.AsyncClient(headers=headers, timeout=15.0) as client:
                        res = await client.get(media_url)
                        if res.status_code == 200:
                            with open(panel_dest, "wb") as f:
                                f.write(res.content)
                            logger.info(f"Recovered and downloaded panel {index} using fallback curl clients.")
                except Exception as fallback_err:
                    logger.error(f"Failed to fetch panel {index} from {media_url}: {str(fallback_err)}")

        logger.info(f"🎉 SUCCESS! Downloaded {index} panels into local directory: './{output_folder}'")
        await browser.close()

if __name__ == "__main__":
    target_url = "https://www.webtoons.com/en/drama/daytime-in-the-bunker/episode-11/viewer?title_no=9842&episode_no=11"
    
    # Run the async crawler task event loop
    asyncio.run(parse_and_download_webtoon(target_url))
