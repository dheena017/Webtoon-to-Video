import React, { useState } from 'react';

const MODEL_DATA = [
  { model: "Gemini 2.5 Flash", category: "Text-out models", rpm: "1 / 5", tpm: "313 / 250K", rpd: "1 / 20" },
  { model: "Gemini 3.5 Flash", category: "Text-out models", rpm: "1 / 5", tpm: "140 / 250K", rpd: "1 / 20" },
  { model: "Gemini 2.5 Pro", category: "Text-out models", rpm: "0 / 0", tpm: "0 / 0", rpd: "0 / 0" },
  { model: "Gemini 2 Flash", category: "Text-out models", rpm: "0 / 0", tpm: "0 / 0", rpd: "0 / 0" },
  { model: "Gemini 2 Flash Lite", category: "Text-out models", rpm: "0 / 0", tpm: "0 / 0", rpd: "0 / 0" },
  { model: "Gemini 2.5 Flash TTS", category: "Multi-modal generative models", rpm: "0 / 3", tpm: "0 / 10K", rpd: "0 / 10" },
  { model: "Gemini 2.5 Pro TTS", category: "Multi-modal generative models", rpm: "0 / 0", tpm: "0 / 0", rpd: "0 / 0" },
  { model: "Imagen 4 Generate", category: "Multi-modal generative models", rpm: "-", tpm: "-", rpd: "0 / 25" },
  { model: "Imagen 4 Ultra Generate", category: "Multi-modal generative models", rpm: "-", tpm: "-", rpd: "0 / 25" },
  { model: "Imagen 4 Fast Generate", category: "Multi-modal generative models", rpm: "-", tpm: "-", rpd: "0 / 25" },
  { model: "Gemma 4 26B", category: "Other models", rpm: "0 / 15", tpm: "0 / Unlimited", rpd: "0 / 1.5K" },
  { model: "Gemma 4 31B", category: "Other models", rpm: "0 / 15", tpm: "0 / Unlimited", rpd: "0 / 1.5K" },
  { model: "Gemini Embedding 1", category: "Other models", rpm: "0 / 100", tpm: "0 / 30K", rpd: "0 / 1K" },
  { model: "Gemini 3.1 Flash Lite", category: "Text-out models", rpm: "0 / 15", tpm: "0 / 250K", rpd: "0 / 500" },
  { model: "Gemini 3.1 Pro", category: "Text-out models", rpm: "0 / 0", tpm: "0 / 0", rpd: "0 / 0" },
  { model: "Gemini 2.5 Flash Lite", category: "Text-out models", rpm: "0 / 10", tpm: "0 / 250K", rpd: "0 / 20" },
  { model: "Nano Banana (Gemini 2.5 Flash Preview Image)", category: "Multi-modal generative models", rpm: "0 / 0", tpm: "0 / 0", rpd: "0 / 0" },
  { model: "Gemini 3 Flash", category: "Text-out models", rpm: "0 / 5", tpm: "0 / 250K", rpd: "0 / 20" },
  { model: "Nano Banana Pro (Gemini 3 Pro Image)", category: "Multi-modal generative models", rpm: "0 / 0", tpm: "0 / 0", rpd: "0 / 0" },
  { model: "Nano Banana 2 (Gemini 3.1 Flash Image)", category: "Multi-modal generative models", rpm: "0 / 0", tpm: "0 / 0", rpd: "0 / 0" },
  { model: "Lyria 3 Clip", category: "Multi-modal generative models", rpm: "0 / 0", tpm: "0 / 0", rpd: "0 / 0" },
  { model: "Lyria 3 Pro", category: "Multi-modal generative models", rpm: "0 / 0", tpm: "0 / 0", rpd: "0 / 0" },
  { model: "Veo 3 Generate", category: "Multi-modal generative models", rpm: "0 / 0", tpm: "-", rpd: "0 / 0" },
  { model: "Veo 3 Fast Generate", category: "Multi-modal generative models", rpm: "0 / 0", tpm: "-", rpd: "0 / 0" },
  { model: "Veo 3 Lite Generate", category: "Multi-modal generative models", rpm: "0 / 0", tpm: "-", rpd: "0 / 0" },
  { model: "Gemini 3.1 Flash TTS", category: "Multi-modal generative models", rpm: "0 / 3", tpm: "0 / 10K", rpd: "0 / 10" },
  { model: "Gemini Robotics ER 1.5 Preview", category: "Other models", rpm: "0 / 10", tpm: "0 / 250K", rpd: "0 / 20" },
  { model: "Gemini Robotics ER 1.6 Preview", category: "Other models", rpm: "0 / 5", tpm: "0 / 250K", rpd: "0 / 20" },
  { model: "Computer Use Preview", category: "Other models", rpm: "0 / 0", tpm: "0 / 0", rpd: "0 / 0" },
  { model: "Gemini Embedding 2", category: "Other models", rpm: "0 / 100", tpm: "0 / 30K", rpd: "0 / 1K" },
  { model: "Antigravity", category: "Agents", rpm: "0 / 0", tpm: "0 / 0", rpd: "0 / 0" },
  { model: "Deep Research Pro Preview", category: "Agents", rpm: "0 / 0", tpm: "0 / 0", rpd: "0 / 0" },
  { model: "Gemini 2.5 Flash Native Audio Dialog", category: "Live API", rpm: "0 / Unlimited", tpm: "0 / 1M", rpd: "0 / Unlimited" },
  { model: "Gemini 3 Flash Live", category: "Live API", rpm: "0 / Unlimited", tpm: "0 / 65K", rpd: "0 / Unlimited" }
];

