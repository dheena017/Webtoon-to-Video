import React from "react";
import { Sparkles } from "lucide-react";
import { GeneratedPanel } from "../types";

interface ImageEnhancerProps {
  panels: GeneratedPanel[];
  setPanels: React.Dispatch<React.SetStateAction<GeneratedPanel[]>>;
  currentPanelIndex: number;
  setCurrentPanelIndex: (idx: number) => void;
  setConsoleLogs: React.Dispatch<React.SetStateAction<string[]>>;
}

export default function ImageEnhancer({
  panels,
  setPanels,
  currentPanelIndex,
  setCurrentPanelIndex,
  setConsoleLogs
}: ImageEnhancerProps) {
  const activeStoryboardPanel = panels[currentPanelIndex] || null;

  if (!activeStoryboardPanel) return null;

  const handleModifyBrightness = (panelId: number, val: number) => {
    setPanels(prev => prev.map(p => p.id === panelId ? { ...p, brightness: val } : p));
  };

  const handleModifyContrast = (panelId: number, val: number) => {
    setPanels(prev => prev.map(p => p.id === panelId ? { ...p, contrast: val } : p));
  };

  const handleModifySaturation = (panelId: number, val: number) => {
    setPanels(prev => prev.map(p => p.id === panelId ? { ...p, saturation: val } : p));
  };

  const handleModifyGrayscale = (panelId: number, val: boolean) => {
    setPanels(prev => prev.map(p => p.id === panelId ? { ...p, grayscale: val } : p));
  };

  const handleModifyFilterPreset = (panelId: number, preset: string) => {
    setPanels(prev => prev.map(p => p.id === panelId ? { ...p, filter_preset: preset } : p));
  };

  const handleApplyAdjustmentsToAll = (
    pPreset: string, 
    pBrightness: number, 
    pContrast: number, 
    pSaturation: number, 
    pGrayscale: boolean
  ) => {
    setPanels(prev => prev.map(p => ({
      ...p,
      filter_preset: pPreset,
      brightness: pBrightness,
      contrast: pContrast,
      saturation: pSaturation,
      grayscale: pGrayscale
    })));
    setConsoleLogs(prev => [
      `[Enhancer] Copied dynamic visual styling across all ${panels.length} panels for thematic uniformness`,
      ...prev
    ]);
  };

  return (
    <div id="image_enhancer_card" className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-400 animate-pulse" />
          <div>
            <h3 className="font-bold text-sm text-white">Live Panel Image Enhancer</h3>
            <p className="text-[10px] text-neutral-400 font-mono">Enhance Scene #{currentPanelIndex + 1} from URL</p>
          </div>
        </div>
        <span className="text-[9px] font-mono bg-purple-950 text-purple-300 border border-purple-800/60 px-2 py-0.5 rounded-full select-none">
          Hardware Accelerated
        </span>
      </div>



      {/* Aesthetic presets filter flow */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-neutral-400 flex items-center gap-1">
          <span>✨ Enhancement Style Presets</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { id: "none", label: "Original Clear", desc: "No enhancements" },
            { id: "anime_vibrant", label: "Anime Vibrant", desc: "Punchy colors & glowing hues" },
            { id: "cinematic_drama", label: "Cinematic Dark", desc: "Deep rich contrast gradients" },
            { id: "hdr_clear", label: "Clarity HDR", desc: "Microcontrast edge sharpness" },
            { id: "vintage_warm", label: "Warm Vintage", desc: "Nostalgic golden paper glow" },
            { id: "neon_cyber", label: "Neon Cyberpunk", desc: "Electric cyan-magenta shifts" }
          ].map((preset) => {
            const isActive = (activeStoryboardPanel.filter_preset || "none") === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handleModifyFilterPreset(activeStoryboardPanel.id, preset.id)}
                className={`text-left p-2 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? "bg-purple-600/15 border-purple-500 text-white"
                    : "bg-neutral-950 border-neutral-800/80 text-neutral-400 hover:bg-neutral-900"
                }`}
                title={preset.desc}
              >
                <p className="text-xs font-bold font-sans truncate">{preset.label}</p>
                <p className="text-[9px] text-neutral-500 font-mono truncate leading-normal">{preset.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Slider variables */}
      <div className="space-y-3.5 pt-2 border-t border-neutral-800/40">
        <p className="text-xs font-semibold text-neutral-400">Fine-Tuning Enhancement Variables</p>
        
        {/* Brightness */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-neutral-400">Brightness / Exposure &bull; {(activeStoryboardPanel.brightness !== undefined ? activeStoryboardPanel.brightness : 100)}%</span>
            <button 
              onClick={() => handleModifyBrightness(activeStoryboardPanel.id, 100)}
              className="text-[9px] text-purple-400 hover:underline cursor-pointer"
            >
              Reset
            </button>
          </div>
          <input 
            type="range"
            min={50}
            max={180}
            step={5}
            value={(activeStoryboardPanel.brightness !== undefined ? activeStoryboardPanel.brightness : 100)}
            onChange={(e) => handleModifyBrightness(activeStoryboardPanel.id, Number(e.target.value))}
            className="w-full accent-purple-500 bg-neutral-950 h-1 rounded cursor-pointer"
          />
        </div>

        {/* Contrast */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-neutral-400">Dynamic Range / Contrast &bull; {(activeStoryboardPanel.contrast !== undefined ? activeStoryboardPanel.contrast : 100)}%</span>
            <button 
              onClick={() => handleModifyContrast(activeStoryboardPanel.id, 100)}
              className="text-[9px] text-purple-400 hover:underline cursor-pointer"
            >
              Reset
            </button>
          </div>
          <input 
            type="range"
            min={50}
            max={180}
            step={5}
            value={(activeStoryboardPanel.contrast !== undefined ? activeStoryboardPanel.contrast : 100)}
            onChange={(e) => handleModifyContrast(activeStoryboardPanel.id, Number(e.target.value))}
            className="w-full accent-purple-500 bg-neutral-950 h-1 rounded cursor-pointer"
          />
        </div>

        {/* Saturation */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-neutral-400">Vibrancy / Saturation &bull; {(activeStoryboardPanel.saturation !== undefined ? activeStoryboardPanel.saturation : 100)}%</span>
            <button 
              onClick={() => handleModifySaturation(activeStoryboardPanel.id, 100)}
              className="text-[9px] text-purple-400 hover:underline cursor-pointer"
            >
              Reset
            </button>
          </div>
          <input 
            type="range"
            min={0}
            max={200}
            step={5}
            value={(activeStoryboardPanel.saturation !== undefined ? activeStoryboardPanel.saturation : 100)}
            onChange={(e) => handleModifySaturation(activeStoryboardPanel.id, Number(e.target.value))}
            className="w-full accent-purple-500 bg-neutral-950 h-1 rounded cursor-pointer"
          />
        </div>

        {/* Black & White Style Toggle */}
        <div className="flex items-center justify-between pt-1 text-xs">
          <span className="text-neutral-400 font-mono">Noir Grayscale Conversion</span>
          <button
            onClick={() => handleModifyGrayscale(activeStoryboardPanel.id, !activeStoryboardPanel.grayscale)}
            className={`px-3 py-1 text-xs rounded-lg border transition-all cursor-pointer ${
              activeStoryboardPanel.grayscale
                ? "bg-purple-950 text-purple-300 border-purple-500"
                : "bg-neutral-950 border-neutral-800 text-neutral-400"
            }`}
          >
            {activeStoryboardPanel.grayscale ? "Noir Mode Enabled" : "Enable Noir Style"}
          </button>
        </div>

      </div>
    </div>
  );
}
