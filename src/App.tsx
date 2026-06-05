import React, { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  Cpu, 
  RefreshCw, 
  AlertCircle,
  Film,
  Download
} from "lucide-react";

import { 
  setEngineVolume, 
  startAmbientBackgroundMusic, 
  stopAmbientBackgroundMusic, 
  playComicSoundEffect 
} from "./audio";

import { GeneratedPanel, SAMPLE_PRESETS } from "./types";
import { parseWebtoonUrl } from "./utils";
import { AI_MODELS } from "./models";

// Child Components
import Header from "./components/Header";
import LiveScraperDeck from "./components/LiveScraperDeck";
import StoryboardTimeline from "./components/StoryboardTimeline";
import VideoMonitor from "./components/VideoMonitor";
import VolumeAndProgressPanel from "./components/VolumeAndProgressPanel";
import ImageEnhancer from "./components/ImageEnhancer";
import CropEditorModal from "./components/CropEditorModal";
import TerminalLogs from "./components/TerminalLogs";
import ModelStatusTable from "./components/ModelStatusTable";
import NotificationStack, { Notification, NotificationType } from "./components/NotificationStack";

export default function App() {
  // Input parameters
  const [targetUrl, setTargetUrl] = useState<string>("");
  // ... (add state for notifications)
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (message: string, type: NotificationType) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };
  const [voiceActor, setVoiceActor] = useState<string>("Standard Comic Narrator (Male)");
  const [musicTheme, setMusicTheme] = useState<string>("Orchestral Battle Theme");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const [selectedModel, setSelectedModel] = useState<string>(AI_MODELS[0].id);
  const [frameRate, setFrameRate] = useState<number>(24);
  const [volume, setVolume] = useState<number>(80);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Active compiled results
  const [panels, setPanels] = useState<GeneratedPanel[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [reprocessingPanelId, setReprocessingPanelId] = useState<number | null>(null);

  // Scraped images states from live URL separation
  const [scrapedImages, setScrapedImages] = useState<string[]>([]);
  const [isScraping, setIsScraping] = useState<boolean>(false);
  const [selectedScraped, setSelectedScraped] = useState<string[]>([]);
  const [stitchingIndices, setStitchingIndices] = useState<number[]>([]);

  // Tab View for Preview ("video" for MP4 player, "storyboard" for step-by-step)
  const [activePreviewTab, setActivePreviewTab] = useState<"video" | "storyboard">("video");

  // Core API states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressStatus, setProgressStatus] = useState<string>("");
  const [errorLog, setErrorLog] = useState<string | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);

  // Storyboard Preview player sub-states
  const [currentPanelIndex, setCurrentPanelIndex] = useState<number>(0);
  const [storyboardPlaying, setStoryboardPlaying] = useState<boolean>(false);
  const [playbackTime, setPlaybackTime] = useState<number>(0);

  // Image editing/cropping states
  const [editingImageIdx, setEditingImageIdx] = useState<number | null>(null);
  const [editCropTop, setEditCropTop] = useState<number>(0);
  const [editCropBottom, setEditCropBottom] = useState<number>(0);
  const [editCropLeft, setEditCropLeft] = useState<number>(0);
  const [editCropRight, setEditCropRight] = useState<number>(0);
  const [editAutoTrim, setEditAutoTrim] = useState<boolean>(true);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // References
  const playTimerRef = useRef<NodeJS.Timeout | null>(null);
  const videoPlayerRef = useRef<HTMLVideoElement | null>(null);

  // Load preview images and panels immediately when targetUrl changes (either pasted or typed or clicked)
  useEffect(() => {
    let isCurrent = true;

    if (!targetUrl.trim()) {
      setScrapedImages([]);
      setSelectedScraped([]);
      setPanels([]);
      return;
    }

    const { genre, title, episode } = parseWebtoonUrl(targetUrl);
    
    // Clear previous panels and images to start with a pristine slate
    setErrorLog(null);
    setPanels([]);
    setScrapedImages([]);
    setSelectedScraped([]);
    setCurrentPanelIndex(0);
    setPlaybackTime(0);
    setStoryboardPlaying(false);
    
    setConsoleLogs(prev => {
      const baseLogs = prev.filter(log => !log.startsWith("[Preloader]") && !log.startsWith("[Scraper]"));
      return [
        `[Scraper] Spawned live scraping task to separate strip images from: ${targetUrl}`,
        ...baseLogs
      ];
    });

    setIsScraping(true);

    fetch("/api/scrape-images", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url: targetUrl, model: selectedModel })
    })
      .then(res => {
        if (!isCurrent) throw new Error("Stale request cleanup");
        if (!res.ok) {
          return res.json().then(data => {
            throw new Error(data.message || `Server returned HTTP ${res.status}`);
          }).catch(() => {
            throw new Error(`Server returned HTTP ${res.status}`);
          });
        }
        return res.json();
      })
      .then(data => {
        if (!isCurrent) return;
        if (data.success && data.images && data.images.length > 0) {
          // Pre-apply referrer-bypass proxy so we never hit 403 hotlink errors in client browser
          const proxiedImages = data.images.map((img: string) => 
            img.startsWith('http') ? `/api/proxy-image?url=${encodeURIComponent(img)}` : img
          );
          setScrapedImages(proxiedImages);
          
          // We keep the panels list (Storyboard) completely empty upon entering/scraping the URL,
          // as requested by the user, so they can manually add images to the storyboard.
          setPanels([]);
          setCurrentPanelIndex(0);
          setPlaybackTime(0);
          setStoryboardPlaying(false);
          
          setConsoleLogs(prev => {
            const filtered = prev.filter(log => !log.startsWith("[Scraper]"));
            return [
              `[Scraper] Success! Separated ${data.total_images} continuous panel strips from active page.`,
              `[Scraper] Images loaded. Select and insert panels from the deck below.`,
              ...filtered
            ];
          });
        } else {
          const errMsg = data.message || "Connected but no native comic elements identified on page.";
          setErrorLog(errMsg);
          setScrapedImages([]);
          setPanels([]);
          setConsoleLogs(prev => {
            const filtered = prev.filter(log => !log.startsWith("[Scraper]"));
            return [
              `[Scraper Error] ${errMsg}`,
              ...filtered
            ];
          });
        }
      })
      .catch(err => {
        if (!isCurrent) return;
        console.warn("Background asset scraper failed:", err);
        const errMsg = err.message || "Failed to retrieve comic panels from the specified URL.";
        setErrorLog(errMsg);
        setScrapedImages([]);
        setPanels([]);
        setConsoleLogs(prev => {
          const filtered = prev.filter(log => !log.startsWith("[Scraper]"));
          return [
            `[Scraper Output] Service unable to access target site or retrieve images: ${errMsg}`,
            ...filtered
          ];
        });
      })
      .finally(() => {
        if (isCurrent) {
          setIsScraping(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [targetUrl]);

  // Triggering text-to-speech for the storyboard previews
  const speakDialogue = (text: string) => {
    if (!window.speechSynthesis || isMuted) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    
    // Choose appropriate voice characteristics matching metadata
    let selectedVoice = null;
    if (voiceActor.toLowerCase().includes("sultry") || voiceActor.toLowerCase().includes("female")) {
      selectedVoice = voices.find(v => v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("zira") || v.name.toLowerCase().includes("samantha"));
    } else {
      selectedVoice = voices.find(v => v.name.toLowerCase().includes("male") || v.name.toLowerCase().includes("david") || v.name.toLowerCase().includes("premium"));
    }
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    utterance.volume = volume / 100;
    utterance.rate = 0.95;
    
    window.speechSynthesis.speak(utterance);
  };

  // Trigger both voice dialogue and synthesised comic SFX on panel transitions
  const playStoryboardAudio = (panelIdx: number) => {
    const activePanel = panels[panelIdx];
    if (!activePanel) return;

    // TTS speaker narrative
    speakDialogue(activePanel.speech_text);

    // Synthesis of standard comic SFXs
    if (activePanel.sfx && !isMuted) {
      playComicSoundEffect(activePanel.sfx);
    }
  };

  // Synchronize audio engine state values instantly
  useEffect(() => {
    setEngineVolume(volume, isMuted);
  }, [volume, isMuted]);

  // Synchronize background soundtrack loops based on story choice and status
  useEffect(() => {
    if (storyboardPlaying) {
      startAmbientBackgroundMusic(musicTheme, volume, isMuted);
    } else {
      stopAmbientBackgroundMusic();
    }
    return () => {
      stopAmbientBackgroundMusic();
    };
  }, [storyboardPlaying, musicTheme]);

  // Storyboard playback simulation loop
  useEffect(() => {
    if (storyboardPlaying && panels.length > 0) {
      const activePanel = panels[currentPanelIndex];
      const stepMs = 100;

      playTimerRef.current = setTimeout(() => {
        setPlaybackTime(prev => {
          const nextTime = parseFloat((prev + 0.1).toFixed(1));
          if (nextTime >= activePanel.duration) {
            // Advance sequence
            if (currentPanelIndex < panels.length - 1) {
              const nextIdx = currentPanelIndex + 1;
              setCurrentPanelIndex(nextIdx);
              playStoryboardAudio(nextIdx);
              return 0;
            } else {
              setStoryboardPlaying(false);
              return 0;
            }
          }
          return nextTime;
        });
      }, stepMs);
    } else {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
    }

    return () => {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
    };
  }, [storyboardPlaying, currentPanelIndex, panels, isMuted, volume]);

  const toggleStoryboardPlayback = () => {
    if (panels.length === 0) return;
    if (storyboardPlaying) {
      setStoryboardPlaying(false);
      if (window.speechSynthesis) window.speechSynthesis.pause();
    } else {
      setStoryboardPlaying(true);
      playStoryboardAudio(currentPanelIndex);
    }
  };

  const resetStoryboardPlayback = () => {
    setStoryboardPlaying(false);
    setCurrentPanelIndex(0);
    setPlaybackTime(0);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    stopAmbientBackgroundMusic();
  };

  // Execute Dynamic API Pipeline Generation Call
  const handleGenerateVideo = async () => {
    if (!targetUrl.trim()) {
      setErrorLog("Please enter or select a valid Webtoon URL to initiate the process.");
      return;
    }

    setIsProcessing(true);
    setProgressStatus("Contacting pipeline orchestration...");
    setErrorLog(null);
    setConsoleLogs([
      `[Control] Initiating dynamic production pipeline request...`,
      `[Control] Webtoon Destination target: ${targetUrl}`,
      `[Control] Cinematic parameters applied -> FPS: ${frameRate} | Actor: ${voiceActor} | Audio: ${musicTheme} | Model: ${selectedModel}`
    ]);

    try {
      setProgressStatus("Scraping Webtoon strips & downloading frames...");
      setConsoleLogs(prev => [...prev, `[Scraper] Spawned crawler tasks to fetch strip images...`]);

      const requestBody = {
        url: targetUrl,
        episode_id: `wp_${Math.random().toString(36).substring(2, 8)}`,
        panels: panels,
        model: selectedModel
      };

      // Real fetch endpoint integration targeting local app server
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server responded with negative code: ${response.status}`);
      }

      const responseData = await response.json();
      
      setConsoleLogs(prev => [
        ...prev,
        `[Scraper] Retrieved vertical strip elements successfully.`,
        `[Vision OCR] Isolated ${responseData.panels_processed} panels dynamically.`,
        `[MoviePy] Compiling timeline with Pan/Zoom animations...`,
        `[MoviePy] Encoded output video: ${responseData.video_url}`
      ]);
      
      // Update dynamic states
      setPanels(responseData.panels || []);
      setVideoUrl(responseData.video_url);
      setProgressStatus("Slices mapped & MP4 master timeline generated!");
      setActivePreviewTab("video"); // Automatically default to the video view
      
    } catch (err: any) {
      console.error("Pipeline failure:", err);

      let errMessage = err.message || "An unexpected connection error occurred.";

      // Check specifically for rate limiting (429)
      if (errMessage.includes("429") || errMessage.includes("quota")) {
        errMessage = "You've exceeded your daily/request quota for the Gemini API. Please wait a short while for the quota to reset, or check your billing plan in Google AI Studio to increase your limits.";
      }

      setErrorLog(errMessage);
      setConsoleLogs(prev => [
        ...prev,
        `[Error] Exception thrown during execution: ${errMessage}`,
        `[Abort] Sequential pipeline aborted due to server interruption.`
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Submit crops & auto-trims to the backend edit route
  const handleSaveEditedImage = async () => {
    if (editingImageIdx === null) return;
    
    const originalUrl = scrapedImages[editingImageIdx];
    setIsSavingEdit(true);
    setConsoleLogs(prev => [
      `[Image Editor] Processing Crop & Auto-Trim operations on Frame #${editingImageIdx + 1}...`,
      ...prev
    ]);

    try {
      const response = await fetch("/api/edit-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: originalUrl,
          cropTop: editCropTop,
          cropBottom: editCropBottom,
          cropLeft: editCropLeft,
          cropRight: editCropRight,
          autoTrim: editAutoTrim
        })
      });

      if (!response.ok) {
        throw new Error(`Editor API returned status ${response.status}`);
      }

      const data = await response.json();
      const croppedUrl = data.url;

      // Update the scrapedImages array in place
      setScrapedImages(prev => {
        const copy = [...prev];
        copy[editingImageIdx] = croppedUrl;
        return copy;
      });

      // Update the selection state if it was selected
      setSelectedScraped(prev => {
        if (prev.includes(originalUrl)) {
          return prev.map(img => img === originalUrl ? croppedUrl : img);
        }
        return prev;
      });

      setConsoleLogs(prev => [
        `[Image Editor] Successfully cropped and trimmed Frame #${editingImageIdx + 1}!`,
        ...prev
      ]);
      setEditingImageIdx(null); // Close the modal
    } catch (err: any) {
      console.error("[Image Editor] Failed to save edits:", err);
      setConsoleLogs(prev => [
        `[Image Editor ERROR] Failed to crop Frame #${editingImageIdx + 1}: ${err.message || err}`,
        ...prev
      ]);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Submit multiple crops & auto-trims to the backend edit route
  const handleSaveMultipleCuts = async (cuts: Array<{
    cropTop: number;
    cropBottom: number;
    cropLeft: number;
    cropRight: number;
    autoTrim: boolean;
  }>) => {
    if (editingImageIdx === null || cuts.length === 0) return;
    
    const originalUrl = scrapedImages[editingImageIdx];
    setIsSavingEdit(true);
    setConsoleLogs(prev => [
      `[Image Editor] Processing Batch Multiple Cut operations (${cuts.length} cuts) on Frame #${editingImageIdx + 1}...`,
      ...prev
    ]);

    try {
      const croppedUrls: string[] = [];

      for (let i = 0; i < cuts.length; i++) {
        const cut = cuts[i];
        setConsoleLogs(prev => [
          `[Image Editor] Executing Crop Cut #${i + 1}/${cuts.length}...`,
          ...prev
        ]);
        const response = await fetch("/api/edit-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            url: originalUrl,
            cropTop: cut.cropTop,
            cropBottom: cut.cropBottom,
            cropLeft: cut.cropLeft,
            cropRight: cut.cropRight,
            autoTrim: cut.autoTrim
          })
        });

        if (!response.ok) {
          throw new Error(`Editor API for Cut #${i + 1} returned status ${response.status}`);
        }

        const data = await response.json();
        croppedUrls.push(data.url);
      }

      setScrapedImages(prev => {
        const copy = [...prev];
        copy.splice(editingImageIdx, 1, ...croppedUrls);
        return copy;
      });

      setSelectedScraped(prev => {
        if (prev.includes(originalUrl)) {
          const idx = prev.indexOf(originalUrl);
          const copy = [...prev];
          copy.splice(idx, 1, ...croppedUrls);
          return copy;
        }
        return prev;
      });

      setConsoleLogs(prev => [
        `[Image Editor] Successfully generated ${cuts.length} cropped/trimmed frames from Frame #${editingImageIdx + 1}!`,
        ...prev
      ]);
      setEditingImageIdx(null);
    } catch (err: any) {
      console.error("[Image Editor] Failed to save multiple cuts:", err);
      setConsoleLogs(prev => [
        `[Image Editor ERROR] Batch multiple crop failed: ${err.message || err}`,
        ...prev
      ]);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Vertically stitch a panel image with its successor to prevent cutoff artifacts
  const handleStitchWithNext = async (idx: number) => {
    if (idx < 0 || idx >= scrapedImages.length - 1) return;
    
    setStitchingIndices(prev => [...prev, idx]);
    setConsoleLogs(prev => [
      `[Stitcher] Merging Frame #${idx + 1} with Frame #${idx + 2} vertically...`,
      ...prev
    ]);

    try {
      const img1 = scrapedImages[idx];
      const img2 = scrapedImages[idx + 1];
      
      const response = await fetch("/api/stitch-images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ urls: [img1, img2] })
      });

      if (!response.ok) {
        throw new Error(`Stitching API returned status ${response.status}`);
      }
      
      const data = await response.json();
      const stitchedUrl = data.url;
      
      // Replace the two original frames on the deck with the single stitched result
      setScrapedImages(prev => {
        const copy = [...prev];
        copy.splice(idx, 2, stitchedUrl);
        return copy;
      });

      // Maintain selection state smoothly
      setSelectedScraped(prev => {
        const hasImg1 = prev.includes(img1);
        const hasImg2 = prev.includes(img2);
        const filtered = prev.filter(img => img !== img1 && img !== img2);
        if (hasImg1 || hasImg2) {
          return [...filtered, stitchedUrl];
        }
        return filtered;
      });

      setConsoleLogs(prev => [
        `[Stitcher] Successfully merged Frame #${idx + 1} and Frame #${idx + 2} vertically into a new seamless frame asset!`,
        ...prev
      ]);
    } catch (err: any) {
      console.error("[Stitcher] Merging failed:", err);
      setConsoleLogs(prev => [
        `[Stitcher ERROR] Webtoon slice stitching failed: ${err.message || err}`,
        ...prev
      ]);
    } finally {
      setStitchingIndices(prev => prev.filter(i => i !== idx));
    }
  };

  // Trigger webtool re-scrape / re-process trigger to recalculate tighter margins in CV/OCR engine
  const handleTriggerReprocess = async (panelId: number) => {
    const activePanel = panels.find(p => p.id === panelId);
    if (!activePanel) return;

    setReprocessingPanelId(panelId);
    const activePadding = activePanel.crop_padding !== undefined ? activePanel.crop_padding : 4;
    setConsoleLogs(prev => [
      `[OCR/CV Engine] Recalculating tighter cropping margins (padding: ${activePadding}%) & OCR vectors for Scene #${panelId}...`,
      ...prev
    ]);

    try {
      let currentUrl = activePanel.image_url;
      try {
        if (currentUrl.includes("/api/proxy-image")) {
          const urlObj = new URL(currentUrl, window.location.origin);
          urlObj.searchParams.set("reprocess_nonce", Date.now().toString());
          if (activePanel.smart_crop) {
            urlObj.searchParams.set("tighter", "true");
          }
          if (activePanel.crop_padding !== undefined) {
            urlObj.searchParams.set("crop_padding", activePanel.crop_padding.toString());
          }
          currentUrl = urlObj.pathname + urlObj.search;
        }
      } catch (e) {
        console.warn("Failed to set refresh nonce:", e);
      }

      await new Promise(resolve => setTimeout(resolve, 900));

      setPanels(prev => prev.map(p => p.id === panelId ? { ...p, image_url: currentUrl } : p));
      
      setConsoleLogs(prev => [
        `[OCR/CV Engine] Scene #${panelId} output canvas successfully re-parsed into tighter boundaries with margin padding ${activePadding}%!`,
        ...prev
      ]);
    } catch (err) {
      console.error("Reprocessing failed:", err);
    } finally {
      setReprocessingPanelId(null);
    }
  };

  const totalCalculatedDuration = panels.reduce((sum, p) => sum + p.duration, 0);

  return (
    <div id="app_root" className="min-h-screen bg-[#070709] text-neutral-100 flex flex-col justify-between selection:bg-purple-600 selection:text-white">
      
      {/* BRANDING HEADER */}
      <Header 
        isProcessing={isProcessing} 
        panels={panels} 
        totalCalculatedDuration={totalCalculatedDuration} 
      />

      {/* WORKSPACE AREA */}
      <main id="main_workspace" className="flex-1 w-full max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        
        {/* LEFT COLUMN: SOURCE INTEGRATION */}
        <div id="controls_column" className="lg:col-span-7 flex flex-col gap-8">
          
          {/* CONVERSION INPUT CARD */}
          <div id="dynamic_input_box" className="bg-neutral-900/40 rounded-3xl border border-neutral-800/80 p-8 backdrop-blur-md shadow-sm space-y-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-purple-400">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-semibold tracking-wider uppercase font-mono">Dynamic Webtoon Scraper</span>
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">Generate Video from Live Incident URL</h2>
              <p className="text-xs text-neutral-400 font-sans">
                Enter an official Webtoon viewer URL page. The backend engine will scrape the live media assets, isolate panels, run OCR transcriptions, and compile the cinematic rendering dynamically.
              </p>
            </div>

              {/* URL Inputs + Model Selection */}
              <div className="space-y-4">
                <div className="relative group">
                  <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 opacity-20 blur group-focus-within:opacity-40 transition-opacity duration-300" />
                  <input 
                    id="target_url_input"
                    type="url" 
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value.trim())}
                    placeholder="Paste Webtoon episode viewer URL (e.g. webtoons.com/...)"
                    className="relative w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3.5 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-purple-500 transition-colors"
                  />
                </div>
              </div>

              {/* CLICKABLE PRESET BADGES */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-neutral-500">
                <span className="font-bold">Quick Presets:</span>
                {SAMPLE_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setTargetUrl(preset.url);
                      setConsoleLogs(prev => [
                        `[GUI] Loaded test sample preset for ${preset.name}`,
                        ...prev
                      ]);
                    }}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-sans font-medium transition-all cursor-pointer ${
                      targetUrl === preset.url
                        ? "bg-purple-950/40 border-purple-500 text-purple-300"
                        : "bg-neutral-950 border-neutral-850 text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* ERROR NOTIFICATION PANEL */}
            {errorLog && (
              <div className="bg-red-950/30 border border-red-800/80 rounded-xl p-4 flex gap-3 text-red-200 animate-fade-in">
                <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1 font-sans">
                  <p className="font-bold">Pipeline Connection Issue</p>
                  <p className="text-red-300 leading-relaxed">{errorLog}</p>
                </div>
              </div>
            )}
          </div>

          {/* SEPARATED IMAGE STRIPS GALLERY */}
          <LiveScraperDeck
            scrapedImages={scrapedImages}
            isScraping={isScraping}
            selectedScraped={selectedScraped}
            setSelectedScraped={setSelectedScraped}
            setScrapedImages={setScrapedImages}
            stitchingIndices={stitchingIndices}
            setConsoleLogs={setConsoleLogs}
            panels={panels}
            setPanels={setPanels}
            currentPanelIndex={currentPanelIndex}
            handleStitchWithNext={handleStitchWithNext}
            setEditingImageIdx={setEditingImageIdx}
            setEditCropTop={setEditCropTop}
            setEditCropBottom={setEditCropBottom}
            setEditCropLeft={setEditCropLeft}
            setEditCropRight={setEditCropRight}
            setEditAutoTrim={setEditAutoTrim}
            addNotification={addNotification}
          />

          {/* ACTIVE QUEUE / LIVE PIPELINE PROGRESS */}
          {isProcessing && (
            <div id="pipeline_status_card" className="bg-neutral-900/90 rounded-2xl border border-neutral-800 p-6 space-y-5 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-purple-400 animate-spin" />
                  <span className="font-bold text-sm text-white">Pipeline executing asynchronously</span>
                </div>
                <span className="text-xs font-mono text-purple-400 font-semibold">Live status</span>
              </div>

              <div className="bg-neutral-950/80 px-4 py-3 rounded-xl border border-neutral-800/80 text-xs font-mono text-neutral-200">
                <span className="text-purple-400 font-bold">&gt;&gt;</span> {progressStatus}
              </div>

              {/* Progress animation track */}
              <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden border border-neutral-850">
                <div className="bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-600 h-full w-2/3 rounded-full animate-infinite-scroll" />
              </div>
            </div>
          )}

          {/* REAL-TIME LOG MONITOR */}
          {consoleLogs.length > 0 && (
            <TerminalLogs consoleLogs={consoleLogs} setConsoleLogs={setConsoleLogs} />
          )}

          {/* DYNAMIC STORYBOARD TIMELINE DECK */}
          <StoryboardTimeline
            panels={panels}
            setPanels={setPanels}
            currentPanelIndex={currentPanelIndex}
            setCurrentPanelIndex={setCurrentPanelIndex}
            activePreviewTab={activePreviewTab}
            setActivePreviewTab={setActivePreviewTab}
            setPlaybackTime={setPlaybackTime}
            hasScrapedImages={scrapedImages.length > 0}
          />

        {/* RIGHT COLUMN: INTEGRATED CINEMA PLAYER */}
        <div id="cinema_column" className="lg:col-span-5 flex flex-col gap-6 sticky top-24">
          <VideoMonitor
            activePreviewTab={activePreviewTab}
            setActivePreviewTab={setActivePreviewTab}
            videoUrl={videoUrl}
            panels={panels}
            aspectRatio={aspectRatio}
            videoPlayerRef={videoPlayerRef}
            currentPanelIndex={currentPanelIndex}
            playbackTime={playbackTime}
            reprocessingPanelId={reprocessingPanelId}
          />

          {/* PLAYBACK CONTROLLER ACCESSORIES FOR STORYBOARD PREVIEW */}
          {activePreviewTab === "storyboard" && panels.length > 0 && (
            <VolumeAndProgressPanel
              panels={panels}
              currentPanelIndex={currentPanelIndex}
              playbackTime={playbackTime}
              storyboardPlaying={storyboardPlaying}
              toggleStoryboardPlayback={toggleStoryboardPlayback}
              resetStoryboardPlayback={resetStoryboardPlayback}
              isMuted={isMuted}
              setIsMuted={setIsMuted}
              volume={volume}
              setVolume={setVolume}
            />
          )}

          {/* VISUAL IMAGE ENHANCER MATRIX */}
          {panels.length > 0 && panels[currentPanelIndex] && (
            <ImageEnhancer
              panels={panels}
              setPanels={setPanels}
              currentPanelIndex={currentPanelIndex}
              setCurrentPanelIndex={setCurrentPanelIndex}
              setConsoleLogs={setConsoleLogs}
            />
          )}

          <ModelStatusTable />

          {/* METADATA RENDER MATRIX */}
          <div id="video_metadata_panel" className="bg-neutral-900/40 rounded-2xl border border-neutral-800/80 p-5 space-y-3.5">
            <h4 className="font-bold text-xs text-neutral-400 uppercase tracking-widest font-mono">Output Specifications</h4>
            
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-xs text-neutral-300">
              <div className="flex items-center justify-between border-b border-neutral-800/50 pb-2">
                <span className="text-neutral-500 font-sans">Codec</span>
                <span className="font-mono font-semibold">H.264 (MP4 Wrapper)</span>
              </div>
              <div className="flex items-center justify-between border-b border-neutral-800/50 pb-2">
                <span className="text-neutral-500 font-sans">Soundtrack</span>
                <span className="font-sans font-semibold text-purple-400 truncate max-w-[124px] block" title={musicTheme}>
                  {musicTheme}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-neutral-800/50 pb-2 col-span-2">
                <span className="text-neutral-500 font-sans">Active Speaker</span>
                <span className="font-sans font-semibold text-purple-400">{voiceActor}</span>
              </div>
              {videoUrl && (
                <div className="flex items-center justify-between col-span-2 text-emerald-400 font-mono text-[11px] bg-emerald-950/20 border border-emerald-900/35 px-2.5 py-1.5 rounded-lg">
                  <span>Compiled Output URL:</span>
                  <span className="underline select-all truncate max-w-[200px] font-bold">{videoUrl}</span>
                </div>
              )}
            </div>

            {/* Download MP4 Button */}
            {videoUrl && (
              <div className="pt-2">
                <a
                  href={videoUrl}
                  download={`webtoon_cinemamaster_${Math.random().toString(36).substring(2, 6)}.mp4`}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs py-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer select-none shadow-lg shadow-purple-900/30 font-sans"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Master MP4 File</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer id="footer_pane" className="border-t border-neutral-850 bg-neutral-950/20 py-6 text-center text-xs text-neutral-500">
        <p className="font-mono">Webtoon-to-Video compilation dashboard &bull; Real-time Scraper Integration</p>
      </footer>

      {/* IMAGE CROPPER & BACKGROUND TRIM MODAL */}
      <CropEditorModal
        editingImageIdx={editingImageIdx}
        setEditingImageIdx={setEditingImageIdx}
        editCropTop={editCropTop}
        setEditCropTop={setEditCropTop}
        editCropBottom={editCropBottom}
        setEditCropBottom={setEditCropBottom}
        editCropLeft={editCropLeft}
        setEditCropLeft={setEditCropLeft}
        editCropRight={editCropRight}
        setEditCropRight={setEditCropRight}
        editAutoTrim={editAutoTrim}
        setEditAutoTrim={setEditAutoTrim}
        scrapedImages={scrapedImages}
        setScrapedImages={setScrapedImages}
        isSavingEdit={isSavingEdit}
        handleSaveEditedImage={handleSaveEditedImage}
        handleSaveMultipleCuts={handleSaveMultipleCuts}
        setConsoleLogs={setConsoleLogs}
        addNotification={addNotification}
      />
      <NotificationStack notifications={notifications} removeNotification={removeNotification} />
    </div>
  );
}
