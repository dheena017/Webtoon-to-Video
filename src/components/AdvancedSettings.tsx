import React from "react";
import { Mic2, Music, Tv, Sliders } from "lucide-react";

interface AdvancedSettingsProps {
  voiceActor: string;
  setVoiceActor: (val: string) => void;
  musicTheme: string;
  setMusicTheme: (val: string) => void;
  aspectRatio: "9:16" | "16:9";
  setAspectRatio: (val: "9:16" | "16:9") => void;
  frameRate: number;
  setFrameRate: (val: number) => void;
}

export default function AdvancedSettings({
  voiceActor,
  setVoiceActor,
  musicTheme,
  setMusicTheme,
  aspectRatio,
  setAspectRatio,
  frameRate,
  setFrameRate
}: AdvancedSettingsProps) {
  return (
    <div id="settings_panel_card" className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
        <Sliders className="h-4 w-4 text-purple-400" />
        <div>
          <h3 className="font-bold text-sm text-white">Advanced Render compile Specifications</h3>
          <p className="text-[10px] text-neutral-400 font-mono">Customize secondary properties prior to generation</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Voice Select */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
            <Mic2 className="h-3.5 w-3.5 text-purple-400" />
            AI voice Speaker Character
          </label>
          <select 
            id="voice_select"
            value={voiceActor} 
            onChange={(e) => setVoiceActor(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 text-xs rounded-xl px-3 py-2 text-neutral-300 focus:border-purple-500 outline-none"
          >
            <option>Standard Comic Narrator (Male)</option>
            <option>Sultry Narrative Tone (Female)</option>
            <option>Shonen Protagonist (Energetic Male)</option>
            <option>Dark Anti-Hero voice (Raspy Deep)</option>
          </select>
        </div>

        {/* Music Select */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
            <Music className="h-3.5 w-3.5 text-purple-400" />
            Thematic Soundtrack Loop
          </label>
          <select 
            id="bg_music_select"
            value={musicTheme} 
            onChange={(e) => setMusicTheme(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 text-xs rounded-xl px-3 py-2 text-neutral-400 focus:border-purple-500 outline-none"
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
                  ? "bg-purple-950/20 border-purple-500 text-purple-200 shadow-inner" 
                  : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
              }`}
            >
              9:16 Portrait
            </button>
            <button
              onClick={() => setAspectRatio("16:9")}
              className={`py-1.5 px-3 text-xs rounded-xl border text-center transition-all cursor-pointer ${
                aspectRatio === "16:9" 
                  ? "bg-purple-950/20 border-purple-500 text-purple-200 shadow-inner" 
                  : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
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
              className="w-full accent-purple-500 bg-neutral-800 cursor-pointer"
            />
            <span className="text-xs font-mono text-[#dcdcdc] shrink-0 font-semibold">{frameRate} FPS</span>
          </div>
        </div>

      </div>
    </div>
  );
}
