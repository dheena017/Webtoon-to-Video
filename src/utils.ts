import { GeneratedPanel } from "./types";

// Removes any webtoons language/region code (like en, fr, es, th, id, zh-hans etc.) from the URL path to keep it region-free
export function stripRegionFromUrl(urlStr: string): string {
  if (!urlStr) return "";
  let workingUrl = urlStr.trim();
  if (workingUrl && !/^https?:\/\//i.test(workingUrl)) {
    workingUrl = "https://" + workingUrl;
  }
  try {
    const urlObj = new URL(workingUrl);
    const parts = urlObj.pathname.split('/').filter(Boolean);
    if (parts.length > 0) {
      const rxRegion = /^[a-z]{2}(-[a-z]{2,4})?$/i;
      if (rxRegion.test(parts[0])) {
        parts.shift(); // discard language/region prefix
        urlObj.pathname = '/' + parts.join('/');
      }
    }
    // Return with original prefix style if user didn't enter https yet
    let result = urlObj.toString();
    if (!urlStr.trim().startsWith("http://") && !urlStr.trim().startsWith("https://")) {
      result = result.replace(/^https?:\/\//i, "");
    }
    return result;
  } catch {
    return urlStr;
  }
}

// Robust path parser for dynamic Webtoon URLs to extract Title, Genre, and Chapter without any hardcoding
export function parseWebtoonUrl(urlStr: string) {
  try {
    const cleanedUrl = stripRegionFromUrl(urlStr);
    const urlObj = new URL(cleanedUrl.startsWith("http") ? cleanedUrl : "https://" + cleanedUrl);
    const parts = urlObj.pathname.split('/').filter(Boolean);
    
    let genre = "general";
    let title = "Webtoon Comic";
    let episode = "Intro Chapter";

    if (parts.length >= 2) {
      genre = parts[0] || "general";
      title = parts[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      if (parts[2] && parts[2] !== 'viewer') {
        episode = parts[2].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      }
    } else if (parts.length === 1) {
      title = parts[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
    return { genre, title, episode };
  } catch {
    return { genre: "general", title: "Custom Storyboard", episode: "Dynamic Chapter" };
  }
}

// Compile custom image filters dynamically for instant in-browser live rendering
export function getPanelFilterStyle(panel: GeneratedPanel) {
  if (!panel) return "none";
  let b = panel.brightness !== undefined ? panel.brightness : 100;
  let c = panel.contrast !== undefined ? panel.contrast : 100;
  let s = panel.saturation !== undefined ? panel.saturation : 100;
  let gr = panel.grayscale ? "grayscale(100%)" : "";

  let presetFilter = "";
  if (panel.filter_preset === "anime_vibrant") {
    // Punchy vibrance, glowing highlights
    presetFilter = "saturate(135%) contrast(115%) brightness(105%)";
  } else if (panel.filter_preset === "cinematic_drama") {
    // Deep dynamic range, vintage grading shadow play
    presetFilter = "contrast(130%) brightness(90%) saturate(90%)";
  } else if (panel.filter_preset === "hdr_clear") {
    // Sharp contrasts, vivid illumination
    presetFilter = "contrast(120%) brightness(105%) saturate(115%)";
  } else if (panel.filter_preset === "vintage_warm") {
    // Golden warm skin sepia tones and sunlit nostalgia
    presetFilter = "sepia(22%) saturate(112%) contrast(105%) brightness(102%)";
  } else if (panel.filter_preset === "neon_cyber") {
    // Intense magenta shift, saturated cyberpunk glow
    presetFilter = "hue-rotate(15deg) saturate(155%) contrast(112%)";
  }

  return `brightness(${b}%) contrast(${c}%) saturate(${s}%) ${gr} ${presetFilter}`.trim();
}
