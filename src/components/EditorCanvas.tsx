import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Maximize2,
  Move,
  Check,
  RotateCcw,
  Crop,
  Grid,
  Crosshair,
  SlidersHorizontal,
  BookmarkPlus,
  Eye,
  Info,
  Undo2,
  Redo2,
  Wand2,
  GitBranch,
  AlertTriangle,
  CheckCircle2,
  UploadCloud,
  Plus,
  Sparkles,
} from 'lucide-react';
import { PosterItem } from '../types';
import {
  PAPER_SIZES,
  STANDARD_BLEED_INCHES,
  getPaperDimensions,
  calculateBaseFit,
  calculatePresetFit,
  calculatePrintVerdict,
  Orientation,
  PrintVerdict,
} from '../utils/printLogic';

interface EditorCanvasProps {
  item: PosterItem | null;
  onUpdateItem: (updated: PosterItem) => void;
  onSaveToReady: () => void;
  verdict: PrintVerdict | null;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onOpenUpscaler: () => void;
  onRecordHistory: () => void;
  onOpenAdjustSize?: () => void;
  theme?: 'light' | 'dark';
  onAddFiles?: (files: FileList | File[]) => void;
  onLoadSample?: (type: 'bauhaus' | 'cyberpunk' | 'minimalist' | 'wave') => void;
  hideToolbar?: boolean;
}

