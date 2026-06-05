import React from "react";
import { 
  Image as ImageIcon, 
  RefreshCw, 
  CheckSquare, 
  Square, 
  Trash2, 
  Plus, 
  Check, 
  Scissors, 
  Trash,
  Sliders,
  Brain,
  X
} from "lucide-react";
import { GeneratedPanel } from "../types";

import { NotificationType } from "./NotificationStack";

interface LiveScraperDeckProps {
  scrapedImages: string[];
  isScraping: boolean;
  selectedScraped: string[];
  setSelectedScraped: React.Dispatch<React.SetStateAction<string[]>>;
  setScrapedImages: React.Dispatch<React.SetStateAction<string[]>>;
  stitchingIndices: number[];
  setConsoleLogs: React.Dispatch<React.SetStateAction<string[]>>;
  panels: GeneratedPanel[];
  setPanels: React.Dispatch<React.SetStateAction<GeneratedPanel[]>>;
  currentPanelIndex: number;
  handleStitchWithNext: (idx: number) => Promise<void>;
  setEditingImageIdx: (idx: number | null) => void;
  setEditCropTop: (val: number) => void;
  setEditCropBottom: (val: number) => void;
  setEditCropLeft: (val: number) => void;
  setEditCropRight: (val: number) => void;
  setEditAutoTrim: (val: boolean) => void;
  addNotification: (message: string, type: NotificationType) => void;
}

