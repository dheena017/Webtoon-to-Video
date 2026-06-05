import React from "react";
import { Film } from "lucide-react";
import { GeneratedPanel } from "../types";

interface HeaderProps {
  isProcessing: boolean;
  panels: GeneratedPanel[];
  totalCalculatedDuration: number;
}

export default function Header({ isProcessing, panels, totalCalculatedDuration }: HeaderProps) {
  return (
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
  );
}
