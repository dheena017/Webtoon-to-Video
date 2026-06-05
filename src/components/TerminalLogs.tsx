import React from "react";
import { Terminal, Trash2 } from "lucide-react";

interface TerminalLogsProps {
  consoleLogs: string[];
  setConsoleLogs: React.Dispatch<React.SetStateAction<string[]>>;
}

export default function TerminalLogs({ consoleLogs, setConsoleLogs }: TerminalLogsProps) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3.5">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-purple-400" />
          <div>
            <h3 className="font-bold text-sm text-white">Real-Time Compilation Shell Logs</h3>
            <p className="text-[10px] text-neutral-400 font-mono">Live background status of parser compiles</p>
          </div>
        </div>
        <button
          onClick={() => setConsoleLogs(["[GUI] Active shell cleared at user prompt."])}
          className="text-[10px] text-neutral-400 hover:text-red-400 font-mono border border-neutral-800/80 px-2.5 py-1 rounded-lg bg-neutral-950 hover:bg-neutral-900 cursor-pointer flex items-center gap-1.5 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
          Clear Logs
        </button>
      </div>

      <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-850 h-52 overflow-y-auto font-mono text-[10px] space-y-1.5 scrollbar-thin">
        {consoleLogs.map((log, index) => {
          let logColor = "text-neutral-400";
          if (log.startsWith("[ERROR]")) logColor = "text-red-400 font-semibold";
          else if (log.startsWith("[SUCCESS]") || log.includes("completed cleanly")) logColor = "text-emerald-400 font-medium";
          else if (log.startsWith("[SCIME]") || log.startsWith("[OCR/CV Engine]")) logColor = "text-purple-300";
          else if (log.startsWith("[STITCH]") || log.includes("Combined")) logColor = "text-indigo-300";
          else if (log.startsWith("[GUI]")) logColor = "text-neutral-300";

          return (
            <div key={index} className={`leading-relaxed border-l-2 pl-2 border-neutral-800 hover:border-purple-500/50 transition-colors ${logColor}`}>
              {log}
            </div>
          );
        })}
      </div>
    </div>
  );
}
