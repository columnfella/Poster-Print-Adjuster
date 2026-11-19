/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  SlidersHorizontal,
  Maximize2,
  Check,
  RotateCcw,
  Sparkles,
  Layers,
  Ruler,
  AlertCircle,
  CheckCircle2,
  Lock,
  Unlock,
} from 'lucide-react';
import { PosterItem } from '../types';
import {
  PAPER_SIZES,
  Orientation,
  getPaperDimensions,
  calculatePresetFit,
  calculatePrintVerdict,
  PrintVerdict,
} from '../utils/printLogic';
import { useModalTransition } from '../hooks/useModalTransition';

interface AdjustPosterSizeModalProps {
  item: PosterItem | null;
  isOpen: boolean;
  onClose: () => void;
  onApplyNewSize: (
    newPaperSize: string,
    newOrientation: Orientation,
    fitMode: 'bleed' | 'fit' | 'keep',
    customDims?: { widthMm: number; heightMm: number }
  ) => void;
  theme?: 'light' | 'dark';
}

export const AdjustPosterSizeModal: React.FC<AdjustPosterSizeModalProps> = ({
  item,
  isOpen,
  onClose,
  onApplyNewSize,
  theme = 'light',
}) => {
  const isLight = theme === 'light';
  const { isRendered, isVisible } = useModalTransition(isOpen, 280);

  const [selectedSize, setSelectedSize] = useState<string>('A3');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [fitMode, setFitMode] = useState<'bleed' | 'fit' | 'keep'>('bleed');
  const [unit, setUnit] = useState<'mm' | 'in'>('mm');

  // Custom dimensions state
  const [customWidth, setCustomWidth] = useState<number>(297);
  const [customHeight, setCustomHeight] = useState<number>(420);
  const [aspectLocked, setAspectLocked] = useState<boolean>(true);

  // Sync state whenever item opens or changes
  useEffect(() => {
    if (item && isOpen) {
      setSelectedSize(item.paperSize || 'A3');
      setOrientation(item.orientation || 'portrait');
      if (item.customWidthMm && item.customHeightMm) {
        setCustomWidth(item.customWidthMm);
        setCustomHeight(item.customHeightMm);
      } else {
        const dims = getPaperDimensions(item.paperSize, item.orientation);
        setCustomWidth(dims.widthMm);
        setCustomHeight(dims.heightMm);
      }
    }
  }, [item?.id, item?.paperSize, item?.orientation, isOpen]);

  if (!isRendered || !item) return null;

  const currentDims = getPaperDimensions(
    item.paperSize,
    item.orientation,
    item.customWidthMm && item.customHeightMm
      ? { widthMm: item.customWidthMm, heightMm: item.customHeightMm }
      : undefined
  );

  // Calculate target dimensions
  const targetDims =
    selectedSize === 'Custom'
      ? getPaperDimensions('Custom', orientation, {
          widthMm: customWidth,
          heightMm: customHeight,
        })
      : getPaperDimensions(selectedSize, orientation);

  // Calculate projected DPI for target dimensions
  const testFit =
    fitMode === 'keep'
      ? item.transform
      : calculatePresetFit(
          fitMode === 'bleed' ? 'bleed' : 'height',
          item.width,
          item.height,
          targetDims.widthInches,
          targetDims.heightInches
        );

  const projectedVerdict: PrintVerdict = calculatePrintVerdict(
    item.width,
    item.height,
    targetDims.widthInches,
    targetDims.heightInches,
    testFit.f,
    testFit.cx,
    testFit.cy
  );

  const handleCustomWidthChange = (valMm: number) => {
    setCustomWidth(valMm);
    if (aspectLocked && customWidth > 0) {
      const ratio = customHeight / customWidth;
      setCustomHeight(Math.round(valMm * ratio));
    }
  };

  const handleCustomHeightChange = (valMm: number) => {
    setCustomHeight(valMm);
    if (aspectLocked && customHeight > 0) {
      const ratio = customWidth / customHeight;
      setCustomWidth(Math.round(valMm * ratio));
    }
  };

  const handleApply = () => {
    const custom =
      selectedSize === 'Custom'
        ? { widthMm: customWidth, heightMm: customHeight }
        : undefined;

    onApplyNewSize(selectedSize, orientation, fitMode, custom);
    onClose();
  };

  // Grouped preset categories
  const standardPosters = ['A3', 'A2', 'A1', 'A0', 'ArchD', '18x24'];
  const smallerPrints = ['A4', 'A5', '12x18', 'Tabloid', 'Letter', '8x10'];
  const gallerySquare = ['16x20', 'Square12'];

  return (
    <div
      onClick={onClose}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-5 select-none font-sans transition-opacity duration-300 ease-out ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl rounded-2xl border shadow-2xl flex flex-col overflow-hidden transition duration-300 ease-out transform max-h-[92vh] ${
          isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-3'
        } ${
          isLight
            ? 'bg-[#FFFFFF] border-[#E2E8F0] text-[#0F172A]'
            : 'bg-[#16191E] border-[#262B33] text-white'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b shrink-0 ${
            isLight ? 'bg-[#F8FAFC] border-[#E2E8F0]' : 'bg-[#1C2027] border-[#262B33]'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#2563EB] to-indigo-500 flex items-center justify-center text-white shadow-xs">
              <SlidersHorizontal className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">
                Readjust Poster Size & Dimensions
              </h3>
              <p
                className={`text-[11px] ${
                  isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'
                }`}
              >
                Change paper standard, custom width/height, and refit artwork.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-xl border transition cursor-pointer ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                : 'bg-[#21262D] hover:bg-[#2A313C] border-[#30363D] text-[#94A3B8] hover:text-white'
            }`}
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto text-xs">
          {/* Comparison Bar: Current vs Target */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono ${
              isLight
                ? 'bg-[#F1F5F9] border-[#E2E8F0]'
                : 'bg-[#111317] border-[#262B33]'
            }`}
          >
            <div>
              <span className="text-[10px] text-slate-400 block font-sans">
                CURRENT SIZE
              </span>
              <span className="font-bold text-xs">
                {item.paperSize} ({currentDims.widthMm} × {currentDims.heightMm} mm)
              </span>
            </div>

            <div className="flex items-center space-x-2 sm:text-right">
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">
                  TARGET SIZE ({orientation.toUpperCase()})
                </span>
                <span className="font-bold text-xs text-[#2563EB] dark:text-[#38bdf8]">
                  {selectedSize === 'Custom'
                    ? `Custom (${targetDims.widthMm} × ${targetDims.heightMm} mm)`
                    : `${PAPER_SIZES[selectedSize]?.name || selectedSize} (${targetDims.widthMm} × ${targetDims.heightMm} mm)`}
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                  projectedVerdict.tier === 'ok'
                    ? 'bg-emerald-600 text-white'
                    : projectedVerdict.tier === 'warn'
                    ? 'bg-amber-500 text-white'
                    : 'bg-rose-500 text-white'
                }`}
              >
                {projectedVerdict.roundedDpi} DPI
              </span>
            </div>
          </div>

          {/* Orientation Selector */}
          <div>
            <label
              className={`text-[11px] font-bold uppercase tracking-wider block mb-1.5 ${
                isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'
              }`}
            >
              Sheet Orientation
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOrientation('portrait')}
                className={`p-2.5 rounded-xl border text-center font-medium text-xs cursor-pointer transition ${
                  orientation === 'portrait'
                    ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-xs'
                    : isLight
                    ? 'bg-white border-[#E2E8F0] text-slate-700 hover:bg-slate-50'
                    : 'bg-[#111317] border-[#262B33] text-slate-300 hover:bg-[#16191E]'
                }`}
              >
                Portrait (Vertical)
              </button>
              <button
                type="button"
                onClick={() => setOrientation('landscape')}
                className={`p-2.5 rounded-xl border text-center font-medium text-xs cursor-pointer transition ${
                  orientation === 'landscape'
                    ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-xs'
                    : isLight
                    ? 'bg-white border-[#E2E8F0] text-slate-700 hover:bg-slate-50'
                    : 'bg-[#111317] border-[#262B33] text-slate-300 hover:bg-[#16191E]'
                }`}
              >
                Landscape (Horizontal)
              </button>
            </div>
          </div>

          {/* Preset Formats Grid */}
          <div>
            <label
              className={`text-[11px] font-bold uppercase tracking-wider block mb-1.5 ${
                isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'
              }`}
            >
              Standard Print Formats
            </label>

            <div className="space-y-2">
              {/* Large & Medium Posters */}
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block mb-1">
                  Commercial Posters
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {standardPosters.map((key) => {
                    const spec = PAPER_SIZES[key];
                    if (!spec) return null;
                    const isSelected = selectedSize === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedSize(key)}
                        className={`p-2 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[#2563EB]/15 border-[#2563EB] ring-2 ring-[#2563EB]/30'
                            : isLight
                            ? 'bg-white border-[#E2E8F0] hover:border-slate-300'
                            : 'bg-[#111317] border-[#262B33] hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-xs">
                          <span>{spec.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#2563EB]" />}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {spec.widthMm} × {spec.heightMm} mm
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Smaller Prints & Office */}
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block mb-1">
                  Small Art Prints & Documents
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {smallerPrints.map((key) => {
                    const spec = PAPER_SIZES[key];
                    if (!spec) return null;
                    const isSelected = selectedSize === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedSize(key)}
                        className={`p-2 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[#2563EB]/15 border-[#2563EB] ring-2 ring-[#2563EB]/30'
                            : isLight
                            ? 'bg-white border-[#E2E8F0] hover:border-slate-300'
                            : 'bg-[#111317] border-[#262B33] hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-xs">
                          <span>{spec.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#2563EB]" />}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {spec.widthMm} × {spec.heightMm} mm
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Square & Gallery Formats */}
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block mb-1">
                  Gallery & Square Formats
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {gallerySquare.map((key) => {
                    const spec = PAPER_SIZES[key];
                    if (!spec) return null;
                    const isSelected = selectedSize === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedSize(key)}
                        className={`p-2 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[#2563EB]/15 border-[#2563EB] ring-2 ring-[#2563EB]/30'
                            : isLight
                            ? 'bg-white border-[#E2E8F0] hover:border-slate-300'
                            : 'bg-[#111317] border-[#262B33] hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-xs">
                          <span>{spec.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#2563EB]" />}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {spec.widthMm} × {spec.heightMm} mm
                        </span>
                      </button>
                    );
                  })}

                  {/* Custom Dimensions Option */}
                  <button
                    type="button"
                    onClick={() => setSelectedSize('Custom')}
                    className={`p-2 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                      selectedSize === 'Custom'
                        ? 'bg-[#2563EB]/15 border-[#2563EB] ring-2 ring-[#2563EB]/30'
                        : isLight
                        ? 'bg-white border-[#E2E8F0] hover:border-slate-300'
                        : 'bg-[#111317] border-[#262B33] hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-xs">
                      <span>Custom Size</span>
                      {selectedSize === 'Custom' && (
                        <Check className="w-3.5 h-3.5 text-[#2563EB]" />
                      )}
                    </div>
                    <span className="text-[10px] text-[#2563EB] font-mono mt-0.5">
                      Enter W × H
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Custom Dimension Inputs (Shown when Custom is selected) */}
          {selectedSize === 'Custom' && (
            <div
              className={`p-3.5 rounded-xl border space-y-3 ${
                isLight ? 'bg-blue-50/50 border-blue-200' : 'bg-[#111317] border-[#262B33]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs flex items-center space-x-1.5">
                  <Ruler className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Custom Dimensions</span>
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setAspectLocked(!aspectLocked)}
                    className={`p-1 rounded-lg border text-xs flex items-center space-x-1 cursor-pointer ${
                      aspectLocked
                        ? 'bg-[#2563EB] text-white border-[#2563EB]'
                        : isLight
                        ? 'bg-white border-slate-200 text-slate-600'
                        : 'bg-[#21262D] border-[#30363D] text-slate-300'
                    }`}
                    title="Lock aspect ratio"
                  >
                    {aspectLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    <span className="text-[10px]">{aspectLocked ? 'Ratio Locked' : 'Free'}</span>
                  </button>

                  <div
                    className={`flex items-center rounded-lg p-0.5 border ${
                      isLight ? 'bg-white border-slate-200' : 'bg-[#1C2027] border-[#30363D]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setUnit('mm')}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                        unit === 'mm'
                          ? 'bg-[#2563EB] text-white'
                          : 'text-slate-500'
                      }`}
                    >
                      mm
                    </button>
                    <button
                      type="button"
                      onClick={() => setUnit('in')}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                        unit === 'in'
                          ? 'bg-[#2563EB] text-white'
                          : 'text-slate-500'
                      }`}
                    >
                      in
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">
                    Width ({unit})
                  </label>
                  <input
                    type="number"
                    min="50"
                    max="3000"
                    step={unit === 'mm' ? 1 : 0.1}
                    value={unit === 'mm' ? customWidth : Number((customWidth / 25.4).toFixed(2))}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      handleCustomWidthChange(unit === 'mm' ? val : Math.round(val * 25.4));
                    }}
                    className={`w-full px-3 py-1.5 rounded-xl border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#2563EB] ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900'
                        : 'bg-[#1C2027] border-[#30363D] text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">
                    Height ({unit})
                  </label>
                  <input
                    type="number"
                    min="50"
                    max="3000"
                    step={unit === 'mm' ? 1 : 0.1}
                    value={unit === 'mm' ? customHeight : Number((customHeight / 25.4).toFixed(2))}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      handleCustomHeightChange(unit === 'mm' ? val : Math.round(val * 25.4));
                    }}
                    className={`w-full px-3 py-1.5 rounded-xl border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#2563EB] ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900'
                        : 'bg-[#1C2027] border-[#30363D] text-white'
                    }`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Artwork Fit Strategy */}
          <div>
            <label
              className={`text-[11px] font-bold uppercase tracking-wider block mb-1.5 ${
                isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'
              }`}
            >
              Artwork Refit Strategy
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFitMode('bleed')}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                  fitMode === 'bleed'
                    ? 'bg-[#2563EB]/15 border-[#2563EB] ring-2 ring-[#2563EB]/30'
                    : isLight
                    ? 'bg-white border-[#E2E8F0] hover:bg-slate-50'
                    : 'bg-[#111317] border-[#262B33] hover:bg-[#16191E]'
                }`}
              >
                <div className="font-bold text-xs text-[#2563EB] dark:text-[#38bdf8]">
                  Fill Bleed (Recommended)
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Fills full sheet + 3mm bleed margin for edge-to-edge printing.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFitMode('fit')}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                  fitMode === 'fit'
                    ? 'bg-[#2563EB]/15 border-[#2563EB] ring-2 ring-[#2563EB]/30'
                    : isLight
                    ? 'bg-white border-[#E2E8F0] hover:bg-slate-50'
                    : 'bg-[#111317] border-[#262B33] hover:bg-[#16191E]'
                }`}
              >
                <div className="font-bold text-xs">Fit Entire Artwork</div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Shows 100% of artwork without any cropping (letterboxed).
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFitMode('keep')}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                  fitMode === 'keep'
                    ? 'bg-[#2563EB]/15 border-[#2563EB] ring-2 ring-[#2563EB]/30'
                    : isLight
                    ? 'bg-white border-[#E2E8F0] hover:bg-slate-50'
                    : 'bg-[#111317] border-[#262B33] hover:bg-[#16191E]'
                }`}
              >
                <div className="font-bold text-xs">Keep Relative Position</div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Maintains existing zoom and pan offsets.
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`flex items-center justify-between px-5 py-3.5 border-t shrink-0 ${
            isLight ? 'bg-[#F8FAFC] border-[#E2E8F0]' : 'bg-[#1C2027] border-[#262B33]'
          }`}
        >
          <div className="text-[11px] text-slate-400 hidden sm:block">
            Target Print Area: {targetDims.widthInches}" × {targetDims.heightInches}"
          </div>

          <div className="flex items-center space-x-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className={`px-3.5 py-2 rounded-xl border text-xs font-medium cursor-pointer transition-colors ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                  : 'bg-[#21262D] border-[#30363D] text-slate-300 hover:text-white'
              }`}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApply}
              className="bg-[#2563EB] hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition shadow-md active:scale-98 cursor-pointer flex items-center space-x-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply Size & Refit</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
