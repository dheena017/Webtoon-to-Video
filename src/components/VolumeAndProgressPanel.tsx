import React from "react";
import { Play, Pause, RotateCcw, VolumeX, Volume2 } from "lucide-react";
import { GeneratedPanel } from "../types";

interface VolumeAndProgressPanelProps {
  panels: GeneratedPanel[];
  currentPanelIndex: number;
  playbackTime: number;
  storyboardPlaying: boolean;
  toggleStoryboardPlayback: () => void;
  resetStoryboardPlayback: () => void;
  isMuted: boolean;
  setIsMuted: (val: boolean) => void;
  volume: number;
  setVolume: (val: number) => void;
}

export default function VolumeAndProgressPanel({
  panels,
  currentPanelIndex,
  playbackTime,
  storyboardPlaying,
  toggleStoryboardPlayback,
  resetStoryboardPlayback,
  isMuted,
  setIsMuted,
  volume,
  setVolume
}: VolumeAndProgressPanelProps) {
  const activeStoryboardPanel = panels[currentPanelIndex] || null;

  return (
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
          <button onClick={() => setIsMuted(!isMuted)} className="text-neutral-400 hover:text-white cursor-pointer">
            {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-20 sm:w-28 accent-purple-500 bg-neutral-800 cursor-pointer"
          />
        </div>

        <div className="text-right">
          <span className="text-[10px] uppercase font-mono text-neutral-500 block">Active Scene</span>
          <span className="text-xs font-semibold text-white">Scene #{currentPanelIndex + 1}</span>
        </div>
      </div>
    </div>
  );
}
