/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { X, Search, ZoomIn, ZoomOut, Move, Info, ShieldCheck } from 'lucide-react';
import { PosterItem } from '../types';
import { getPaperDimensions, calculatePrintVerdict, PrintVerdict } from '../utils/printLogic';
import { useModalTransition } from '../hooks/useModalTransition';

interface InspectionModalProps {
  item: PosterItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const InspectionModal: React.FC<InspectionModalProps> = ({ item, isOpen, onClose }) => {
  const { isRendered, isVisible } = useModalTransition(isOpen, 280);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scaleMode, setScaleMode] = useState<number>(1.0); // 1.0 = 100% 1:1 print pixel
  const [statusMsg, setStatusMsg] = useState<string>('Initializing 100% print inspection…');
  const [isPanning, setIsPanning] = useState<boolean>(false);

  const stateRef = useRef<{
    bitmap: ImageBitmap | null;
    targetWidthPx: number;
    targetHeightPx: number;
    drawWidth: number;
    drawHeight: number;
    drawLeft: number;
    drawTop: number;
    panOffsetX: number;
    panOffsetY: number;
  }>({
    bitmap: null,
    targetWidthPx: 0,
    targetHeightPx: 0,
    drawWidth: 0,
    drawHeight: 0,
    drawLeft: 0,
    drawTop: 0,
    panOffsetX: 0,
    panOffsetY: 0,
  });

  const panTrackerRef = useRef<{ x: number; y: number } | null>(null);

  // Redraw inspection viewport
  const renderInspectCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const state = stateRef.current;
    if (!canvas || !state.bitmap || !item) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vw = canvas.width;
    const vh = canvas.height;

    // Background dark workspace
    ctx.fillStyle = '#111317';
    ctx.fillRect(0, 0, vw, vh);

    const { targetWidthPx, targetHeightPx, drawWidth, drawHeight, drawLeft, drawTop, panOffsetX, panOffsetY } = state;

    ctx.save();
    // Translate according to pan and zoom scale
    const effectivePanX = panOffsetX * scaleMode;
    const effectivePanY = panOffsetY * scaleMode;

    // Bounding print sheet rectangle (simulating 300 DPI sheet in 1:1 view)
    const sheetX = -effectivePanX;
    const sheetY = -effectivePanY;
    const sheetW = targetWidthPx * scaleMode;
    const sheetH = targetHeightPx * scaleMode;

    // Clip to sheet
    ctx.beginPath();
    ctx.rect(sheetX, sheetY, sheetW, sheetH);
    ctx.clip();

