import React from "react";
import { Film, RefreshCw } from "lucide-react";
import { GeneratedPanel } from "../types";
import { getPanelFilterStyle } from "../utils";

interface VideoMonitorProps {
  activePreviewTab: "video" | "storyboard";
  setActivePreviewTab: (tab: "video" | "storyboard") => void;
  videoUrl: string | null;
  panels: GeneratedPanel[];
  aspectRatio: "9:16" | "16:9";
  videoPlayerRef: React.RefObject<HTMLVideoElement | null>;
  currentPanelIndex: number;
  playbackTime: number;
  reprocessingPanelId: number | null;
}

export default function VideoMonitor({
  activePreviewTab,
  setActivePreviewTab,
  videoUrl,
  panels,
  aspectRatio,
  videoPlayerRef,
  currentPanelIndex,
  playbackTime,
  reprocessingPanelId
}: VideoMonitorProps) {
  const activeStoryboardPanel = panels[currentPanelIndex] || null;

  return (
    <div className="space-y-4">
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
      <div id="video_monitor_outer_wrapper" className="relative bg-neutral-950/40 border border-neutral-800/80 rounded-3xl overflow-hidden shadow-inner flex items-center justify-center p-4 min-h-[440px]">
        
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
                  transition: "transform 100ms linear",
                  filter: getPanelFilterStyle(activeStoryboardPanel)
                }}
              />
            </div>

            {/* Reprocessing OCR/CV Recalculation overlay */}
            {reprocessingPanelId === activeStoryboardPanel.id && (
              <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center space-y-3 z-30">
                <RefreshCw className="h-8 w-8 text-purple-400 animate-spin" />
                <p className="text-xs font-mono text-purple-300 font-semibold tracking-wider">Recalculating CV Margins...</p>
                <p className="text-[10px] text-neutral-500 font-mono">Re-slicing boundaries live</p>
              </div>
            )}

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
    </div>
  );
}
