import React from "react";
import { GeneratedPanel } from "../types";
import { getPanelFilterStyle } from "../utils";

interface StoryboardTimelineProps {
  panels: GeneratedPanel[];
  setPanels: React.Dispatch<React.SetStateAction<GeneratedPanel[]>>;
  currentPanelIndex: number;
  setCurrentPanelIndex: (idx: number) => void;
  activePreviewTab: "video" | "storyboard";
  setActivePreviewTab: (tab: "video" | "storyboard") => void;
  setPlaybackTime: (time: number) => void;
  hasScrapedImages?: boolean;
}

export default function StoryboardTimeline({
  panels,
  setPanels,
  currentPanelIndex,
  setCurrentPanelIndex,
  activePreviewTab,
  setActivePreviewTab,
  setPlaybackTime,
  hasScrapedImages = false
}: StoryboardTimelineProps) {
  
  const handleModifySpeechText = (panelId: number, text: string) => {
    setPanels(prev => prev.map(p => p.id === panelId ? { ...p, speech_text: text } : p));
  };

  const handleModifyMotion = (panelId: number, motionVal: string) => {
    setPanels(prev => prev.map(p => p.id === panelId ? { ...p, motion_type: motionVal } : p));
  };

  const handleModifyDuration = (panelId: number, durVal: number) => {
    setPanels(prev => prev.map(p => p.id === panelId ? { ...p, duration: durVal } : p));
  };

  if (panels.length === 0) {
    if (hasScrapedImages) {
      return (
        <div id="panels_timeline_section_empty" className="bg-neutral-900/30 rounded-2xl border border-purple-500/20 border-dashed p-10 text-center space-y-4 max-w-4xl mx-auto">
          <div className="mx-auto h-12 w-12 rounded-xl bg-purple-950/40 border border-purple-500/35 flex items-center justify-center text-purple-400 font-mono text-xl animate-pulse">
            ✦
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-neutral-200 font-sans">No Scenes in Storyboard Yet</p>
            <p className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">
              Images are loaded in the deck below! Select frame items and click <span className="text-purple-300 font-semibold font-mono">Insert Selected</span>, or click <span className="text-purple-300 font-semibold font-mono font-sans">+ Insert to Storyboard</span> on any individual panel card in the deck to build your video storyboard.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div id="panels_timeline_section_empty" className="bg-neutral-900/30 rounded-2xl border border-neutral-800/60 border-dashed p-8 text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-center text-neutral-500 font-mono text-lg">
          #
        </div>
        <div className="space-y-1">
          <p className="text-sm font-bold text-neutral-300 font-sans">Storyboard Deck Awaiting URL</p>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
            Once a valid Webtoon viewer URL is pasted, the continuous canvas strip will automatically scrape. You can then insert, partition, and map them into editable scenes here.
          </p>
        </div>
      </div>
    );
  }

  return (
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
                  style={{ filter: getPanelFilterStyle(panel) }}
                  onError={(e) => {
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
  );
}
