import React from "react";
import { 
  Scissors, 
  X, 
  RefreshCw, 
  Crop, 
  Sparkles, 
  Plus, 
  Trash2, 
  Layers, 
  Move, 
  Check,
  Brain
} from "lucide-react";

interface Slot {
  cropTop: number;
  cropBottom: number;
  cropLeft: number;
  cropRight: number;
  autoTrim: boolean;
}

import { NotificationType } from "./NotificationStack";

interface CropEditorModalProps {
  editingImageIdx: number | null;
  setEditingImageIdx: (idx: number | null) => void;
  editCropTop: number;
  setEditCropTop: (val: number) => void;
  editCropBottom: number;
  setEditCropBottom: (val: number) => void;
  editCropLeft: number;
  setEditCropLeft: (val: number) => void;
  editCropRight: number;
  setEditCropRight: (val: number) => void;
  editAutoTrim: boolean;
  setEditAutoTrim: (val: boolean) => void;
  scrapedImages: string[];
  setScrapedImages?: React.Dispatch<React.SetStateAction<string[]>>;
  isSavingEdit: boolean;
  handleSaveEditedImage: () => Promise<void>;
  handleSaveMultipleCuts: (cuts: Slot[]) => Promise<void>;
  setConsoleLogs?: React.Dispatch<React.SetStateAction<string[]>>;
  addNotification: (message: string, type: NotificationType) => void;
}

interface Slice {
  id: string;
  cropTop: number;
  cropBottom: number;
  cropLeft: number;
  cropRight: number;
  autoTrim: boolean;
}