export default function LiveScraperDeck({
  scrapedImages,
  isScraping,
  selectedScraped,
  setSelectedScraped,
  setScrapedImages,
  stitchingIndices,
  setConsoleLogs,
  panels,
  setPanels,
  currentPanelIndex,
  handleStitchWithNext,
  setEditingImageIdx,
  setEditCropTop,
  setEditCropBottom,
  setEditCropLeft,
  setEditCropRight,
  setEditAutoTrim,
  addNotification
}: LiveScraperDeckProps) {
  const [isBatchCropping, setIsBatchCropping] = React.useState<boolean>(false);
  const [isAiCropping, setIsAiCropping] = React.useState<boolean>(false);
  const [isAiEnabled, setIsAiEnabled] = React.useState<boolean>(false);
  const [cropSensitivity, setCropSensitivity] = React.useState<number>(30); // 5 to 90 threshold
  const [cropPaddingPx, setCropPaddingPx] = React.useState<number>(10); // 0 to 50px borders
  const [cropBackgroundMode, setCropBackgroundMode] = React.useState<string>("auto"); // 'auto', 'white', 'black'
  const [autoSplitTallStrips, setAutoSplitTallStrips] = React.useState<boolean>(true); // Slices vertical webtoons strips!
  const [showAutoCropSettings, setShowAutoCropSettings] = React.useState<boolean>(false);

  if (!isScraping && scrapedImages.length === 0) return null;

  const handleAiCropSelected = async () => {
    if (selectedScraped.length === 0) return;
    setIsAiCropping(true);
    setConsoleLogs(prev => [
      `[AI Auto Cropper] Starting AI-powered panel analysis for ${selectedScraped.length} assets...`,
      ...prev
    ]);

    try {
      let updatedImages = [...scrapedImages];
      let updatedSelected = [...selectedScraped];

      for (const imgUrl of selectedScraped) {
        setConsoleLogs(prev => [
          `[Auto Cropper] Analyzing structure for: ${imgUrl.substring(imgUrl.lastIndexOf('/') + 1, 65)}...`,
          ...prev
        ]);
        
        try {
          const detectRes = await fetch("/api/ai-detect-panels", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: imgUrl })
          });
          
          if (!detectRes.ok) {
            throw new Error(`AI panel parsing failed (status ${detectRes.status})`);
          }
          
          const detectData = await detectRes.json();
          if (detectData.quotaExceeded) {
            setIsAiEnabled(false);
            setConsoleLogs(prev => ["[AI Auto Cropper] Quota exceeded. AI disabled.", ...prev]);
            throw new Error("Quota exceeded");
          }
          
          if (detectData.success && detectData.panels && detectData.panels.length > 0) {
            // Apply the first found crop from AI
            const box = detectData.panels[0];
            
            const cropRes = await fetch("/api/edit-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                url: imgUrl,
                cropTop: box.cropTop,
                cropBottom: box.cropBottom,
                cropLeft: box.cropLeft,
                cropRight: box.cropRight,
                autoTrim: false
              })
            });
            
            if (cropRes.ok) {
              const cropData = await cropRes.json();
              if (cropData.success && cropData.url) {
                const idx = updatedImages.indexOf(imgUrl);
                updatedImages[idx] = cropData.url;
                
                const selIdx = updatedSelected.indexOf(imgUrl);
                if (selIdx !== -1) {
                  updatedSelected[selIdx] = cropData.url;
                }
                
                setPanels(prevPanels => 
                  prevPanels.map(p => p.image_url === imgUrl ? { ...p, image_url: cropData.url } : p)
                );
              } else {
                throw new Error("Failed to apply crop");
              }
            } else {
              throw new Error("Failed to apply crop");
            }
          }
        } catch (err: any) {
          throw err;
        }
      }
      
      setScrapedImages(updatedImages);
      setSelectedScraped(updatedSelected);
      setConsoleLogs(prev => [
        `[AI Auto Cropper] Successfully completed AI layout analysis!`,
        ...prev
      ]);
      
    } catch (err: any) {
      setConsoleLogs(prev => [
        `[AI Auto Cropper ERROR] AI analysis failed: ${err.message || err}`,
        ...prev
      ]);
      addNotification(err.message || "AI auto-crop failed. Please try again.", "error");
    } finally {
      setIsAiCropping(false);
    }
  };

  const handleAutoCropSelected = async () => {
    if (selectedScraped.length === 0) return;
    setIsBatchCropping(true);
    setConsoleLogs(prev => [
      `[Auto Cropper] Initiating enhanced auto-crop pipeline with ${selectedScraped.length} selected assets...`,
      ...prev
    ]);

    try {
      let updatedImages = [...scrapedImages];
      let updatedSelected = [...selectedScraped];

      for (const imgUrl of selectedScraped) {
        const idx = updatedImages.indexOf(imgUrl);
        if (idx === -1) continue;

        // Smart Splitting logic for vertical slides
        if (autoSplitTallStrips) {
          setConsoleLogs(prev => [
            `[Auto Slicer] Analyzing image layout density for: ${imgUrl.substring(imgUrl.lastIndexOf('/') + 1, 65)}...`,
            ...prev
          ]);

          try {
            const detectRes = await fetch("/api/detect-panels", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: imgUrl, sensitivity: cropSensitivity })
            });

            if (!detectRes.ok) {
              throw new Error(`Automatic panel parsing failed (status ${detectRes.status})`);
            }

            const detectData = await detectRes.json();
            if (detectData.success && Array.isArray(detectData.panels) && detectData.panels.length > 1) {
              setConsoleLogs(prev => [
                `[Auto Slicer] Identified ${detectData.panels.length} distinct panel layout slots! Slicing strip in real-time...`,
                ...prev
              ]);

              const slicedUrls: string[] = [];
              for (let i = 0; i < detectData.panels.length; i++) {
                const box = detectData.panels[i];
                const cropRes = await fetch("/api/edit-image", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    url: imgUrl,
                    cropTop: box.cropTop,
                    cropBottom: box.cropBottom,
                    cropLeft: box.cropLeft,
                    cropRight: box.cropRight,
                    autoTrim: true,
                    sensitivity: cropSensitivity,
                    padding: cropPaddingPx,
                    backgroundColorMode: cropBackgroundMode
                  })
                });

                if (cropRes.ok) {
                  const cropData = await cropRes.json();
                  if (cropData.success && cropData.url) {
                    slicedUrls.push(cropData.url);
                  }
                }
              }

              if (slicedUrls.length > 0) {
                // Delete the giant combined strip from raw images deck list
                const currentIdx = updatedImages.indexOf(imgUrl);
                if (currentIdx !== -1) {
                  // Replace it with the newly extracted panels
                  updatedImages.splice(currentIdx, 1, ...slicedUrls);
                }
                
                // Remove from active selections
                const currentSelIdx = updatedSelected.indexOf(imgUrl);
                if (currentSelIdx !== -1) {
                  updatedSelected.splice(currentSelIdx, 1);
                }
                
                // Also update any active storyboard panel that references this old unsegmented image
                setPanels(prevPanels => {
                  let mapped = [...prevPanels];
                  let didChange = false;
                  
                  // If standard panel matches old url, segment it
                  const matchedIdxs = mapped.map((p, pIdx) => p.image_url === imgUrl ? pIdx : -1).filter(pIdx => pIdx !== -1);
                  if (matchedIdxs.length > 0) {
                    // For each found old panel we split it up
                    // For simplicity, we replace with first slot, and inject the rest
                    for (const matchedIdx of matchedIdxs) {
                      const oldPanel = mapped[matchedIdx];
                      const replacementPanels = slicedUrls.map((sUrl, sIdx) => ({
                        id: sIdx === 0 ? oldPanel.id : Math.max(...mapped.map(p => p.id)) + 1 + sIdx,
                        image_url: sUrl,
                        speech_text: sIdx === 0 ? oldPanel.speech_text : `Divided panel segment #${sIdx+1} dialogue transcription context.`,
                        sfx: sIdx === 0 ? oldPanel.sfx : "[Action Blur]",
                        duration: 4.5,
                        motion_type: oldPanel.motion_type
                      }));
                      mapped.splice(matchedIdx, 1, ...replacementPanels);
                      didChange = true;
                    }
                  }
                  return didChange ? mapped : prevPanels;
                });

                setConsoleLogs(prev => [
                  `[Auto Slicer] Successfully subdivided composite strip, loaded ${slicedUrls.length} individual panels inside asset deck.`,
                  ...prev
                ]);
                continue; // Skip standard cropping since we already customized and split this image!
              }
            }
          } catch (splitErr: any) {
            console.warn("[Auto Slicer Indicator] Division failed, falling back to basic auto-crop:", splitErr);
          }
        }

        // Standard auto-crop if no subdivision split detected or requested
        const response = await fetch("/api/edit-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            url: imgUrl,
            cropTop: 0,
            cropBottom: 0,
            cropLeft: 0,
            cropRight: 0,
            autoTrim: true,
            sensitivity: cropSensitivity,
            padding: cropPaddingPx,
            backgroundColorMode: cropBackgroundMode
          })
        });

        if (!response.ok) {
          throw new Error(`Auto-trim request failed with status ${response.status}`);
        }

        const data = await response.json();
        if (data.success && data.url) {
          const currentIdx = updatedImages.indexOf(imgUrl);
          if (currentIdx !== -1) {
            updatedImages[currentIdx] = data.url;
          }
          
          const selIdx = updatedSelected.indexOf(imgUrl);
          if (selIdx !== -1) {
            updatedSelected[selIdx] = data.url;
          }

          // Propagate image changes to existing matching storyboard frames!
          setPanels(prevPanels => 
            prevPanels.map(p => p.image_url === imgUrl ? { ...p, image_url: data.url } : p)
          );
        }
      }

      setScrapedImages(updatedImages);
      setSelectedScraped(updatedSelected);
      setConsoleLogs(prev => [
        `[Auto Cropper] Successfully completed smart layout auto-crops for all checked images!`,
        ...prev
      ]);
    } catch (err: any) {
      console.error("[Auto Cropper] Batch process failed:", err);
      setConsoleLogs(prev => [
        `[Auto Cropper ERROR] Smart trimming operation failed: ${err.message || err}`,
        ...prev
      ]);
      addNotification(err.message || "Auto-crop failed. Please try again.", "error");
    } finally {
      setIsBatchCropping(false);
    }
  };

  return (
    <div id="scraped_strips_deck" className="bg-neutral-900/40 rounded-2xl border border-neutral-800/80 p-6 backdrop-blur-md space-y-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800/60 pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-purple-400">
            <ImageIcon className="h-4 w-4" />
            <span className="text-[10px] font-semibold tracking-wider uppercase font-mono">Separated Panels</span>
          </div>
          <h3 className="font-bold text-sm text-white">Live Asset Extraction</h3>
        </div>
        <div className="flex items-center gap-3">
          {scrapedImages.length > 0 && (
            <span className="text-[9px] px-2.5 py-1 font-mono tracking-wider bg-purple-950/50 text-purple-300 rounded-full border border-purple-800/50 shadow-inner">
              {scrapedImages.length} Frames
            </span>
          )}
          <button
            onClick={() => {
              setScrapedImages([]);
              setSelectedScraped([]);
              setConsoleLogs(prev => ["[GUI] Cleared all assets from the deck", ...prev]);
            }}
            className="flex items-center gap-1 text-[9px] font-mono text-neutral-500 hover:text-red-400 bg-neutral-900/50 hover:bg-red-950/20 px-2 py-1 rounded-full border border-neutral-800 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
            Clear All
          </button>
        </div>
      </div>

      {isScraping ? (
        <div className="flex flex-col items-center justify-center py-8 space-y-3">
          <RefreshCw className="h-6 w-6 text-purple-500 animate-spin" />
          <p className="text-xs text-neutral-400 font-mono">Analyzing Webtoon viewer page, extraction in progress...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Select Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-950/40 p-3 rounded-xl border border-neutral-800/60">
            <div className="space-y-0.5">
              <p className="text-xs text-neutral-400">
                These live graphics are separated dynamically from the viewer URL.
              </p>
              {scrapedImages.length > 0 && (
                <div className="text-[10px] font-mono text-neutral-500">
                  Selected: <span className="text-purple-400 font-bold font-mono">{selectedScraped.length}</span> / {scrapedImages.length}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  if (selectedScraped.length === scrapedImages.length) {
                    setSelectedScraped([]);
                    setConsoleLogs(prev => ["[GUI] Cleared selections", ...prev]);
                  } else {
                    setSelectedScraped([...scrapedImages]);
                    setConsoleLogs(prev => ["[GUI] Selected all extracted frames", ...prev]);
                  }
                }}
                disabled={scrapedImages.length === 0}
                className="bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-mono border border-neutral-800/60 cursor-pointer flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {selectedScraped.length === scrapedImages.length && scrapedImages.length > 0 ? (
                  <>
                    <Square className="h-3.5 w-3.5 text-neutral-500" />
                    <span>Deselect All</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-3.5 w-3.5 text-purple-400" />
                    <span>Select All</span>
                  </>
                )}
              </button>

              <div className="flex bg-neutral-900 border border-neutral-800/60 rounded-lg">
                <button
                  onClick={handleAutoCropSelected}
                  disabled={isBatchCropping || selectedScraped.length === 0}
                  className="bg-indigo-650 hover:bg-indigo-550 border-r border-indigo-500/30 text-white px-3 py-1.5 rounded-l-lg text-xs font-mono cursor-pointer flex items-center gap-1.5 transition-all font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isBatchCropping ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Scissors className="h-3.5 w-3.5 text-indigo-300" />
                  )}
                  <span>{isAiEnabled ? "Smart Crop" : "Auto-Crop"}</span>
                </button>

                <button
                  onClick={isAiEnabled ? handleAiCropSelected : handleAutoCropSelected}
                  disabled={(isAiEnabled ? isAiCropping : isBatchCropping) || selectedScraped.length === 0}
                  className="bg-purple-800 hover:bg-purple-700 text-white px-2.5 py-1.5 text-xs font-mono cursor-pointer flex items-center gap-1.5 transition-all font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                   {isAiEnabled ? (
                     isAiCropping ? <RefreshCw className="h-3.5 w-3.5 animate-spin"/> : <Brain className="h-3.5 w-3.5 text-purple-200" />
                   ) : (
                     <Scissors className="h-3.5 w-3.5 text-purple-200" />
                   )}
                   <span>{isAiEnabled ? "Process (AI)" : "Process (Standard)"}</span>
                </button>

                <button
                  onClick={() => setShowAutoCropSettings(prev => !prev)}
                  className={`px-2.5 py-1.5 rounded-r-lg text-xs font-mono cursor-pointer flex items-center transition-all ${
                    showAutoCropSettings 
                      ? "bg-purple-950 text-purple-200" 
                      : "bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                  }`}
                  title="Configure smart Auto-Crop parameters (strength, margins, separation)"
                >
                  <Sliders className="h-3.5 w-3.5 text-purple-400" />
                </button>
              </div>

              <button
                onClick={() => {
                  if (selectedScraped.length === 0) return;
                  setScrapedImages(prev => prev.filter(img => !selectedScraped.includes(img)));
                  setConsoleLogs(prev => [
                    `[GUI] Removed ${selectedScraped.length} selected images from the deck`,
                    ...prev
                  ]);
                  setSelectedScraped([]);
                }}
                className="bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-red-100 px-2.5 py-1.5 rounded-lg text-xs font-mono border border-red-900/40 cursor-pointer flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={selectedScraped.length === 0}
              >
                <Trash2 className="h-3.5 w-3.5 text-red-400" />
                <span>Delete Selected</span>
              </button>

              <button
                onClick={() => {
                  if (selectedScraped.length === 0) return;
                  const addedPanels: GeneratedPanel[] = selectedScraped.map((imgUrl, loopIdx) => {
                    const originalIdx = scrapedImages.indexOf(imgUrl);
                    const cardNum = originalIdx !== -1 ? originalIdx + 1 : loopIdx + 1;
                    const newId = panels.length > 0 ? Math.max(...panels.map(p => p.id)) + 1 + loopIdx : 1 + loopIdx;
                    return {
                      id: newId,
                      image_url: imgUrl,
                      speech_text: `Batch dialogue script narration for separated frame #${cardNum}.`,
                      sfx: "[Surge]",
                      duration: 4.5,
                      motion_type: "zoom_in"
                    };
                  });
                  setPanels(prev => [...prev, ...addedPanels]);
                  setConsoleLogs(prev => [
                    `[GUI] Batch appended ${selectedScraped.length} selected images structure to storyboard panels.`,
                    ...prev
                  ]);
                  setSelectedScraped([]);
                }}
                className="bg-purple-600 hover:bg-purple-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-mono cursor-pointer flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={selectedScraped.length === 0}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Insert Selected</span>
              </button>
            </div>
          </div>

          {showAutoCropSettings && (
            <div id="smart_crop_options_box" className="bg-neutral-950/80 p-5 rounded-2xl border border-purple-900/40 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fadeIn shadow-2xl">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider font-mono flex justify-between">
                  <span>Sensitivity</span>
                  <span className="text-white font-bold">{cropSensitivity}%</span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="90"
                  value={cropSensitivity}
                  onChange={(e) => setCropSensitivity(Number(e.target.value))}
                  className="w-full accent-purple-500 bg-neutral-800 rounded-lg h-1.5 px-0 cursor-pointer hover:accent-purple-400 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider font-mono flex justify-between">
                  <span>Margin Padding</span>
                  <span className="text-white font-bold">{cropPaddingPx}px</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={cropPaddingPx}
                  onChange={(e) => setCropPaddingPx(Number(e.target.value))}
                  className="w-full accent-purple-500 bg-neutral-800 rounded-lg h-1.5 px-0 cursor-pointer hover:accent-purple-400 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider font-mono block">
                  Color Filter
                </label>
                <select
                  value={cropBackgroundMode}
                  onChange={(e) => setCropBackgroundMode(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 rounded-lg px-3 py-2 text-xs font-mono focus:border-purple-600 focus:outline-none hover:border-neutral-500 transition-colors cursor-pointer"
                >
                  <option value="auto">Auto-Detect BG</option>
                  <option value="white">Force White</option>
                  <option value="black">Force Black</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider font-mono block">
                  Processing Strategy
                </label>
                <select
                  className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 rounded-lg px-3 py-2 text-xs font-mono focus:border-purple-600 focus:outline-none hover:border-neutral-500 transition-colors cursor-pointer"
                >
                  <option value="balanced">Balanced Quality</option>
                  <option value="precise">High Precision</option>
                  <option value="fast">High Speed</option>
                </select>
              </div>

              <div className="col-span-1 md:col-span-2 lg:col-span-4 border-t border-neutral-800 pt-4 flex gap-4 flex-wrap">
                <label className="relative flex items-center gap-3 bg-neutral-900/60 border border-neutral-700 rounded-xl px-4 py-3 cursor-pointer hover:bg-neutral-800 transition-all select-none flex-1">
                  <input
                    type="checkbox"
                    checked={isAiEnabled}
                    onChange={(e) => setIsAiEnabled(e.target.checked)}
                    className="accent-purple-500 h-4 w-4 rounded"
                  />
                  <div className="flex flex-col">
                    <span className="text-[12px] font-bold text-white">Enable AI Crop</span>
                    <span className="text-[10px] text-neutral-400">Use generative analysis for complex panels (Quota: 20/day).</span>
                  </div>
                </label>

                <label className="relative flex items-center gap-3 bg-neutral-900/60 border border-neutral-700 rounded-xl px-4 py-3 cursor-pointer hover:bg-neutral-800 transition-all select-none flex-1">
                  <input
                    type="checkbox"
                    checked={autoSplitTallStrips}
                    onChange={(e) => setAutoSplitTallStrips(e.target.checked)}
                    className="accent-purple-500 h-4 w-4 rounded"
                  />
                  <div className="flex flex-col">
                    <span className="text-[12px] font-bold text-white">Auto-Split Strips</span>
                    <span className="text-[10px] text-neutral-400">Automatically slice long strips into panels.</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          <div className="flex gap-4 overflow-x-auto pb-4 pt-1.5 scrollbar-thin">
            {scrapedImages.map((imgUrl, idx) => {
              const isSelected = selectedScraped.includes(imgUrl);
              return (
                <div 
                  key={`${imgUrl}-${idx}`}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedScraped(prev => prev.filter(img => img !== imgUrl));
                    } else {
                      setSelectedScraped(prev => [...prev, imgUrl]);
                    }
                  }}
                  className={`group relative w-[140px] shrink-0 rounded-xl border p-2 space-y-2 transition-all text-center cursor-pointer select-none ${
                    isSelected 
                      ? "border-purple-500 bg-purple-950/20 shadow-lg shadow-purple-900/40" 
                      : "border-neutral-800 bg-neutral-950 hover:border-purple-500/80"
                  }`}
                >
                  {/* Image preview frame */}
                  <div className="relative h-28 rounded-lg overflow-hidden bg-neutral-900 flex items-center justify-center">
                    <img 
                      src={imgUrl} 
                      alt={`Scraped Segment ${idx}`}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                    
                    {/* Card badge index */}
                    <div className="absolute top-1 left-1 bg-black/75 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold text-purple-400">
                      #{idx + 1}
                    </div>

                    {/* Check Circle corner indicator overlay */}
                    <div className={`absolute top-1 right-1 rounded-full p-0.5 border transition-all ${
                      isSelected 
                        ? "bg-purple-600 border-purple-400 text-white opacity-100" 
                        : "bg-black/60 border-neutral-700 text-transparent opacity-0 group-hover:opacity-100 hover:text-neutral-300"
                    }`}>
                      <Check className="h-2.5 w-2.5 font-bold text-white" />
                    </div>
                  </div>

                  {/* Action Controls */}
                  <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        const newId = panels.length > 0 ? Math.max(...panels.map(p => p.id)) + 1 : 1;
                        const newPanel: GeneratedPanel = {
                          id: newId,
                          image_url: imgUrl,
                          speech_text: `New dialogue narration script for separated frame segment #${idx + 1}.`,
                          sfx: "[Surge]",
                          duration: 4.5,
                          motion_type: "zoom_in"
                        };
                        setPanels(prev => [...prev, newPanel]);
                        setConsoleLogs(prev => [
                          `[GUI] Added extracted image #${idx + 1} as a brand-new storyboard frame`,
                          ...prev
                        ]);
                      }}
                      className="w-full bg-purple-600 hover:bg-purple-500 text-white text-[9px] py-1 rounded font-mono transition-colors font-medium border border-purple-500/30 cursor-pointer text-center flex items-center justify-center gap-1"
                    >
                      <span>+ Insert to Storyboard</span>
                    </button>

                    {/* Individual stitch with next element option */}
                    {idx < scrapedImages.length - 1 && (
                      <button
                        onClick={() => handleStitchWithNext(idx)}
                        disabled={stitchingIndices.includes(idx)}
                        className="w-full bg-indigo-950/40 hover:bg-indigo-900 border border-indigo-900/60 text-indigo-300 hover:text-indigo-100 text-[9px] py-1 rounded font-mono transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {stitchingIndices.includes(idx) ? (
                          <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                        ) : (
                          <span className="text-[10px] font-bold">🔗</span>
                        )}
                        <span>Stitch with #{idx + 2}</span>
                      </button>
                    )}
                    
                    <div className="flex gap-1 justify-between items-center bg-transparent w-full">
                      {/* Remove Background and Crop Scissors Button */}
                      <button
                        onClick={() => {
                          setEditingImageIdx(idx);
                          setEditCropTop(0);
                          setEditCropBottom(0);
                          setEditCropLeft(0);
                          setEditCropRight(0);
                          setEditAutoTrim(true);
                        }}
                        title="Crop & Trim White Background"
                        className="flex-1 flex items-center justify-center gap-1 bg-neutral-900 hover:bg-purple-950 hover:text-purple-400 text-neutral-400 py-1 rounded border border-neutral-800 hover:border-purple-900/60 transition-colors cursor-pointer text-[10px] font-mono"
                      >
                        <Scissors className="h-3 w-3" />
                        <span>Edit</span>
                      </button>

                      {/* Remove individual extracted image */}
                      <button
                        onClick={() => {
                          setScrapedImages(prev => prev.filter((_, i) => i !== idx));
                          setSelectedScraped(prev => prev.filter(img => img !== imgUrl));
                          setConsoleLogs(prev => [
                            `[GUI] Deleted extracted frame #${idx + 1} from deck.`,
                            ...prev
                          ]);
                        }}
                        title="Remove element from deck"
                        className="flex-1 flex items-center justify-center gap-1 bg-neutral-900 hover:bg-red-950 hover:text-red-400 text-neutral-500 py-1 rounded border border-neutral-800 hover:border-red-900/60 transition-colors cursor-pointer text-[10px] font-mono"
                      >
                        <Trash className="h-3 w-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