export default function ModelStatusTable({ onSelect, selectedModel }: { onSelect?: (model: string) => void, selectedModel?: string }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const filteredData = MODEL_DATA.filter(item => 
    item.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedData = React.useMemo(() => {
    if (!sortConfig) return filteredData;
    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      const aVal = (a as any)[sortConfig.key];
      const bVal = (b as any)[sortConfig.key];
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredData, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="bg-neutral-950/80 rounded-xl border border-neutral-800/50 p-4 shadow-xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-widest font-mono">AI Model Capabilities</h3>
        <input 
          type="text" 
          placeholder="Search models..."
          className="bg-neutral-900 border border-neutral-800 rounded-md px-3 py-1 text-xs text-neutral-300 placeholder:text-neutral-600 focus:outline-none focus:border-purple-500/50"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="max-h-[300px] overflow-y-auto pr-1">
        <table className="w-full text-[11px] text-left text-neutral-400">
          <thead className="text-neutral-500 sticky top-0 bg-neutral-950/95 border-b border-neutral-800">
            <tr>
              <th className="py-1.5 font-medium cursor-pointer hover:text-purple-400" onClick={() => requestSort('model')}>Model</th>
              <th className="py-1.5 font-medium cursor-pointer hover:text-purple-400" onClick={() => requestSort('category')}>Category</th>
              <th className="py-1.5 font-medium cursor-pointer hover:text-purple-400" onClick={() => requestSort('rpm')}>RPM</th>
              <th className="py-1.5 font-medium cursor-pointer hover:text-purple-400" onClick={() => requestSort('tpm')}>TPM</th>
              <th className="py-1.5 font-medium cursor-pointer hover:text-purple-400" onClick={() => requestSort('rpd')}>RPD</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((item, idx) => (
              <tr 
                key={idx} 
                className={`border-b border-neutral-900 cursor-pointer ${
                  selectedModel === item.model 
                    ? 'bg-purple-900/40 hover:bg-purple-900/50' 
                    : 'even:bg-neutral-900/20 hover:bg-neutral-900/50'
                }`}
                onClick={() => onSelect?.(item.model)}
              >
                <td className="py-1.5 font-mono text-purple-300 truncate max-w-[150px]">{item.model}</td>
                <td className="py-1.5 text-neutral-500">{item.category}</td>
                <td className="py-1.5 font-mono text-neutral-300">{item.rpm}</td>
                <td className="py-1.5 font-mono text-neutral-300">{item.tpm}</td>
                <td className="py-1.5 font-mono text-neutral-300">{item.rpd}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filteredData.length === 0 && (
        <div className="text-center py-4 text-xs text-neutral-600 font-mono">No models found...</div>
      )}
    </div>
  );
}