export default function CropEditorModal({
  editingImageIdx,
  setEditingImageIdx,
  editCropTop,
  setEditCropTop,
  editCropBottom,
  setEditCropBottom,
  editCropLeft,
  setEditCropLeft,
  editCropRight,
  setEditCropRight,
  editAutoTrim,
  setEditAutoTrim,
  scrapedImages,
  isSavingEdit,
  handleSaveEditedImage,
  handleSaveMultipleCuts,
  addNotification
}: CropEditorModalProps) {
  if (editingImageIdx === null) return null;

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dragStart, setDragStart] = React.useState<{ x: number; y: number } | null>(null);
  const [dragType, setDragType] = React.useState<'draw' | 'move' | null>(null);
  const [dragStartPercent, setDragStartPercent] = React.useState<{ x: number; y: number } | null>(null);
  const [originalCropBounds, setOriginalCropBounds] = React.useState<{ top: number; bottom: number; left: number; right: number } | null>(null);

  const [detectedBoxes, setDetectedBoxes] = React.useState<Array<{
    cropTop: number;
    cropBottom: number;
    cropLeft: number;
    cropRight: number;
    width: number;
    height: number;
    area: number;
  }>>([]);
  const [isDetecting, setIsDetecting] = React.useState<boolean>(false);
  const [isAiDetecting, setIsAiDetecting] = React.useState<boolean>(false);

  // Multiple Cut List
  const [slices, setSlices] = React.useState<Slice[]>([]);
  const [selectedSliceId, setSelectedSliceId] = React.useState<string | null>(null);

  // Clear states when transitioning editing frames
  React.useEffect(() => {
    setDetectedBoxes([]);
    setSlices([]);
    setSelectedSliceId(null);
  }, [editingImageIdx]);

  // Sync active coordinates state into the currently selected slice to support on-canvas fine-tuning
  React.useEffect(() => {
    if (selectedSliceId) {
      setSlices(prev => prev.map(s => s.id === selectedSliceId ? {
        ...s,
        cropTop: editCropTop,
        cropBottom: editCropBottom,
        cropLeft: editCropLeft,
        cropRight: editCropRight
      } : s));
    }
  }, [editCropTop, editCropBottom, editCropLeft, editCropRight, selectedSliceId]);

  const handleAiCrop = async () => {
    if (editingImageIdx === null) return;
    const currentUrl = scrapedImages[editingImageIdx];
    setIsAiDetecting(true);
    try {
      const response = await fetch("/api/ai-detect-panels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: currentUrl })
      });
      if (!response.ok) throw new Error("AI analysis failed");
      const data = await response.json();
      if (data.success && Array.isArray(data.panels) && data.panels.length > 0) {
        // Populate all panels into the slices list instead of just the first one
        const newSlices = data.panels.map((box: any, index: number) => ({
          id: `ai-${index}-${Date.now()}`,
          cropTop: box.cropTop,
          cropBottom: box.cropBottom,
          cropLeft: box.cropLeft,
          cropRight: box.cropRight,
          autoTrim: editAutoTrim
        }));
        
        setSlices(prev => [...prev, ...newSlices]);
        
        // Select the first of the newly added slices
        const firstNew = newSlices[0];
        setSelectedSliceId(firstNew.id);
        setEditCropLeft(firstNew.cropLeft);
        setEditCropRight(firstNew.cropRight);
        setEditCropTop(firstNew.cropTop);
        setEditCropBottom(firstNew.cropBottom);
      }
    } catch (err: any) {
      console.error("AI crop detection failed:", err);
      addNotification(err.message || "AI crop detection failed. Please try again.", "error");
    } finally {
      setIsAiDetecting(false);
    }
  };

  const handleDetectPanels = async () => {
    if (editingImageIdx === null) return;
    const currentUrl = scrapedImages[editingImageIdx];
    setIsDetecting(true);
    try {
      const response = await fetch("/api/detect-panels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: currentUrl })
      });
      if (!response.ok) throw new Error("Failed to detect panels");
      const data = await response.json();
      if (data.success && Array.isArray(data.panels)) {
        setDetectedBoxes(data.panels);
        if (data.panels.length > 0) {
          const initialSlices = data.panels.map((box: any, index: number) => ({
            id: `detected-${index}-${Date.now()}`,
            cropTop: box.cropTop,
            cropBottom: box.cropBottom,
            cropLeft: box.cropLeft,
            cropRight: box.cropRight,
            autoTrim: editAutoTrim
          }));
          setSlices(initialSlices);

          // Default select the first panel
          const first = initialSlices[0];
          setSelectedSliceId(first.id);
          setEditCropLeft(first.cropLeft);
          setEditCropRight(first.cropRight);
          setEditCropTop(first.cropTop);
          setEditCropBottom(first.cropBottom);
        }
      }
    } catch (err: any) {
      console.error("Detect panels failed, trying AI fallback:", err);
      addNotification("Panel detection failed, trying AI-based detection...", "info");
      await handleAiCrop();
    } finally {
      setIsDetecting(false);
    }
  };

  // Check if pointer click was registered inside the current active crop selection
  const isPointInsideSelection = (x: number, y: number) => {
    if (editCropTop === 0 && editCropBottom === 0 && editCropLeft === 0 && editCropRight === 0) {
      return false;
    }
    const top = editCropTop;
    const bottom = 100 - editCropBottom;
    const left = editCropLeft;
    const right = 100 - editCropRight;
    return x >= left && x <= right && y >= top && y <= bottom;
  };

  const handleStart = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

    if (isPointInsideSelection(x, y)) {
      setDragType('move');
      setDragStartPercent({ x, y });
      setOriginalCropBounds({
        top: editCropTop,
        bottom: editCropBottom,
        left: editCropLeft,
        right: editCropRight
      });
    } else {
      setDragType('draw');
      setDragStart({ x, y });
    }
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

    if (dragType === 'draw' && dragStart) {
      const left = Math.min(dragStart.x, x);
      const right = 100 - Math.max(dragStart.x, x);
      const top = Math.min(dragStart.y, y);
      const bottom = 100 - Math.max(dragStart.y, y);

      setEditCropLeft(parseFloat(Math.max(0, Math.min(85, left)).toFixed(1)));
      setEditCropRight(parseFloat(Math.max(0, Math.min(85, right)).toFixed(1)));
      setEditCropTop(parseFloat(Math.max(0, Math.min(85, top)).toFixed(1)));
      setEditCropBottom(parseFloat(Math.max(0, Math.min(85, bottom)).toFixed(1)));
    } else if (dragType === 'move' && dragStartPercent && originalCropBounds) {
      const deltaX = x - dragStartPercent.x;
      const deltaY = y - dragStartPercent.y;

      let newLeft = originalCropBounds.left + deltaX;
      let newRight = originalCropBounds.right - deltaX;
      let newTop = originalCropBounds.top + deltaY;
      let newBottom = originalCropBounds.bottom - deltaY;

      const width = 100 - originalCropBounds.left - originalCropBounds.right;
      const height = 100 - originalCropBounds.top - originalCropBounds.bottom;

      if (newLeft < 0) {
        newLeft = 0;
        newRight = 100 - width;
      } else if (newRight < 0) {
        newRight = 0;
        newLeft = 100 - width;
      }

      if (newTop < 0) {
        newTop = 0;
        newBottom = 100 - height;
      } else if (newBottom < 0) {
        newBottom = 0;
        newTop = 100 - height;
      }

      setEditCropLeft(parseFloat(Math.max(0, Math.min(100, newLeft)).toFixed(1)));
      setEditCropRight(parseFloat(Math.max(0, Math.min(100, newRight)).toFixed(1)));
      setEditCropTop(parseFloat(Math.max(0, Math.min(100, newTop)).toFixed(1)));
      setEditCropBottom(parseFloat(Math.max(0, Math.min(100, newBottom)).toFixed(1)));
    }
  };

  const handleEnd = () => {
    setDragStart(null);
    setDragType(null);
    setDragStartPercent(null);
    setOriginalCropBounds(null);
  };

  // Save selection onto the slices generator deck
  const handlePushToSlices = () => {
    const newSlice: Slice = {
      id: `slice-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      cropTop: editCropTop,
      cropBottom: editCropBottom,
      cropLeft: editCropLeft,
      cropRight: editCropRight,
      autoTrim: editAutoTrim
    };
    setSlices(prev => [...prev, newSlice]);
    setSelectedSliceId(newSlice.id);
  };

  const handleSelectSlice = (slice: Slice) => {
    setSelectedSliceId(slice.id);
    setEditCropTop(slice.cropTop);
    setEditCropBottom(slice.cropBottom);
    setEditCropLeft(slice.cropLeft);
    setEditCropRight(slice.cropRight);
  };

  const handleDeleteSlice = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSlices(prev => prev.filter(s => s.id !== id));
    if (selectedSliceId === id) {
      setSelectedSliceId(null);
    }
  };

  const handleExecuteSave = () => {
    if (slices.length > 0) {
      const cuts = slices.map(s => ({
        cropTop: s.cropTop,
        cropBottom: s.cropBottom,
        cropLeft: s.cropLeft,
        cropRight: s.cropRight,
        autoTrim: s.autoTrim
      }));
      handleSaveMultipleCuts(cuts);
    } else {
      handleSaveEditedImage();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto duration-300 animate-[fadeIn_0.2s_ease-out]"
    >
      <div
        className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col my-auto max-h-[90vh] duration-300 animate-[zoomIn_0.2s_ease-out]"
      >
          {/* Header */}
          <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/40">
            <div className="flex items-center gap-2">
              <Scissors className="h-4.5 w-4.5 text-purple-400" />
              <div>
                <h3 className="font-bold text-sm text-white">Advanced Drop & Drag Multiple-Cut Generator</h3>
                <p className="text-[10px] text-neutral-400 font-mono">
                  Slicing and Trimming Frame #{editingImageIdx + 1} with custom coordinates drag-and-drop
                </p>
              </div>
            </div>
            <button
              onClick={() => setEditingImageIdx(null)}
              className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-850 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Main Content Pane */}
          <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto select-none">
            
            {/* Left side: Visual Preview Area (Canvas) */}
            <div className="lg:col-span-7 flex flex-col space-y-2">
              <div className="flex justify-between items-center bg-neutral-950/50 p-2 rounded-lg border border-neutral-850">
                <div className="flex items-center gap-2">
                  <Move className="h-3.5 w-3.5 text-purple-400" />
                  <span className="text-[10px] uppercase font-mono font-bold text-neutral-300 tracking-wider">
                    Interactive Viewport Canvas
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={handleAiCrop}
                    disabled={isAiDetecting}
                    className="flex items-center gap-1.5 bg-purple-900/40 text-purple-200 hover:bg-purple-800/60 px-2 py-0.5 rounded border border-purple-800/45 text-[9px] font-mono font-bold"
                  >
                    {isAiDetecting ? <RefreshCw className="h-3 w-3 animate-spin"/> : <Brain className="h-3 w-3" />}
                    <span>AI Smart Crop</span>
                  </button>
                  <span className="text-[9px] bg-purple-950 text-purple-300 font-mono font-bold px-2 py-0.5 rounded border border-purple-800/45">
                    Drag empty area to Draw
                  </span>
                  <span className="text-[9px] bg-emerald-950 text-emerald-300 font-mono font-bold px-2 py-0.5 rounded border border-emerald-800/45">
                    Drag selection to Move
                  </span>
                </div>
              </div>
              
              <div 
                ref={containerRef}
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  handleStart(e.clientX, e.clientY);
                }}
                onMouseMove={(e) => {
                  handleMove(e.clientX, e.clientY);
                }}
                onMouseUp={handleEnd}
                onMouseLeave={handleEnd}
                onTouchStart={(e) => {
                  if (e.touches && e.touches[0]) {
                    handleStart(e.touches[0].clientX, e.touches[0].clientY);
                  }
                }}
                onTouchMove={(e) => {
                  if (e.touches && e.touches[0]) {
                    handleMove(e.touches[0].clientX, e.touches[0].clientY);
                  }
                }}
                onTouchEnd={handleEnd}
                className="relative border border-neutral-800 hover:border-purple-500/30 rounded-xl bg-neutral-950 overflow-hidden h-[450px] flex items-center justify-center p-1 select-none transition-colors"
                style={{ cursor: isPointInsideSelection(0, 0) ? "default" : "crosshair" }}
              >
                {/* The raw image source */}
                <img 
                  src={scrapedImages[editingImageIdx]} 
                  alt="Crop segment preview"
                  className="max-h-full max-w-full object-contain pointer-events-none select-none"
                  referrerPolicy="no-referrer"
                />

                {/* RED SHADED AREAS REPRESENTING THE CROPPING BOUNDS (Only shown for non-full items) */}
                {!(editCropTop === 0 && editCropBottom === 0 && editCropLeft === 0 && editCropRight === 0) && (
                  <>
                    <div 
                      className="absolute top-0 left-0 right-0 bg-black/60 border-b border-purple-500/40 transition-all duration-75 pointer-events-none" 
                      style={{ height: `${editCropTop}%` }} 
                    />
                    <div 
                      className="absolute bottom-0 left-0 right-0 bg-black/60 border-t border-purple-500/40 transition-all duration-75 pointer-events-none" 
                      style={{ height: `${editCropBottom}%` }} 
                    />
                    <div 
                      className="absolute top-0 bottom-0 left-0 bg-black/60 border-r border-purple-500/40 transition-all duration-75 pointer-events-none" 
                      style={{ width: `${editCropLeft}%` }} 
                    />
                    <div 
                      className="absolute top-0 bottom-0 right-0 bg-black/60 border-l border-purple-500/40 transition-all duration-75 pointer-events-none" 
                      style={{ width: `${editCropRight}%` }} 
                    />
                  </>
                )}

                {/* SLICES VISUAL OVERLAYS */}
                {slices.map((slice, index) => {
                  const isSelected = slice.id === selectedSliceId;
                  return (
                    <div
                      key={slice.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectSlice(slice);
                      }}
                      className={`absolute border-2 pointer-events-auto cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? "border-emerald-400 bg-emerald-500/20 z-30 shadow-lg shadow-emerald-500/10"
                          : "border-purple-500/50 bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-400 z-20"
                      }`}
                      style={{
                        top: `${slice.cropTop}%`,
                        bottom: `${slice.cropBottom}%`,
                        left: `${slice.cropLeft}%`,
                        right: `${slice.cropRight}%`
                      }}
                    >
                      <div className="p-1">
                        <span className={`inline-block font-mono text-[8px] font-bold px-1.5 py-0.5 rounded shadow ${
                          isSelected 
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-800" 
                            : "bg-purple-950/90 text-purple-300 border border-purple-800/80"
                        }`}>
                          Cut #{index + 1} {isSelected ? "★ Active" : ""}
                        </span>
                      </div>

                      <div className="flex justify-end p-1">
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSlice(slice.id, e)}
                          className="bg-red-950/90 hover:bg-red-900 border border-red-800 text-red-300 p-0.5 rounded cursor-pointer transition-colors"
                          title="Delete this cut"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* ACTIVE CROP BOX BOUNDARY GUIDES */}
                {(editCropTop !== 0 || editCropBottom !== 0 || editCropLeft !== 0 || editCropRight !== 0) && (
                  <div 
                    className="absolute border-2 border-dashed border-emerald-400 bg-emerald-500/5 pointer-events-none transition-all duration-75"
                    style={{
                      top: `${editCropTop}%`,
                      bottom: `${editCropBottom}%`,
                      left: `${editCropLeft}%`,
                      right: `${editCropRight}%`,
                    }}
                  >
                    {/* Corner aesthetics */}
                    <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-white -translate-x-[2px] -translate-y-[2px]" />
                    <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-white translate-x-[2px] -translate-y-[2px]" />
                    <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-white -translate-x-[2px] translate-y-[2px]" />
                    <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-white translate-x-[2px] translate-y-[2px]" />
                    
                    {/* Quick helper tag to drag-to-move */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/85 text-[9px] font-bold tracking-wide text-neutral-200 border border-neutral-700 px-2 py-1 rounded shadow-lg backdrop-blur flex items-center gap-1">
                      <Move className="h-3 w-3 text-purple-400 animate-pulse" />
                      <span>Drag to Reposition</span>
                    </div>

                    {/* Specifications badge inside selection */}
                    <div className="absolute top-2 left-2 bg-emerald-950/95 text-[9px] font-mono font-bold text-emerald-300 border border-emerald-800/80 px-2 py-0.5 rounded shadow">
                      Retained: {parseFloat((100 - editCropLeft - editCropRight).toFixed(1))}% &times; {parseFloat((100 - editCropTop - editCropBottom).toFixed(1))}%
                    </div>
                  </div>
                )}
              </div>
              
              <span className="text-[10px] text-neutral-500 text-center italic font-sans block pt-1">
                Drag on unpopulated image space to draw new panels. Grab and shift any box selection to drag-and-drop it.
              </span>
            </div>

            {/* Right side: Multi-slice list and telemetry controls */}
            <div className="lg:col-span-5 flex flex-col space-y-4">
              
              {/* SECTION: BATCH MULTIPLE CUT GENERATOR */}
              <div className="space-y-3 bg-neutral-950/50 p-4 rounded-xl border border-neutral-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-mono font-bold text-purple-400 tracking-wider">
                    Target Cuts Registry
                  </span>
                  <span className="text-[9px] bg-purple-900/30 text-purple-300 font-bold px-2 py-0.5 rounded border border-purple-800/50">
                    {slices.length} Cuts Defined
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handlePushToSlices}
                    disabled={editCropTop === 0 && editCropBottom === 0 && editCropLeft === 0 && editCropRight === 0}
                    className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-35 disabled:cursor-not-allowed text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2 shadow"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Save Selection as Cut</span>
                  </button>
                </div>

                {slices.length === 0 ? (
                  <div className="border border-neutral-850 border-dashed rounded-xl p-6 text-center text-neutral-500">
                    <Layers className="h-5 w-5 text-neutral-600 mx-auto mb-1.5" />
                    <p className="text-[11px] font-bold text-neutral-400">Cut list is empty</p>
                    <p className="text-[10px] text-neutral-500 leading-normal mt-0.5">
                      Draw on the image canvas and push to cuts list, or use Auto Panel contour detection below to auto-slice.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {slices.map((slice, index) => {
                      const isSelected = slice.id === selectedSliceId;
                      return (
                        <div
                          key={slice.id}
                          onClick={() => handleSelectSlice(slice)}
                          className={`p-2 rounded-xl text-[11px] font-mono border cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
                              ? "bg-emerald-950/40 border-emerald-500/80 text-emerald-300"
                              : "bg-neutral-950 border-neutral-850 hover:bg-neutral-900 text-neutral-400"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-neutral-300">Cut #{index + 1}</span>
                            <span className="text-[9px] opacity-75">
                              ({parseFloat((100 - slice.cropLeft - slice.cropRight).toFixed(1))}% w)
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-neutral-500 font-mono">
                              H:{Math.round(slice.cropTop)}-{Math.round(100 - slice.cropBottom)}%
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteSlice(slice.id, e)}
                              className="text-neutral-500 hover:text-red-400 p-1 rounded hover:bg-neutral-900 transition-colors cursor-pointer"
                              title="Delete individual slice"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* AUTOMATIC OPENCV PANEL SCANNER & LOADER */}
              <div className="space-y-3 bg-neutral-950/40 p-4 rounded-xl border border-neutral-800">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                  <span className="text-[10px] uppercase font-mono font-bold text-neutral-400 tracking-wider">
                    Contours-Detection Auto Slicer
                  </span>
                </div>
                <p className="text-[10px] text-neutral-500 leading-normal">
                  Contour scans look for white gutters to identify individual panel slices. When completed, detected panels are instantly loaded into the Targets list for fine-tuning.
                </p>
                <button
                  type="button"
                  onClick={handleDetectPanels}
                  disabled={isDetecting}
                  className="w-full bg-purple-600/15 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-[11px] font-mono font-semibold py-2.5 rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2"
                >
                  {isDetecting ? (
                    <RefreshCw className="h-3 w-3 animate-spin text-purple-400" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                  )}
                  <span>{isDetecting ? "Executing Scan..." : "Detect & Populate Slices List"}</span>
                </button>
              </div>



            </div>

          </div>

          {/* Action Buttons Footer */}
          <div className="px-6 py-4 bg-neutral-950/60 border-t border-neutral-800 flex items-center justify-between gap-3">
            <span className="text-[10px] text-neutral-400 font-mono italic max-w-[50%] hidden sm:block">
              {slices.length > 0 
                ? `Executing multi-cut split operations will create ${slices.length} new scenes on your deck` 
                : "You are editing a single crop selection"}
            </span>

            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={() => setEditingImageIdx(null)}
                disabled={isSavingEdit}
                className="bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteSave}
                disabled={isSavingEdit}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-2 shadow-lg shadow-purple-900/40"
              >
                {isSavingEdit ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Processing Cuts...</span>
                  </>
                ) : slices.length > 0 ? (
                  <>
                    <Layers className="h-4 w-4 animate-pulse text-purple-200" />
                    <span>Execute Multiple Cuts ({slices.length})</span>
                  </>
                ) : (
                  <>
                    <Crop className="h-3.5 w-3.5" />
                    <span>Execute Single Crop</span>
                  </>
                )}
              </button>
            </div>
          </div>

      </div>
    </div>
  );
}