export const EditorCanvas: React.FC<EditorCanvasProps> = ({
  item,
  onUpdateItem,
  onSaveToReady,
  verdict,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onOpenUpscaler,
  onRecordHistory,
  onOpenAdjustSize,
  theme = 'light',
  onAddFiles,
  onLoadSample,
  hideToolbar = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const emptyFileInputRef = useRef<HTMLInputElement>(null);

  const [showBleedGuides, setShowBleedGuides] = useState<boolean>(true);
  const [showCropMarks, setShowCropMarks] = useState<boolean>(true);
  const [showCrosshairs, setShowCrosshairs] = useState<boolean>(false);
  const [showTransformHandles, setShowTransformHandles] = useState<boolean>(false);
  const [canvasDisplaySize, setCanvasDisplaySize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isDragOverEmpty, setIsDragOverEmpty] = useState<boolean>(false);
  const [showMarginWarning, setShowMarginWarning] = useState<boolean>(false);
  const marginWarningTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Alarm margin warning: only show for 1 to 2 seconds when coverage changes, then auto-disappear
  useEffect(() => {
    if (verdict && !verdict.isFullCoverage) {
      setShowMarginWarning(true);
      if (marginWarningTimerRef.current) clearTimeout(marginWarningTimerRef.current);
      marginWarningTimerRef.current = setTimeout(() => {
        setShowMarginWarning(false);
      }, 2000);
    } else {
      setShowMarginWarning(false);
      if (marginWarningTimerRef.current) clearTimeout(marginWarningTimerRef.current);
    }
    return () => {
      if (marginWarningTimerRef.current) clearTimeout(marginWarningTimerRef.current);
    };
  }, [verdict?.isFullCoverage, item?.transform.f, item?.transform.cx, item?.transform.cy]);

  const [resizingState, setResizingState] = useState<{
    handle: 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w';
    startX: number;
    startY: number;
    startImgW: number;
    startImgH: number;
    startLeft: number;
    startTop: number;
    aspectRatio: number;
  } | null>(null);

  const pointerTrackerRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{
    initialDist: number;
    initialZoom: number;
    initialCx: number;
    initialCy: number;
    initialMidX: number;
    initialMidY: number;
  } | null>(null);


  // Redraw poster on the interactive canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const paperSize = item ? item.paperSize : 'A3';
    const orientation: Orientation = item ? item.orientation : 'portrait';
    const dims = getPaperDimensions(
      paperSize,
      orientation,
      item?.customWidthMm && item?.customHeightMm
        ? { widthMm: item.customWidthMm, heightMm: item.customHeightMm }
        : undefined
    );

    const paperRatio = dims.widthInches / dims.heightInches;
    const containerWidth = Math.max(280, container.clientWidth - 48);
    const containerHeight = Math.max(280, container.clientHeight - 48);

    let displayW: number;
    let displayH: number;

    if (containerWidth / containerHeight < paperRatio) {
      displayW = containerWidth;
      displayH = containerWidth / paperRatio;
    } else {
      displayH = containerHeight;
      displayW = containerHeight * paperRatio;
    }

    setCanvasDisplaySize((prev) => {
      if (prev.width === displayW && prev.height === displayH) return prev;
      return { width: displayW, height: displayH };
    });

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(displayW * dpr);
    canvas.height = Math.round(displayH * dpr);
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Draw white paper base
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, displayW, displayH);

    if (item && item.previewCanvas) {
      const { f, cx, cy } = item.transform;
      const imgW = f * displayW;
      const imgH = imgW * (item.height / item.width);

      const drawX = cx * displayW - imgW / 2;
      const drawY = cy * displayH - imgH / 2;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(item.previewCanvas, drawX, drawY, imgW, imgH);
    } else {
      // Empty state prompt on paper
      ctx.fillStyle = '#f0f3f6';
      ctx.fillRect(0, 0, displayW, displayH);

      ctx.fillStyle = '#8c959f';
      ctx.font = '600 14px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('NO IMAGE LOADED', displayW / 2, displayH / 2 - 12);
      ctx.font = '400 11px system-ui, sans-serif';
      ctx.fillText('Drop image files or load a sample above', displayW / 2, displayH / 2 + 12);
    }

    // Overlay: 3mm Bleed guides (standard print specification)
    if (showBleedGuides) {
      const bleedRatioX = (STANDARD_BLEED_INCHES / dims.widthInches) * displayW;
      const bleedRatioY = (STANDARD_BLEED_INCHES / dims.heightInches) * displayH;

      ctx.save();
      // Outer bleed margin indicator (cyan dashed line)
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(1, 1, displayW - 2, displayH - 2);

      // Safe inner zone (3mm inset, magenta dashed line)
      ctx.strokeStyle = '#ff007f';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(bleedRatioX, bleedRatioY, displayW - bleedRatioX * 2, displayH - bleedRatioY * 2);
      ctx.restore();
    }

    // Overlay: Crop / Trim Marks at corners
    if (showCropMarks) {
      ctx.save();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      const markLen = 14;

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.lineTo(markLen, 8);
      ctx.moveTo(8, 0);
      ctx.lineTo(8, markLen);

      // Top-Right
      ctx.moveTo(displayW, 8);
      ctx.lineTo(displayW - markLen, 8);
      ctx.moveTo(displayW - 8, 0);
      ctx.lineTo(displayW - 8, markLen);

      // Bottom-Left
      ctx.moveTo(0, displayH - 8);
      ctx.lineTo(markLen, displayH - 8);
      ctx.moveTo(8, displayH);
      ctx.lineTo(8, displayH - markLen);

      // Bottom-Right
      ctx.moveTo(displayW, displayH - 8);
      ctx.lineTo(displayW - markLen, displayH - 8);
      ctx.moveTo(displayW - 8, displayH);
      ctx.lineTo(displayW - 8, displayH - markLen);

      ctx.stroke();
      ctx.restore();
    }

    // Overlay: Center Crosshair
    if (showCrosshairs) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 122, 204, 0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);

      ctx.beginPath();
      ctx.moveTo(displayW / 2, 0);
      ctx.lineTo(displayW / 2, displayH);
      ctx.moveTo(0, displayH / 2);
      ctx.lineTo(displayW, displayH / 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(displayW / 2, displayH / 2, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }, [item, showBleedGuides, showCropMarks, showCrosshairs]);

  useEffect(() => {
    renderCanvas();
    const handleResize = () => renderCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderCanvas]);

  // Corner & Edge Resize start handler
  const handleResizeStart = (
    e: React.PointerEvent<HTMLDivElement>,
    handle: 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w'
  ) => {
    if (!item || !canvasDisplaySize.width) return;
    e.stopPropagation();
    e.preventDefault();

    const { f, cx, cy } = item.transform;
    const imgW = f * canvasDisplaySize.width;
    const imgH = imgW * (item.height / item.width);
    const left = cx * canvasDisplaySize.width - imgW / 2;
    const top = cy * canvasDisplaySize.height - imgH / 2;

    setResizingState({
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startImgW: imgW,
      startImgH: imgH,
      startLeft: left,
      startTop: top,
      aspectRatio: item.width / item.height,
    });
  };

  // Window pointer listener for continuous drag resize
  useEffect(() => {
    if (!resizingState || !item || !canvasDisplaySize.width) return;

    const handleWindowPointerMove = (e: PointerEvent) => {
      const dx = e.clientX - resizingState.startX;
      const dy = e.clientY - resizingState.startY;
      const { handle, startImgW, startImgH, startLeft, startTop, aspectRatio } = resizingState;

      let newLeft = startLeft;
      let newTop = startTop;
      let newW = startImgW;
      let newH = startImgH;

      if (handle === 'se') {
        newW = Math.max(30, startImgW + dx);
        newH = newW / aspectRatio;
        newLeft = startLeft;
        newTop = startTop;
      } else if (handle === 'nw') {
        const anchorRight = startLeft + startImgW;
        const anchorBottom = startTop + startImgH;
        newW = Math.max(30, startImgW - dx);
        newH = newW / aspectRatio;
        newLeft = anchorRight - newW;
        newTop = anchorBottom - newH;
      } else if (handle === 'ne') {
        const anchorBottom = startTop + startImgH;
        newW = Math.max(30, startImgW + dx);
        newH = newW / aspectRatio;
        newLeft = startLeft;
        newTop = anchorBottom - newH;
      } else if (handle === 'sw') {
        const anchorRight = startLeft + startImgW;
        newW = Math.max(30, startImgW - dx);
        newH = newW / aspectRatio;
        newLeft = anchorRight - newW;
        newTop = startTop;
      } else if (handle === 'e') {
        newW = Math.max(30, startImgW + dx);
        newH = newW / aspectRatio;
        newLeft = startLeft;
        newTop = startTop + (startImgH - newH) / 2;
      } else if (handle === 'w') {
        const anchorRight = startLeft + startImgW;
        newW = Math.max(30, startImgW - dx);
        newH = newW / aspectRatio;
        newLeft = anchorRight - newW;
        newTop = startTop + (startImgH - newH) / 2;
      } else if (handle === 's') {
        newH = Math.max(30, startImgH + dy);
        newW = newH * aspectRatio;
        newLeft = startLeft + (startImgW - newW) / 2;
        newTop = startTop;
      } else if (handle === 'n') {
        const anchorBottom = startTop + startImgH;
        newH = Math.max(30, startImgH - dy);
        newW = newH * aspectRatio;
        newLeft = startLeft + (startImgW - newW) / 2;
        newTop = anchorBottom - newH;
      }

      const newF = Math.max(0.15, Math.min(8.0, newW / canvasDisplaySize.width));
      const actualW = newF * canvasDisplaySize.width;
      const actualH = actualW / aspectRatio;

      const finalCx = (newLeft + actualW / 2) / canvasDisplaySize.width;
      const finalCy = (newTop + actualH / 2) / canvasDisplaySize.height;

      onUpdateItem({
        ...item,
        zoom: newF,
        transform: {
          f: newF,
          cx: finalCx,
          cy: finalCy,
        },
        version: item.version + 1,
      });
    };

    const handleWindowPointerUp = () => {
      setResizingState(null);
      onRecordHistory();
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, [resizingState, item, canvasDisplaySize, onUpdateItem, onRecordHistory]);

  // Pointer interactions (Pan / Drag + Two-Finger Pinch Zoom)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!item) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    pointerTrackerRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setIsDragging(true);

    if (pointerTrackerRef.current.size === 2) {
      const pts = Array.from(pointerTrackerRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      pinchRef.current = {
        initialDist: Math.max(10, dist),
        initialZoom: item.transform.f,
        initialCx: item.transform.cx,
        initialCy: item.transform.cy,
        initialMidX: midX,
        initialMidY: midY,
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!item) return;
    const canvas = canvasRef.current;
    const prev = pointerTrackerRef.current.get(e.pointerId);
    if (!canvas || !prev) return;

    const rect = canvas.getBoundingClientRect();
    const deltaX = (e.clientX - prev.x) / rect.width;
    const deltaY = (e.clientY - prev.y) / rect.height;

    pointerTrackerRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two-finger pinch to zoom & pan
    if (pointerTrackerRef.current.size === 2 && pinchRef.current) {
      const pts = Array.from(pointerTrackerRef.current.values());
      const currentDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const zoomRatio = currentDist / pinchRef.current.initialDist;
      const clampedF = Math.max(0.15, Math.min(8.0, pinchRef.current.initialZoom * zoomRatio));

      const currentMidX = (pts[0].x + pts[1].x) / 2;
      const currentMidY = (pts[0].y + pts[1].y) / 2;
      const shiftX = (currentMidX - pinchRef.current.initialMidX) / rect.width;
      const shiftY = (currentMidY - pinchRef.current.initialMidY) / rect.height;

      onUpdateItem({
        ...item,
        zoom: clampedF,
        transform: {
          ...item.transform,
          f: clampedF,
          cx: Math.min(1.5, Math.max(-0.5, pinchRef.current.initialCx + shiftX)),
          cy: Math.min(1.5, Math.max(-0.5, pinchRef.current.initialCy + shiftY)),
        },
        version: item.version + 1,
      });
      return;
    }

    // Single touch or mouse drag: pan
    if (pointerTrackerRef.current.size === 1) {
      const updatedCx = Math.min(1.5, Math.max(-0.5, item.transform.cx + deltaX));
      const updatedCy = Math.min(1.5, Math.max(-0.5, item.transform.cy + deltaY));

      onUpdateItem({
        ...item,
        transform: {
          ...item.transform,
          cx: updatedCx,
          cy: updatedCy,
        },
        version: item.version + 1,
      });
    }
  };

  const wheelTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keyboard shortcut listener for Ctrl+Z and Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          if (canRedo) onRedo();
        } else {
          if (canUndo) onUndo();
        }
      } else if (modKey && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        if (canRedo) onRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, onUndo, onRedo]);

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointerTrackerRef.current.delete(e.pointerId);
    if (pointerTrackerRef.current.size < 2) {
      pinchRef.current = null;
    }
    if (pointerTrackerRef.current.size === 0) {
      if (isDragging) {
        setIsDragging(false);
        onRecordHistory();
      }
    }
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!item) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    const mouseU = (e.clientX - rect.left) / rect.width;
    const mouseV = (e.clientY - rect.top) / rect.height;

    const zoomDelta = Math.exp(-e.deltaY * 0.0018);
    const newF = Math.min(12, Math.max(0.15, item.transform.f * zoomDelta));

    // Zoom centered toward mouse cursor
    const ratio = newF / item.transform.f;
    const newCx = mouseU - (mouseU - item.transform.cx) * ratio;
    const newCy = mouseV - (mouseV - item.transform.cy) * ratio;

    onUpdateItem({
      ...item,
      zoom: newF,
      transform: {
        f: newF,
        cx: Math.min(1.5, Math.max(-0.5, newCx)),
        cy: Math.min(1.5, Math.max(-0.5, newCy)),
      },
      version: item.version + 1,
    });

    if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    wheelTimerRef.current = setTimeout(() => {
      onRecordHistory();
    }, 280);
  };

  // Preset fitting handlers
  const handleApplyPreset = (mode: 'width' | 'height' | 'bleed' | 'contain') => {
    if (!item) return;
    const dims = getPaperDimensions(item.paperSize, item.orientation);
    const preset = calculatePresetFit(mode, item.width, item.height, dims.widthInches, dims.heightInches);

    onUpdateItem({
      ...item,
      zoom: preset.f,
      transform: preset,
      version: item.version + 1,
    });
    setTimeout(() => onRecordHistory(), 50);
  };

  // Center alignment
  const handleCenter = () => {
    if (!item) return;
    onUpdateItem({
      ...item,
      transform: {
        ...item.transform,
        cx: 0.5,
        cy: 0.5,
      },
      version: item.version + 1,
    });
    setTimeout(() => onRecordHistory(), 50);
  };

  // Paper size change
  const handlePaperSizeChange = (newSize: string) => {
    if (!item) return;
    const dims = getPaperDimensions(newSize, item.orientation);
    const preset = calculatePresetFit('bleed', item.width, item.height, dims.widthInches, dims.heightInches);

    onUpdateItem({
      ...item,
      paperSize: newSize,
      transform: preset,
      version: item.version + 1,
    });
    setTimeout(() => onRecordHistory(), 50);
  };

  // Orientation toggle
  const handleOrientationToggle = (newOrient: Orientation) => {
    if (!item || item.orientation === newOrient) return;
    const dims = getPaperDimensions(item.paperSize, newOrient);
    const preset = calculatePresetFit('bleed', item.width, item.height, dims.widthInches, dims.heightInches);

    onUpdateItem({
      ...item,
      orientation: newOrient,
      transform: preset,
      version: item.version + 1,
    });
    setTimeout(() => onRecordHistory(), 50);
  };

  // Zoom change handler (direct scale factor)
  const handleZoomChange = (newF: number) => {
    if (!item) return;
    const clampedF = Math.max(0.15, Math.min(4.0, newF));
    onUpdateItem({
      ...item,
      zoom: clampedF,
      transform: {
        ...item.transform,
        f: clampedF,
      },
      version: item.version + 1,
    });
  };

  const handleStepZoom = (multiplier: number) => {
    if (!item) return;
    onRecordHistory();
    const newF = Math.max(0.15, Math.min(4.0, item.transform.f * multiplier));
    handleZoomChange(newF);
  };

  const paperSizeKey = item ? item.paperSize : 'A3';
  const paperOrientation = item ? item.orientation : 'portrait';
  const currentDims = getPaperDimensions(paperSizeKey, paperOrientation);

  const isLight = theme === 'light';

  return (
    <div
      className={`flex flex-col h-full select-none transition-colors duration-200 ${
        isLight ? 'bg-[#F8FAFC] text-[#0F172A]' : 'bg-[#0D0F12] text-[#F8FAFC]'
      }`}
    >
      {/* Studio Toolbar - Horizontally scrollable and touch-friendly on mobile */}
      {!hideToolbar && (
        <div
          className={`flex items-center justify-between px-3 sm:px-4 py-2 border-b gap-2 text-xs transition-colors overflow-x-auto no-scrollbar shrink-0 ${
            isLight ? 'bg-[#FFFFFF] border-[#E2E8F0]' : 'bg-[#16191E] border-[#262B33]'
          }`}
        >
          {/* Left Side: Undo/Redo & Paper Size & Orientation Controls */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Undo / Redo Action Buttons */}
            <div
              className={`flex items-center space-x-1 border-r pr-2 ${
                isLight ? 'border-[#E2E8F0]' : 'border-[#262B33]'
              }`}
            >
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z / ⌘Z)"
                className={`p-1.5 rounded-xl border transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                  isLight
                    ? 'bg-[#F8FAFC] hover:bg-slate-100 border-[#E2E8F0] text-slate-700'
                    : 'bg-[#21262D] hover:bg-[#2A313C] border-[#30363D] text-[#94A3B8] hover:text-white'
                }`}
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                title="Redo (Ctrl+Y / ⌘Y / ⌘⇧Z)"
                className={`p-1.5 rounded-xl border transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                  isLight
                    ? 'bg-[#F8FAFC] hover:bg-slate-100 border-[#E2E8F0] text-slate-700'
                    : 'bg-[#21262D] hover:bg-[#2A313C] border-[#30363D] text-[#94A3B8] hover:text-white'
                }`}
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Paper Size Selector & Quick Adjust */}
            <div className="flex items-center space-x-1.5">
              <span
                className={`font-medium hidden sm:inline ${isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'}`}
              >
                Paper:
              </span>
              <select
                value={item?.paperSize || 'A3'}
                onChange={(e) => handlePaperSizeChange(e.target.value)}
                className={`font-medium text-xs rounded-xl px-2.5 py-1.5 border transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2563EB] ${
                  isLight
                    ? 'bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A]'
                    : 'bg-[#21262D] border-[#30363D] text-[#F8FAFC]'
                }`}
              >
                <optgroup label="ISO Standard">
                  <option value="A5">A5 (148 × 210 mm)</option>
                  <option value="A4">A4 (210 × 297 mm)</option>
                  <option value="A3">A3 (297 × 420 mm)</option>
                  <option value="A2">A2 (420 × 594 mm)</option>
                  <option value="A1">A1 (594 × 841 mm)</option>
                  <option value="A0">A0 (841 × 1189 mm)</option>
                </optgroup>
                <optgroup label="Popular Poster Formats">
                  <option value="8x10">8×10 Photo (203 × 254 mm)</option>
                  <option value="Letter">US Letter (8.5 × 11 in)</option>
                  <option value="Tabloid">US Tabloid (11 × 17 in)</option>
                  <option value="12x18">12×18 Print (305 × 457 mm)</option>
                  <option value="16x20">16×20 Fine Art (406 × 508 mm)</option>
                  <option value="18x24">18×24 Poster (457 × 610 mm)</option>
                  <option value="ArchD">24×36 Poster (610 × 914 mm)</option>
                  <option value="Square12">12×12 Square (305 × 305 mm)</option>
                </optgroup>
                {item?.paperSize === 'Custom' && (
                  <option value="Custom">Custom Dimensions</option>
                )}
              </select>

              <button
                type="button"
                onClick={() => setShowTransformHandles(!showTransformHandles)}
                disabled={!item}
                title="Toggle interactive on-canvas corner resize handles"
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer disabled:opacity-40 shadow-xs whitespace-nowrap ${
                  showTransformHandles
                    ? 'bg-amber-500/15 border-amber-400 text-amber-700 dark:text-amber-300 font-semibold shadow-xs'
                    : isLight
                    ? 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-700 hover:bg-slate-100'
                    : 'bg-[#21262D] border-[#30363D] text-[#94A3B8] hover:text-white'
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5 text-amber-500" />
                <span>Corner Handles</span>
              </button>
            </div>

            {/* Orientation Pill Toggle */}
            <div
              className={`flex items-center rounded-xl p-0.5 border ${
                isLight ? 'bg-[#F8FAFC] border-[#E2E8F0]' : 'bg-[#111317] border-[#30363D]'
              }`}
            >
              <button
                onClick={() => handleOrientationToggle('portrait')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  (item?.orientation || 'portrait') === 'portrait'
                    ? 'bg-[#2563EB] text-white font-semibold shadow-xs'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Portrait
              </button>
              <button
                onClick={() => handleOrientationToggle('landscape')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  item?.orientation === 'landscape'
                    ? 'bg-[#2563EB] text-white font-semibold shadow-xs'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Landscape
              </button>
            </div>
          </div>

          {/* Center: Framing Presets & Programmatic Upscaler Button */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              onClick={() => handleApplyPreset('bleed')}
              disabled={!item}
              title="Fill full bleed (+3mm bleed allowance on all sides)"
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer disabled:opacity-40 shadow-xs whitespace-nowrap ${
                isLight
                  ? 'bg-blue-50/70 border-blue-200 text-[#2563EB] hover:bg-blue-100/70'
                  : 'bg-[#21262D] border-[#30363D] text-[#38bdf8] hover:bg-[#2A313C]'
              }`}
            >
              <Crop className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#38bdf8]" />
              <span>Fill Bleed</span>
            </button>

            <button
              onClick={() => handleApplyPreset('width')}
              disabled={!item}
              title="Fit exact width of sheet"
              className={`px-2 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer disabled:opacity-40 shadow-xs whitespace-nowrap ${
                isLight
                  ? 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-700 hover:bg-slate-100'
                  : 'bg-[#21262D] border-[#30363D] text-[#94A3B8] hover:text-white'
              }`}
            >
              Fit W
            </button>

            <button
              onClick={() => handleApplyPreset('height')}
              disabled={!item}
              title="Fit exact height of sheet"
              className={`px-2 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer disabled:opacity-40 shadow-xs whitespace-nowrap ${
                isLight
                  ? 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-700 hover:bg-slate-100'
                  : 'bg-[#21262D] border-[#30363D] text-[#94A3B8] hover:text-white'
              }`}
            >
              Fit H
            </button>

            <button
              onClick={handleCenter}
              disabled={!item}
              title="Re-center image to (0.50, 0.50)"
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer disabled:opacity-40 shadow-xs whitespace-nowrap ${
                isLight
                  ? 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-700 hover:bg-slate-100'
                  : 'bg-[#21262D] border-[#30363D] text-[#94A3B8] hover:text-white'
              }`}
            >
              Center
            </button>

            {/* Edge-Aware Upscaler Button */}
            <button
              onClick={onOpenUpscaler}
              disabled={!item}
              title="Edge-Aware Upscaler"
              className="flex items-center space-x-1.5 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-indigo-500/10 hover:from-amber-500/20 hover:to-rose-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs disabled:opacity-40 whitespace-nowrap"
            >
              <Wand2 className="w-3.5 h-3.5 text-amber-500" />
              <span>Upscale</span>
            </button>
          </div>

          {/* View Guides Toggles & Save Button */}
          <div className="flex items-center space-x-1.5 shrink-0">
            {/* Bleed guide toggle */}
            <button
              onClick={() => setShowBleedGuides(!showBleedGuides)}
              className={`p-1.5 rounded-xl border transition cursor-pointer shadow-xs ${
                showBleedGuides
                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-600 dark:text-cyan-400 font-semibold'
                  : isLight
                  ? 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-500 hover:text-slate-800'
                  : 'bg-[#21262D] border-[#30363D] text-[#94A3B8] hover:text-white'
              }`}
              title="Toggle 3mm Bleed & Trim Guides"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>

            {/* Crosshairs toggle */}
            <button
              onClick={() => setShowCrosshairs(!showCrosshairs)}
              className={`p-1.5 rounded-xl border transition cursor-pointer shadow-xs ${
                showCrosshairs
                  ? 'bg-blue-500/10 border-blue-500/40 text-[#2563EB] dark:text-[#38bdf8] font-semibold'
                  : isLight
                  ? 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-500 hover:text-slate-800'
                  : 'bg-[#21262D] border-[#30363D] text-[#94A3B8] hover:text-white'
              }`}
              title="Toggle Center Crosshairs"
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>

            {/* Save to Ready Queue Button */}
            <button
              onClick={onSaveToReady}
              disabled={!item}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer whitespace-nowrap ${
                item?.isSavedToReady
                  ? 'bg-[#10B981] hover:bg-[#059669] text-white'
                  : 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              <span>{item?.isSavedToReady ? 'Ready' : 'Save'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Studio Canvas Workspace */}
      <div
        ref={containerRef}
        className={`flex-1 relative overflow-hidden flex items-center justify-center p-2 sm:p-6 transition-colors ${
          isLight ? 'bg-[#F1F5F9]' : 'bg-[#111317]'
        }`}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Hidden file input for empty state upload */}
        <input
          type="file"
          ref={emptyFileInputRef}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0 && onAddFiles) {
              onAddFiles(e.target.files);
              e.target.value = '';
            }
          }}
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
        />

        {/* Empty State Card if no item is loaded */}
        {!item ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOverEmpty(true);
            }}
            onDragLeave={() => setIsDragOverEmpty(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOverEmpty(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onAddFiles) {
                onAddFiles(e.dataTransfer.files);
              }
            }}
            className={`max-w-md w-full mx-4 p-6 sm:p-8 rounded-2xl border-2 border-dashed text-center transition shadow-xl ${
              isDragOverEmpty
                ? 'border-[#2563EB] bg-blue-50/50 scale-[1.01]'
                : isLight
                ? 'bg-white border-slate-300 hover:border-[#2563EB]'
                : 'bg-[#16191E] border-[#30363D] hover:border-[#2563EB]'
            }`}
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#2563EB] via-[#3B82F6] to-[#EF4444] text-white flex items-center justify-center mx-auto mb-4 shadow-md">
              <UploadCloud className="w-8 h-8" />
            </div>

            <h3
              className={`text-lg sm:text-xl font-bold tracking-tight mb-1.5 ${
                isLight ? 'text-[#0F172A]' : 'text-[#F8FAFC]'
              }`}
            >
              Upload Poster or Artwork
            </h3>
            <p
              className={`text-xs sm:text-sm mb-5 ${
                isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'
              }`}
            >
              Drop high-resolution PNG, JPG or WEBP image here, or choose from your phone or computer.
            </p>

            <button
              type="button"
              onClick={() => emptyFileInputRef.current?.click()}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-95 text-white font-semibold text-sm px-6 py-3 rounded-xl transition shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Choose Image from Device</span>
            </button>

            {/* Quick Sample Links */}
            {onLoadSample && (
              <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs font-semibold mb-2 text-slate-500">
                  Or load instant sample artwork:
                </p>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onLoadSample('bauhaus')}
                    className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-[#2563EB] text-[#2563EB] dark:text-[#38bdf8] font-medium cursor-pointer"
                  >
                    Bauhaus 1923
                  </button>
                  <button
                    type="button"
                    onClick={() => onLoadSample('cyberpunk')}
                    className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-[#2563EB] text-[#2563EB] dark:text-[#38bdf8] font-medium cursor-pointer"
                  >
                    Neo Tokyo
                  </button>
                  <button
                    type="button"
                    onClick={() => onLoadSample('minimalist')}
                    className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-[#2563EB] text-[#2563EB] dark:text-[#38bdf8] font-medium cursor-pointer"
                  >
                    Kopenhagen
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Poster Paper Canvas Container */
          <div
            className={`relative rounded-xl transition-shadow cursor-grab active:cursor-grabbing ${
              isLight
                ? 'shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-[#E2E8F0]'
                : 'shadow-[0_20px_50px_rgba(0,0,0,0.7)] border border-[#262B33]'
            }`}
          >
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
              className="block touch-none rounded-sm"
            />

            {/* Interactive Transform Bounding Box with Corner Resize Handles matching user diagram image_d2205527.png */}
            {item && showTransformHandles && canvasDisplaySize.width > 0 && (() => {
              const { f, cx, cy } = item.transform;
              const imgW = f * canvasDisplaySize.width;
              const imgH = imgW * (item.height / item.width);
              const left = cx * canvasDisplaySize.width - imgW / 2;
              const top = cy * canvasDisplaySize.height - imgH / 2;

              return (
                <div
                  className="absolute inset-0 pointer-events-none overflow-visible"
                  style={{ width: `${canvasDisplaySize.width}px`, height: `${canvasDisplaySize.height}px` }}
                >
                  {/* Outer expansion guide line when dragging */}
                  {resizingState && (
                    <div
                      className="absolute inset-0 border border-dashed border-amber-400/50 pointer-events-none rounded-sm"
                    />
                  )}

                  {/* Artwork Bounding Box */}
                  <div
                    className={`absolute pointer-events-none transition-shadow ${
                      resizingState
                        ? 'border-2 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.4)]'
                        : 'border-2 border-dashed border-amber-400/85 hover:border-amber-500'
                    }`}
                    style={{
                      left: `${left}px`,
                      top: `${top}px`,
                      width: `${imgW}px`,
                      height: `${imgH}px`,
                    }}
                  >
                    {/* Corner Grab Handles - Prominent warm amber squares with dark borders as in image_d2205527.png */}
                    {/* Top-Left (NW) */}
                    <div
                      onPointerDown={(e) => handleResizeStart(e, 'nw')}
                      className="absolute -top-2.5 -left-2.5 w-5 h-5 bg-[#F59E0B] hover:bg-[#FBBF24] active:bg-[#D97706] border-2 border-[#0F172A] rounded-sm shadow-md cursor-nwse-resize z-30 pointer-events-auto transition-transform hover:scale-125 touch-none"
                      title="Drag corner to scale artwork (Top-Left)"
                    />

                    {/* Top-Right (NE) with outward expand arrow matching image_d2205527.png */}
                    <div
                      onPointerDown={(e) => handleResizeStart(e, 'ne')}
                      className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-[#F59E0B] hover:bg-[#FBBF24] active:bg-[#D97706] border-2 border-[#0F172A] rounded-sm shadow-md cursor-nesw-resize z-30 pointer-events-auto transition-transform hover:scale-125 touch-none group"
                      title="Drag corner to scale artwork (Top-Right)"
                    >
                      {/* Visual outward arrow matching the reference picture */}
                      <div className="hidden sm:block absolute -top-5 -right-5 pointer-events-none opacity-85 group-hover:opacity-100 transition-opacity">
                        <svg
                          className="w-5 h-5 text-amber-500 drop-shadow-md"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="7" y1="17" x2="17" y2="7" />
                          <polyline points="7 7 17 7 17 17" />
                        </svg>
                      </div>
                    </div>

                    {/* Bottom-Right (SE) */}
                    <div
                      onPointerDown={(e) => handleResizeStart(e, 'se')}
                      className="absolute -bottom-2.5 -right-2.5 w-5 h-5 bg-[#F59E0B] hover:bg-[#FBBF24] active:bg-[#D97706] border-2 border-[#0F172A] rounded-sm shadow-md cursor-nwse-resize z-30 pointer-events-auto transition-transform hover:scale-125 touch-none"
                      title="Drag corner to scale artwork (Bottom-Right)"
                    />

                    {/* Bottom-Left (SW) */}
                    <div
                      onPointerDown={(e) => handleResizeStart(e, 'sw')}
                      className="absolute -bottom-2.5 -left-2.5 w-5 h-5 bg-[#F59E0B] hover:bg-[#FBBF24] active:bg-[#D97706] border-2 border-[#0F172A] rounded-sm shadow-md cursor-nesw-resize z-30 pointer-events-auto transition-transform hover:scale-125 touch-none"
                      title="Drag corner to scale artwork (Bottom-Left)"
                    />

                    {/* Edge Midpoint Handles */}
                    <div
                      onPointerDown={(e) => handleResizeStart(e, 'n')}
                      className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-3 bg-[#F59E0B] hover:bg-[#FBBF24] border-2 border-[#0F172A] rounded-xs shadow-xs cursor-ns-resize z-20 pointer-events-auto touch-none"
                      title="Drag to adjust height (Top)"
                    />
                    <div
                      onPointerDown={(e) => handleResizeStart(e, 's')}
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-3 bg-[#F59E0B] hover:bg-[#FBBF24] border-2 border-[#0F172A] rounded-xs shadow-xs cursor-ns-resize z-20 pointer-events-auto touch-none"
                      title="Drag to adjust height (Bottom)"
                    />
                    <div
                      onPointerDown={(e) => handleResizeStart(e, 'w')}
                      className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-4 bg-[#F59E0B] hover:bg-[#FBBF24] border-2 border-[#0F172A] rounded-xs shadow-xs cursor-ew-resize z-20 pointer-events-auto touch-none"
                      title="Drag to adjust width (Left)"
                    />
                    <div
                      onPointerDown={(e) => handleResizeStart(e, 'e')}
                      className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-4 bg-[#F59E0B] hover:bg-[#FBBF24] border-2 border-[#0F172A] rounded-xs shadow-xs cursor-ew-resize z-20 pointer-events-auto touch-none"
                      title="Drag to adjust width (Right)"
                    />

                    {/* Live scale dimensions tooltip when resizing */}
                    {resizingState && (
                      <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white text-xs font-mono px-3 py-1 rounded-full shadow-xl whitespace-nowrap pointer-events-none flex items-center space-x-2 border border-amber-400">
                        <span className="text-amber-400 font-bold">{Math.round(item.transform.f * 100)}%</span>
                        <span className="text-slate-500">•</span>
                        <span>{Math.round(item.width * item.transform.f)} × {Math.round(item.height * item.transform.f)} px</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Unprinted edge warning banner: glides and fades in gently, shows for 2 seconds, then smoothly fades away */}
            {verdict && !verdict.isFullCoverage && (
              <div
                onClick={() => handleApplyPreset('bleed')}
                className={`absolute bottom-2.5 left-3 right-3 bg-[#EF4444]/95 text-white text-[11px] font-medium py-1.5 px-3 rounded-xl shadow-lg flex items-center justify-between cursor-pointer transition duration-700 ease-in-out z-20 ${
                  showMarginWarning
                    ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
                    : 'opacity-0 translate-y-3 scale-95 pointer-events-none'
                }`}
                title="Click to Fill Bleed"
              >
                <span>⚠️ White margins on sheet.</span>
                <span className="font-bold underline text-[10px] bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-lg transition-colors">
                  Fill Bleed
                </span>
              </div>
            )}
          </div>
        )}

        {/* Desktop Vertical Zoom Dock on the Right Edge */}
        {item && (
          <aside
            aria-label="Zoom controls"
            className={`hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-2xl flex-col items-center space-y-2.5 shadow-xl transition border ${
              isLight
                ? 'bg-white/95 border-[#E2E8F0] text-[#0F172A]'
                : 'bg-[#16191E]/95 border-[#262B33] text-[#F8FAFC]'
            }`}
          >
            {/* Zoom In button */}
            <button
              type="button"
              onClick={() => handleStepZoom(1.1)}
              title="Zoom In (+10%)"
              className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                isLight
                  ? 'hover:bg-slate-100 text-slate-700'
                  : 'hover:bg-[#21262D] text-[#94A3B8] hover:text-white'
              }`}
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            {/* Vertical Range Slider */}
            <div className="h-28 flex items-center justify-center my-0.5">
              <input
                type="range"
                min="0.2"
                max="3.5"
                step="0.02"
                value={item.transform.f}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                onMouseUp={() => onRecordHistory()}
                onTouchEnd={() => onRecordHistory()}
                style={{
                  writingMode: 'vertical-lr',
                  direction: 'rtl',
                  height: '110px',
                  width: '6px',
                }}
                className="accent-[#2563EB] cursor-pointer"
                title="Scale factor"
              />
            </div>

            {/* Zoom Out button */}
            <button
              type="button"
              onClick={() => handleStepZoom(0.9)}
              title="Zoom Out (-10%)"
              className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                isLight
                  ? 'hover:bg-slate-100 text-slate-700'
                  : 'hover:bg-[#21262D] text-[#94A3B8] hover:text-white'
              }`}
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <div
              className={`w-4 h-[1px] ${isLight ? 'bg-[#E2E8F0]' : 'bg-[#262B33]'}`}
            />

            {/* Current Zoom Percentage */}
            <span className="text-[11px] font-semibold select-none text-center">
              {Math.round(item.transform.f * 100)}%
            </span>

            {/* Reset to Full Bleed */}
            <button
              type="button"
              onClick={() => handleApplyPreset('bleed')}
              title="Reset Zoom to Full Bleed"
              className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                isLight
                  ? 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
                  : 'hover:bg-[#21262D] text-[#94A3B8] hover:text-white'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </aside>
        )}

        {/* Mobile Floating Zoom Pill (Bottom Right, does NOT block poster) */}
        {item && (
          <div
            className={`sm:hidden absolute bottom-3 right-3 z-20 px-2.5 py-1.5 rounded-full flex items-center space-x-2 shadow-lg border ${
              isLight
                ? 'bg-white/95 border-[#E2E8F0] text-[#0F172A]'
                : 'bg-[#16191E]/95 border-[#262B33] text-[#F8FAFC]'
            }`}
          >
            <button
              type="button"
              onClick={() => handleStepZoom(0.9)}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-bold min-w-[32px] text-center">
              {Math.round(item.transform.f * 100)}%
            </span>
            <button
              type="button"
              onClick={() => handleStepZoom(1.1)}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('bleed')}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              title="Reset"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Clean Consumer Status Bar */}
      <footer
        className={`h-7 sm:h-8 border-t flex items-center justify-between px-3 sm:px-4 text-[11px] sm:text-xs font-medium select-none z-10 shrink-0 transition-colors ${
          isLight
            ? 'bg-[#FFFFFF] border-[#E2E8F0] text-[#64748B]'
            : 'bg-[#16191E] border-[#262B33] text-[#94A3B8]'
        }`}
      >
        {/* Coverage indicator */}
        <div className="flex items-center space-x-1.5 truncate">
          {verdict && !verdict.isFullCoverage ? (
            <span className="flex items-center space-x-1 text-[#EF4444] font-semibold truncate">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Margin Warning: White gaps</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1 text-[#10B981] font-semibold truncate">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Full Bleed Ready</span>
            </span>
          )}
        </div>

        {/* Right Status: Paper Format & DPI Readout */}
        <div className="flex items-center space-x-2 sm:space-x-4 shrink-0">
          {item && (
            <div className="flex items-center space-x-1">
              <span className={isLight ? 'text-[#0F172A] font-semibold' : 'text-[#F8FAFC] font-semibold'}>
                {item.paperSize}
              </span>
              <span className="text-[10px] opacity-75 hidden xs:inline">
                ({currentDims.widthMm}×{currentDims.heightMm}mm)
              </span>
            </div>
          )}

          {verdict && (
            <div
              className={`flex items-center space-x-1 px-2 py-0.2 rounded-full text-[10px] sm:text-xs font-semibold ${
                verdict.tier === 'ok'
                  ? 'bg-emerald-500/10 text-[#10B981]'
                  : verdict.tier === 'warn'
                  ? 'bg-amber-500/10 text-amber-600'
                  : 'bg-rose-500/10 text-rose-600'
              }`}
            >
              <span>{verdict.roundedDpi} DPI</span>
            </div>
          )}
        </div>
      </footer>

    </div>
  );
};

