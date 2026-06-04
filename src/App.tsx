import React, { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  Film, 
  Cpu, 
  Layers, 
  Volume2, 
  Play, 
  Pause, 
  RotateCcw, 
  Download, 
  CheckCircle2, 
  Settings2, 
  ArrowRight, 
  Image as ImageIcon, 
  Mic, 
  Music, 
  Tv, 
  RefreshCw, 
  Edit2, 
  Clock, 
  Sliders, 
  VolumeX, 
  Info,
  ChevronRight,
  Eye,
  Activity,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// interface for parsed dynamic panels from backend
interface GeneratedPanel {
  id: number;
  image_url: string;
  speech_text: string;
  sfx: string;
  duration: number;
  motion_type: string;
}

// Optimized Sample presets for convenient testing (strictly URLs only, no hardcoded panels)
const SAMPLE_PRESETS = [
  {
    name: "Solo Leveling",
    url: "https://www.webtoons.com/en/action/solo-leveling/episode-1/viewer?title_no=3822",
  },
  {
    name: "Lore Olympus",
    url: "https://www.webtoons.com/en/romance/lore-olympus/episode-1/viewer?title_no=1210",
  },
  {
    name: "Tower of God",
    url: "https://www.webtoons.com/en/fantasy/tower-of-god/season-1-ep-0/viewer?title_no=95",
  }
];

export default function App() {
  // Input parameters
  const [targetUrl, setTargetUrl] = useState<string>("");
  const [voiceActor, setVoiceActor] = useState<string>("Liam - Deep Cinematic Narration");
  const [musicTheme, setMusicTheme] = useState<string>("Orchestral Battle Theme");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const [frameRate, setFrameRate] = useState<number>(24);
  const [volume, setVolume] = useState<number>(80);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Active compiled results
  const [panels, setPanels] = useState<GeneratedPanel[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

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

  // References
  const playTimerRef = useRef<NodeJS.Timeout | null>(null);
  const videoPlayerRef = useRef<HTMLVideoElement | null>(null);

  // Triggering text-to-speech for the storyboard previews
  const speakDialogue = (text: string) => {
    if (!window.speechSynthesis || isMuted) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    
    // Choose appropriate voice characteristics matching metadata
    let selectedVoice = null;
    if (voiceActor.includes("Evelyn") || voiceActor.includes("Sophia")) {
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
              speakDialogue(panels[nextIdx].speech_text);
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
      speakDialogue(panels[currentPanelIndex].speech_text);
    }
  };

  const resetStoryboardPlayback = () => {
    setStoryboardPlaying(false);
    setCurrentPanelIndex(0);
    setPlaybackTime(0);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
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
      `[Control] Cinematic parameters applied -> FPS: ${frameRate} | Actor: ${voiceActor} | Audio: ${musicTheme}`
    ]);

    try {
      setProgressStatus("Scraping Webtoon strips & downloading frames...");
      setConsoleLogs(prev => [...prev, `[Scraper] Spawned crawler tasks to fetch strip images...`]);

      const requestBody = {
        url: targetUrl,
        episode_id: `wp_${Math.random().toString(36).substring(2, 8)}`,
        panels_config: [] // Allow automate page/frame slice analysis dynamically
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
      const errMessage = err.message || "An unexpected connection error occurred. Please verify backend state.";
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

  // Edit individual speech content dynamically in state
  const handleModifySpeechText = (panelId: number, text: string) => {
    setPanels(prev => prev.map(p => p.id === panelId ? { ...p, speech_text: text } : p));
  };

  // Adjust motion type
  const handleModifyMotion = (panelId: number, motionVal: string) => {
    setPanels(prev => prev.map(p => p.id === panelId ? { ...p, motion_type: motionVal } : p));
  };

  // Adjust duration
  const handleModifyDuration = (panelId: number, durVal: number) => {
    setPanels(prev => prev.map(p => p.id === panelId ? { ...p, duration: durVal } : p));
  };

  const totalCalculatedDuration = panels.reduce((sum, p) => sum + p.duration, 0);
  const activeStoryboardPanel = panels[currentPanelIndex] || null;

  return (
    <div id="app_root" className="min-h-screen bg-[#070709] text-neutral-100 flex flex-col justify-between selection:bg-purple-600 selection:text-white">
      
      {/* BRANDING HEADER */}
      <header id="header_pane" className="border-b border-neutral-800/80 bg-neutral-950/45 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-900/40">
              <Film className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xl tracking-tight text-white font-sans">
                  Webtoon<span className="text-purple-400">To</span>Video
                </span>
                <span className="text-[10px] px-2 py-0.5 font-mono tracking-wider bg-purple-950 text-purple-400 rounded border border-purple-800">
                  REAL-TIME API
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-mono">Senior Orchestrated Vision Pipeline</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800 flex items-center gap-2 font-mono">
              <span className={`h-2 w-2 rounded-full ${isProcessing ? 'bg-purple-500 animate-ping' : 'bg-emerald-500'}`} />
              <span className="text-[11px] text-neutral-300">
                {isProcessing ? "PROCESSING..." : "ENGINE ONLINE"}
              </span>
            </div>
            {panels.length > 0 && (
              <div className="text-right hidden md:block">
                <p className="text-xs text-neutral-400">Total Duration</p>
                <p className="text-sm font-semibold text-white font-mono">{totalCalculatedDuration.toFixed(1)}s Output</p>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* WORKSPACE AREA */}
      <main id="main_workspace" className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: SOURCE INTEGRATION */}
        <div id="controls_column" className="lg:col-span-7 flex flex-col gap-6">
          
          {/* CONVERSION INPUT CARD */}
          <div id="dynamic_input_box" className="bg-neutral-900/60 rounded-2xl border border-neutral-800 p-6 backdrop-blur space-y-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-purple-400">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-semibold tracking-wider uppercase font-mono">Dynamic Webtoon Scraper</span>
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">Generate Video from Live Incident URL</h2>
              <p className="text-xs text-neutral-400">
                Enter an official Webtoon viewer URL page. The backend engine will scrape the live media assets, isolate panels, run OCR transcriptions, and compile the cinematic rendering dynamically.
              </p>
            </div>

            {/* URL Inputs */}
            <div className="relative group">
              <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 opacity-20 blur group-focus-within:opacity-40 transition-opacity duration-300" />
              <div className="relative flex flex-col sm:flex-row gap-2">
                <input 
                  id="target_url_input"
                  type="url" 
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="Paste Webtoon episode viewer URL (e.g. webtoons.com/...)"
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3.5 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-purple-500 transition-colors"
                />
                
                <button
                  id="btn_generate_pipeline"
                  onClick={handleGenerateVideo}
                  disabled={isProcessing || !targetUrl.trim()}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-6 py-3.5 rounded-xl flex items-center justify-center gap-2 shrink-0 select-none shadow-lg shadow-purple-950/40 transition-all cursor-pointer hover:scale-[1.01] active:scale-95 duration-150"
                >
                  {isProcessing ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <Cpu className="h-4 w-4" />
                  )}
                  <span>Generate Video</span>
                </button>
              </div>
            </div>

            {/* ERROR NOTIFICATION PANEL */}
            {errorLog && (
              <div className="bg-red-950/30 border border-red-800/80 rounded-xl p-4 flex gap-3 text-red-200">
                <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold">Pipeline Connection Issue</p>
                  <p className="text-red-300 leading-relaxed">{errorLog}</p>
                </div>
              </div>
            )}

            {/* SAMPLE SITES FOR QUICK CLICKS */}
            <div className="space-y-2">
              <label className="text-xs font-mono text-neutral-500 block uppercase tracking-wider">Test URL Templates (Loads on button click)</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {SAMPLE_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setTargetUrl(preset.url);
                      setErrorLog(null);
                    }}
                    className={`text-left p-3 rounded-xl border transition-all cursor-pointer text-xs ${
                      targetUrl === preset.url 
                        ? "bg-purple-950/20 border-purple-500/80 text-purple-300" 
                        : "bg-neutral-950 border-neutral-800/80 text-neutral-400 hover:bg-neutral-900/60"
                    }`}
                  >
                    <p className="font-bold text-white">{preset.name}</p>
                    <p className="text-[10px] text-neutral-500 font-mono mt-1 overflow-hidden text-ellipsis whitespace-nowrap">
                      {preset.url.substring(0, 32)}...
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ACTIVE QUEUE / LIVE PIPELINE PROGRESS */}
          {isProcessing && (
            <div id="pipeline_status_card" className="bg-neutral-900/90 rounded-2xl border border-neutral-800 p-6 space-y-5 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-purple-400 animate-spin" />
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

          {/* CORE PIPELINE TERMINAL LOG MONITOR */}
          {consoleLogs.length > 0 && (
            <div className="bg-neutral-900/40 rounded-2xl border border-neutral-800/80 p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-800pb-1.5 pb-2">
                <span className="text-xs font-mono text-neutral-400 uppercase tracking-widest font-bold">Real-time Compiler Shell Logs</span>
                <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-ping" />
              </div>
              <div className="space-y-1 max-h-[150px] overflow-y-auto font-mono text-[11px] leading-relaxed text-neutral-400 scrollbar-thin">
                {consoleLogs.map((log, index) => (
                  <p key={index} className="truncate">
                    <span className="text-purple-500 mr-2">&gt;</span>{log}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* ADVANCED RENDER SETTINGS */}
          <div id="advanced_settings_accordion" className="bg-neutral-900/40 rounded-2xl border border-neutral-800/80 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-805 pb-3">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-purple-400" />
                <h3 className="font-bold text-sm text-white">Cinematic Tuning Variables</h3>
              </div>
              <span className="text-[10px] font-mono bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800 text-neutral-400">Settings</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Voice Choice */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                  <Mic className="h-3.5 w-3.5 text-purple-400" />
                  Voice Actor Character
                </label>
                <select 
                  id="voice_actor_select"
                  value={voiceActor} 
                  onChange={(e) => setVoiceActor(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 text-xs rounded-xl px-3 py-2 text-neutral-400 focus:border-purple-500 outline-none"
                >
                  <option>Liam - Deep Cinematic Narration</option>
                  <option>Evelyn - Emotional Storyteller</option>
                  <option>Marcus - Shonen Action Protagonist</option>
                  <option>Sophia - Soft Whisper / Romance</option>
                </select>
              </div>

              {/* Music Choice */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                  <Music className="h-3.5 w-3.5 text-purple-400" />
                  Track Ambience
                </label>
                <select 
                  id="bg_music_select"
                  value={musicTheme} 
                  onChange={(e) => setMusicTheme(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 text-xs rounded-xl px-3 py-2 text-neutral-405 focus:border-purple-500 outline-none"
                >
                  <option>Orchestral Battle Theme</option>
                  <option>Mysterious Ambience</option>
                  <option>Sci-Fi Synth Wave</option>
                  <option>Calm Acoustic Melancholy</option>
                  <option>No Music (Dialogue Only)</option>
                </select>
              </div>

              {/* Aspect Ratio */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                  <Tv className="h-3.5 w-3.5 text-purple-400" />
                  Aspect Ratio
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setAspectRatio("9:16")}
                    className={`py-1.5 px-3 text-xs rounded-xl border text-center transition-all cursor-pointer ${
                      aspectRatio === "9:16" 
                        ? "bg-purple-950/20 border-purple-500 text-purple-200" 
                        : "bg-neutral-950 border-neutral-800 text-neutral-400"
                    }`}
                  >
                    9:16 Portrait
                  </button>
                  <button
                    onClick={() => setAspectRatio("16:9")}
                    className={`py-1.5 px-3 text-xs rounded-xl border text-center transition-all cursor-pointer ${
                      aspectRatio === "16:9" 
                        ? "bg-purple-950/20 border-purple-500 text-purple-200" 
                        : "bg-neutral-950 border-neutral-800 text-neutral-400"
                    }`}
                  >
                    16:9 Landscape
                  </button>
                </div>
              </div>

              {/* FPS option */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-purple-400" />
                  Frame Rate (FPS)
                </label>
                <div className="flex items-center gap-3 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5">
                  <input 
                    type="range" 
                    min={12} 
                    max={60} 
                    step={6}
                    value={frameRate} 
                    onChange={(e) => setFrameRate(Number(e.target.value))} 
                    className="w-full accent-purple-500 bg-neutral-800"
                  />
                  <span className="text-xs font-mono text-[#dcdcdc] shrink-0 font-semibold">{frameRate} FPS</span>
                </div>
              </div>

            </div>
          </div>

          {/* DYNAMIC STORYBOARD TIMELINE DECK */}
          {panels.length > 0 && (
            <div id="panels_timeline_section" className="bg-neutral-900/60 rounded-2xl border border-neutral-800 p-6 space-y-4">
              <div>
                <h3 className="font-bold text-base text-white">Dynamic Storyboard & OCR Transcription</h3>
                <p className="text-xs text-neutral-400">Review live isolated panel frames. Adjust speech transcripts locally below.</p>
              </div>

              {/* Storyboard grid */}
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
                {panels.map((panel, idx) => {
                  const isCurrent = idx === currentPanelIndex && activePreviewTab === "storyboard";
                  return (
                    <div
                      key={panel.id}
                      className={`w-[260px] shrink-0 rounded-xl border p-3.5 space-y-3 transition-all ${
                        isCurrent 
                          ? "bg-neutral-800/80 border-purple-500 shadow-lg" 
                          : "bg-neutral-950 border-neutral-800"
                      }`}
                    >
                      {/* Image Thumbnail */}
                      <div 
                        onClick={() => {
                          setCurrentPanelIndex(idx);
                          setActivePreviewTab("storyboard");
                          setPlaybackTime(0);
                        }}
                        className="relative h-32 rounded-lg overflow-hidden cursor-pointer select-none bg-neutral-950 border border-neutral-800 flex items-center justify-center group"
                      >
                        <img 
                          src={panel.image_url} 
                          alt={`Panel ${panel.id}`} 
                          className="w-full h-full object-contain object-center group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            // If load fails, render placeholder or standard label
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                          }}
                        />
                        
                        {/* Number tag */}
                        <div className="absolute top-2 left-2 h-5 w-5 rounded bg-black/80 backdrop-blur flex items-center justify-center font-mono text-[10px] text-purple-400 font-bold border border-purple-900/40">
                          #{panel.id}
                        </div>

                        {/* Motion overlay text */}
                        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-mono uppercase tracking-wider text-neutral-300">
                          {panel.motion_type}
                        </div>
                      </div>

                      {/* Text OCR Editable Input */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider block">Dialogue/Subtitle Text</label>
                        <textarea
                          rows={2}
                          value={panel.speech_text}
                          onChange={(e) => handleModifySpeechText(panel.id, e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-800 text-[11px] rounded-lg p-2 text-neutral-100 outline-none focus:border-purple-500 font-sans"
                        />
                      </div>

                      {/* Playback specifications */}
                      <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-neutral-900/80">
                        <div>
                          <span className="text-[9px] font-mono text-neutral-500 uppercase block">Cam Motion</span>
                          <select
                            value={panel.motion_type}
                            onChange={(e) => handleModifyMotion(panel.id, e.target.value)}
                            className="bg-neutral-900 text-[11px] text-neutral-300 rounded border border-neutral-800 p-1 w-full outline-none"
                          >
                            <option value="zoom_in">Zoom In</option>
                            <option value="zoom_out">Zoom Out</option>
                            <option value="pan_right">Pan Right</option>
                            <option value="pan_left">Pan Left</option>
                            <option value="pan_down">Pan Down</option>
                          </select>
                        </div>

                        <div>
                          <span className="text-[9px] font-mono text-neutral-500 uppercase block">Timing (sec)</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              max={15}
                              step={0.5}
                              value={panel.duration}
                              onChange={(e) => handleModifyDuration(panel.id, parseFloat(e.target.value) || 4.0)}
                              className="bg-neutral-900 text-[11px] text-neutral-300 rounded border border-neutral-800 p-1 w-full outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[9px] text-neutral-500 pt-1 font-mono">
                        <span>SFX: {panel.sfx || "None"}</span>
                        <span>{idx + 1} / {panels.length}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: INTEGRATED CINEMA PLAYER */}
        <div id="cinema_column" className="lg:col-span-5 flex flex-col gap-6 sticky top-24">
          
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setActivePreviewTab("video")}
                disabled={!videoUrl}
                className={`px-3 py-1 text-xs rounded-lg transition-all ${
                  !videoUrl 
                    ? "opacity-40 cursor-not-allowed"
                    : activePreviewTab === "video"
                    ? "bg-purple-600 text-white font-bold"
                    : "bg-neutral-900 text-neutral-300 hover:text-white"
                }`}
              >
                Output MP4 Player
              </button>
              <button
                onClick={() => setActivePreviewTab("storyboard")}
                disabled={panels.length === 0}
                className={`px-3 py-1 text-xs rounded-lg transition-all ${
                  panels.length === 0 
                    ? "opacity-40 cursor-not-allowed"
                    : activePreviewTab === "storyboard"
                    ? "bg-purple-600 text-white font-bold"
                    : "bg-neutral-900 text-neutral-300 hover:text-white"
                }`}
              >
                Storyboard Preview
              </button>
            </div>

            <span className="text-[10px] font-mono bg-neutral-950 border border-neutral-800 px-2 py-0.5 rounded text-neutral-400">
              {aspectRatio === "9:16" ? "Portrait (1080x1920)" : "Landscape (1920x1080)"}
            </span>
          </div>

          {/* ACTIVE VIEWPORT FRAME */}
          <div id="video_monitor_outer_wrapper" className="relative bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center p-3 min-h-[400px]">
            
            {/* Ambient Background Glow */}
            <div className="absolute h-56 w-56 rounded-full bg-purple-600/10 blur-3xl" />

            {/* IF NO VIDEO GENERATED YET -> SHOW ILLUSTRATIVE EMPTY STATE */}
            {!videoUrl && panels.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center p-8 space-y-4">
                <div className="h-14 w-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500">
                  <Film className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-neutral-300 font-sans">Preview Screen Unallocated</p>
                  <p className="text-[11px] text-neutral-500 max-w-[240px] leading-relaxed">
                    Paste your target webtoon viewer URL on the left and click "Generate Video" to execute the scraper compiler.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 1: HTML5 PREVIEWING MP4 PLAYER */}
            {videoUrl && activePreviewTab === "video" && (
              <div 
                className="relative bg-black border border-neutral-800 overflow-hidden rounded-xl flex flex-col justify-between transition-all duration-300 shadow w-full"
                style={aspectRatio === "9:16" ? { maxWidth: "270px", aspectRatio: "9/16" } : { maxWidth: "100%", aspectRatio: "16/9" }}
              >
                <video
                  ref={videoPlayerRef}
                  src={videoUrl}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain bg-black"
                />
              </div>
            )}

            {/* TAB 2: INTERACTIVE STORYBOARD PREVIEW SIMULATOR */}
            {panels.length > 0 && activePreviewTab === "storyboard" && activeStoryboardPanel && (
              <div 
                className="relative bg-neutral-950 border border-neutral-800/80 overflow-hidden rounded-xl flex flex-col justify-between transition-all duration-300 shadow w-full text-center"
                style={aspectRatio === "9:16" ? { maxWidth: "270px", height: "480px" } : { maxWidth: "100%", aspectRatio: "16/9" }}
              >
                {/* Image under cinematic pan animations */}
                <div className="absolute inset-0 overflow-hidden flex items-center justify-center bg-black">
                  <img
                    src={activeStoryboardPanel.image_url}
                    alt="Active Frame"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                    style={{
                      transform: activeStoryboardPanel.motion_type === "zoom_in" ? `scale(${1 + (playbackTime * 0.02)})` :
                                 activeStoryboardPanel.motion_type === "zoom_out" ? `scale(${1.15 - (playbackTime * 0.02)})` :
                                 activeStoryboardPanel.motion_type === "pan_right" ? `translateX(${playbackTime * 4}px)` :
                                 activeStoryboardPanel.motion_type === "pan_left" ? `translateX(${-playbackTime * 4}px)` :
                                 activeStoryboardPanel.motion_type === "pan_down" ? `translateY(${playbackTime * 4}px)` : "",
                      transition: "transform 100ms linear"
                    }}
                  />
                </div>

                {/* Overlays */}
                <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />
                <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black/90 to-transparent pointer-events-none" />

                {/* Subtitle badge inside storyboard preview */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-[10px] font-mono text-neutral-300 select-none">
                  <span className="bg-black/80 px-2 py-1 rounded border border-neutral-800/50">
                    FRAME #{activeStoryboardPanel.id}
                  </span>
                  <span className="bg-purple-950/85 text-purple-400 px-2 py-0.5 rounded border border-purple-800/40">
                    STORYBOARD PREVIEW
                  </span>
                </div>

                {/* Subtitles Overlay */}
                <div className="absolute bottom-4 left-3 right-3 z-10 text-center">
                  {activeStoryboardPanel.sfx && (
                    <span className="inline-block transform -rotate-2 bg-yellow-500 text-black font-extrabold text-[10px] px-2 py-0.5 rounded shadow-lg font-mono tracking-widest uppercase mb-1">
                      {activeStoryboardPanel.sfx}
                    </span>
                  )}
                  <p className="text-white font-bold text-xs leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,1)] bg-black/60 p-2.5 rounded-lg border border-white/5 backdrop-blur-xs text-center font-sans">
                    {activeStoryboardPanel.speech_text}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* PLAYBACK CONTROLLER ACCESSORIES FOR STORYBOARD PREVIEW */}
          {activePreviewTab === "storyboard" && panels.length > 0 && (
            <div id="video_controls_card" className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800 space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
                  <span>Storyboard Sync Progress</span>
                  {activeStoryboardPanel && (
                    <span>{playbackTime.toFixed(1)}s / {activeStoryboardPanel.duration}s</span>
                  )}
                </div>
                
                <div className="relative h-2 bg-neutral-950 rounded-full overflow-hidden border border-neutral-850">
                  {activeStoryboardPanel && (
                    <div 
                      className="bg-purple-500 h-full transition-all duration-100 ease-linear"
                      style={{ width: `${(playbackTime / activeStoryboardPanel.duration) * 100}%` }}
                    />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleStoryboardPlayback}
                    className="bg-purple-600 hover:bg-purple-500 text-white p-3 rounded-full cursor-pointer hover:scale-105 transition-transform"
                  >
                    {storyboardPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-white" />}
                  </button>
                  
                  <button
                    onClick={resetStoryboardPlayback}
                    className="p-3 bg-neutral-800 hover:bg-neutral-700 hover:text-white rounded-xl text-neutral-400 cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => setIsMuted(!isMuted)} className="text-neutral-400 hover:text-white">
                    {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-20 sm:w-28 accent-purple-500 bg-neutral-800"
                  />
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-mono text-neutral-500 block">Active Scene</span>
                  <span className="text-xs font-semibold text-white">Scene #{currentPanelIndex + 1}</span>
                </div>
              </div>
            </div>
          )}

          {/* METADATA RENDER MATRIX */}
          <div id="video_metadata_panel" className="bg-neutral-900/40 rounded-2xl border border-neutral-800/80 p-5 space-y-3.5">
            <h4 className="font-bold text-xs text-neutral-400 uppercase tracking-widest font-mono">Output Specifications</h4>
            
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-xs text-neutral-300">
              <div className="flex items-center justify-between border-b border-neutral-800/50 pb-2">
                <span className="text-neutral-500">Codec</span>
                <span className="font-mono font-semibold">H.264 (MP4 Wrapper)</span>
              </div>
              <div className="flex items-center justify-between border-b border-neutral-800/50 pb-2">
                <span className="text-neutral-500">Soundtrack</span>
                <span className="font-semibold text-purple-400 truncate max-w-[120px] block" title={musicTheme}>
                  {musicTheme}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-neutral-800/50 pb-2 col-span-2">
                <span className="text-neutral-500">Active Speaker</span>
                <span className="font-semibold text-purple-400">{voiceActor}</span>
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
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs py-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer select-none shadow-lg shadow-purple-900/30"
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

    </div>
  );
}