    // White paper base
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sheetX, sheetY, sheetW, sheetH);

    // Compute image intersection
    const imgX = sheetX + drawLeft * scaleMode;
    const imgY = sheetY + drawTop * scaleMode;
    const imgW = drawWidth * scaleMode;
    const imgH = drawHeight * scaleMode;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(state.bitmap, imgX, imgY, imgW, imgH);
    ctx.restore();

    // Paper boundary dashed border
    ctx.strokeStyle = '#007acc';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(sheetX, sheetY, sheetW, sheetH);
  }, [item, scaleMode]);

  // Load high-resolution bitmap and initialize inspection dimensions
  useEffect(() => {
    if (!isOpen || !item) return;

    let isMounted = true;
    setStatusMsg('Decoding source pixels directly in memory…');

    const initInspection = async () => {
      try {
        const bmp = await createImageBitmap(item.file);
        if (!isMounted) {
          bmp.close();
          return;
        }

        const dims = getPaperDimensions(item.paperSize, item.orientation);
        const targetWidthPx = Math.round(dims.widthInches * 300);
        const targetHeightPx = Math.round(dims.heightInches * 300);

        const { f, cx, cy } = item.transform;
        const drawWidth = f * targetWidthPx;
        const drawHeight = drawWidth * (item.height / item.width);
        const drawLeft = cx * targetWidthPx - drawWidth / 2;
        const drawTop = cy * targetHeightPx - drawHeight / 2;

        const canvas = canvasRef.current;
        const dpr = window.devicePixelRatio || 1;
        const cw = canvas ? canvas.clientWidth * dpr : 900;
        const ch = canvas ? canvas.clientHeight * dpr : 550;

        if (canvas) {
          canvas.width = cw;
          canvas.height = ch;
        }

        stateRef.current = {
          bitmap: bmp,
          targetWidthPx,
          targetHeightPx,
          drawWidth,
          drawHeight,
          drawLeft,
          drawTop,
          panOffsetX: targetWidthPx / 2 - cw / (2 * dpr),
          panOffsetY: targetHeightPx / 2 - ch / (2 * dpr),
        };

        const stretchPercent = Math.round((drawWidth / item.width) * 100);
        const v = calculatePrintVerdict(item.width, item.height, dims.widthInches, dims.heightInches, f, cx, cy);

        setStatusMsg(
          `300 DPI Target: ${targetWidthPx} × ${targetHeightPx} px (${item.paperSize} ${item.orientation}). Image framed at ${v.roundedDpi} DPI (${stretchPercent}% of native resolution).`
        );

        renderInspectCanvas();
      } catch (err) {
        if (isMounted) {
          setStatusMsg('Error decoding high-resolution image bitmap.');
        }
      }
    };

    initInspection();

    return () => {
      isMounted = false;
      if (stateRef.current.bitmap) {
        stateRef.current.bitmap.close();
        stateRef.current.bitmap = null;
      }
    };
  }, [isOpen, item, renderInspectCanvas]);

  useEffect(() => {
    renderInspectCanvas();
  }, [scaleMode, renderInspectCanvas]);

  // Pointer drag panning
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    panTrackerRef.current = { x: e.clientX, y: e.clientY };
    setIsPanning(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!panTrackerRef.current || !stateRef.current.bitmap) return;
    const deltaX = e.clientX - panTrackerRef.current.x;
    const deltaY = e.clientY - panTrackerRef.current.y;
    panTrackerRef.current = { x: e.clientX, y: e.clientY };

    const state = stateRef.current;
    state.panOffsetX -= deltaX / scaleMode;
    state.panOffsetY -= deltaY / scaleMode;

    renderInspectCanvas();
  };

  const handlePointerUp = () => {
    panTrackerRef.current = null;
    setIsPanning(false);
  };

  if (!isRendered) return null;

  return (
    <div
      onClick={onClose}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 select-none transition-opacity duration-300 ease-out ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-[#16191E] border border-[#262B33] rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden font-sans text-white transition duration-300 ease-out transform ${
          isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-3'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#1C2027] border-b border-[#262B33] text-xs">
          <div className="flex items-center space-x-2.5">
            <Search className="w-4 h-4 text-[#2563EB]" />
            <span className="font-bold text-white text-sm">100% Print Pixel Loupe</span>
            <span className="text-[#94A3B8] text-[11px] hidden sm:inline">(1:1 screen pixel to 300 DPI print)</span>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center bg-[#111317] border border-[#30363D] rounded-xl p-0.5 space-x-1">
              <button
                onClick={() => setScaleMode(0.5)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  scaleMode === 0.5 ? 'bg-[#2563EB] text-white' : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                50%
              </button>
              <button
                onClick={() => setScaleMode(1.0)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  scaleMode === 1.0 ? 'bg-[#2563EB] text-white' : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                100% (1:1)
              </button>
              <button
                onClick={() => setScaleMode(2.0)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  scaleMode === 2.0 ? 'bg-[#2563EB] text-white' : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                200%
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-[#262B33] text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-[#12151A] px-5 py-2.5 border-b border-[#262B33] flex items-center justify-between text-xs text-[#38bdf8]">
          <div className="flex items-center space-x-2 truncate">
            <Info className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
            <span className="truncate">{statusMsg}</span>
          </div>
          <span className="text-[#94A3B8] text-[11px] hidden md:inline shrink-0">Click & drag canvas to pan around artwork</span>
        </div>

        {/* Viewport Canvas */}
        <div className="flex-1 relative bg-[#0D0F12] overflow-hidden cursor-grab active:cursor-grabbing">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="w-full h-full block"
          />

          {/* Crosshair guide overlay in bottom-right */}
          <div className="absolute bottom-4 right-4 bg-[#16191E]/90 border border-[#262B33] px-3 py-1.5 rounded-xl text-xs font-medium text-[#F8FAFC] shadow-lg pointer-events-none">
            <span>Scale: {Math.round(scaleMode * 100)}%</span>
            <span className="mx-2 opacity-50">•</span>
            <span className="text-[#10B981] font-semibold">Target: 300 DPI</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#1C2027] border-t border-[#262B33] flex items-center justify-between text-xs text-[#94A3B8]">
          <span className="flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-[#10B981]" />
            <span>Memory disposed cleanly on close</span>
          </span>
          <button
            onClick={onClose}
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-5 py-1.5 rounded-xl transition shadow-sm cursor-pointer font-semibold text-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
