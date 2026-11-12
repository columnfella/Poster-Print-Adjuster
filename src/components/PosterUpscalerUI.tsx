/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Wand2,
  X,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Download,
  Loader2,
  Type,
  PenTool,
  Camera,
  Palette,
  Scroll,
  RotateCcw,
  Check,
  ShieldCheck,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PosterItem } from '../types';
import { PrintVerdict } from '../utils/printLogic';
import {
  calculateUpscaleTargetDimensions,
  UpscaleDpiTarget,
  ArtworkPresetId,
  ARTWORK_PRESETS,
  getPresetById,
  blendArtworkPresets,
} from '../utils/upscalerLogic';
import { useUpscaler, UpscaleResult } from '../hooks/useUpscaler';
import { useModalTransition } from '../hooks/useModalTransition';
import { downloadJpegBlob } from '../utils/downloadHelper';

interface PosterUpscalerUIProps {
  item: PosterItem | null;
  verdict: PrintVerdict | null;
  isOpen: boolean;
  onClose: () => void;
  onApplyUpscaledItem: (
    updatedItem: PosterItem,
    upscaledBlob: Blob,
    newCanvas: HTMLCanvasElement,
    newWidth: number,
    newHeight: number
  ) => void;
  theme?: 'light' | 'dark';
}

export const PosterUpscalerUI: React.FC<PosterUpscalerUIProps> = ({
  item,
  verdict,
  isOpen,
  onClose,
  onApplyUpscaledItem,
  theme = 'light',
}) => {
  const isLight = theme === 'light';
  const { isRendered, isVisible } = useModalTransition(isOpen, 280);

  const [scaleMode, setScaleMode] = useState<'target300' | '2x' | '3x' | '4x'>('target300');
  const [selectedPresets, setSelectedPresets] = useState<ArtworkPresetId[]>(['text']);
  const [sharpenAmount, setSharpenAmount] = useState<number>(ARTWORK_PRESETS.text.sharpenAmount);
  const [varianceThreshold, setVarianceThreshold] = useState<number>(ARTWORK_PRESETS.text.varianceThreshold);
  const [clampRinging, setClampRinging] = useState<boolean>(ARTWORK_PRESETS.text.clampRinging);
  const [completedResult, setCompletedResult] = useState<UpscaleResult | null>(null);

  const { isProcessing, progress, stage, error, upscaleImage, cancelUpscale } = useUpscaler();

  // Reset completedResult and cancel pending operations whenever item ID changes or modal opens
  useEffect(() => {
    setCompletedResult(null);
  }, [item?.id, isOpen]);

  if (!isRendered || !item || !verdict) return null;

  const currentDpi = verdict.roundedDpi;
  const targetSpec: UpscaleDpiTarget = calculateUpscaleTargetDimensions(
    item.width,
    item.height,
    item.paperSize,
    item.orientation,
    currentDpi,
    scaleMode,
    300
  );

  const handleSelectPreset = (presetId: ArtworkPresetId) => {
    if (presetId === 'custom') {
      setSelectedPresets(['custom']);
      const c = getPresetById('custom');
      setSharpenAmount(c.sharpenAmount);
      setVarianceThreshold(c.varianceThreshold);
      setClampRinging(c.clampRinging);
      setCompletedResult(null);
      return;
    }

    let nextPresets: ArtworkPresetId[];
    if (selectedPresets.includes('custom')) {
      nextPresets = [presetId];
    } else if (selectedPresets.includes(presetId)) {
      // Toggle off: remove this preset cleanly without forcing it back
      nextPresets = selectedPresets.filter((id) => id !== presetId);
    } else {
      // Add preset up to max 2
      if (selectedPresets.length >= 2) {
        nextPresets = [selectedPresets[0], presetId];
      } else {
        nextPresets = [...selectedPresets, presetId];
      }
    }

    setSelectedPresets(nextPresets);

    if (nextPresets.length === 0) {
      // Neutral baseline if all unselected
      setSharpenAmount(1.0);
      setVarianceThreshold(25);
      setClampRinging(false);
    } else {
      const blended = blendArtworkPresets(nextPresets);
      setSharpenAmount(blended.sharpenAmount);
      setVarianceThreshold(blended.varianceThreshold);
      setClampRinging(blended.clampRinging);
    }
    setCompletedResult(null);
  };

  const handleManualSharpenChange = (val: number) => {
    setSharpenAmount(val);
    setSelectedPresets(['custom']);
    setCompletedResult(null);
  };

  const handleManualVarianceChange = (val: number) => {
    setVarianceThreshold(val);
    setSelectedPresets(['custom']);
    setCompletedResult(null);
  };

  const handleManualClampChange = (val: boolean) => {
    setClampRinging(val);
    setSelectedPresets(['custom']);
    setCompletedResult(null);
  };

  const handleResetToPresets = () => {
    setSelectedPresets(['text']);
    const def = getPresetById('text');
    setSharpenAmount(def.sharpenAmount);
    setVarianceThreshold(def.varianceThreshold);
    setClampRinging(def.clampRinging);
    setCompletedResult(null);
  };

  const handleStartUpscaling = async () => {
    setCompletedResult(null);
    try {
      const res = await upscaleImage(
        item.file,
        targetSpec.targetWidth,
        targetSpec.targetHeight,
        sharpenAmount,
        varianceThreshold,
        clampRinging
      );
      setCompletedResult(res);
    } catch (err) {
      // Handled in useUpscaler hook
    }
  };

  const handleApplyToPoster = () => {
    if (!completedResult || !item) return;

    const updatedItem: PosterItem = {
      ...item,
      file: completedResult.upscaledBlob,
      previewCanvas: completedResult.previewCanvas,
      width: completedResult.width,
      height: completedResult.height,
      version: item.version + 1,
    };

    onApplyUpscaledItem(
      updatedItem,
      completedResult.upscaledBlob,
      completedResult.previewCanvas,
      completedResult.width,
      completedResult.height
    );

    setCompletedResult(null);
    onClose();
  };

  const handleDownloadStandalone = async () => {
    if (!completedResult || !item) return;
    const filename = `${item.name.replace(/\.[^.]+$/, '')}_lanczos3_upscaled_${completedResult.width}x${completedResult.height}.jpg`;
    await downloadJpegBlob(completedResult.upscaledBlob, filename);
  };

  // Primary 5 artwork presets (Custom is separated into a smaller, compact option)
  const primaryPresets: Array<{
    id: ArtworkPresetId;
    icon: React.ReactNode;
  }> = [
    {
      id: 'text',
      icon: <Type className="w-4 h-4 text-sky-500" />,
    },
    {
      id: 'lineart',
      icon: <PenTool className="w-4 h-4 text-emerald-500" />,
    },
    {
      id: 'photo',
      icon: <Camera className="w-4 h-4 text-amber-500" />,
    },
    {
      id: 'digital-art',
      icon: <Palette className="w-4 h-4 text-purple-500" />,
    },
    {
      id: 'vintage',
      icon: <Scroll className="w-4 h-4 text-orange-500" />,
    },
  ];

  const isManualActive = selectedPresets.includes('custom');

  return (
    <div
      onClick={() => {
        if (isProcessing) cancelUpscale();
        setCompletedResult(null);
        onClose();
      }}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-5 select-none font-sans transition-opacity duration-300 ease-out ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-3xl flex flex-col rounded-2xl border shadow-2xl overflow-hidden max-h-[92vh] transition-all duration-300 ease-out transform ${
          isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-3'
        } ${
          isLight
            ? 'bg-[#FFFFFF] border-[#E2E8F0] text-[#0F172A]'
            : 'bg-[#16191E] border-[#262B33] text-white'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 sm:px-6 py-3.5 border-b shrink-0 ${
            isLight ? 'bg-[#F8FAFC] border-[#E2E8F0]' : 'bg-[#1C2027] border-[#262B33]'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#2563EB] to-amber-500 flex items-center justify-center text-white shadow-xs">
              <Wand2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm sm:text-base">
                  Lanczos-3 Archival Upscaler
                </h3>
                <span className="text-[10px] bg-[#2563EB]/15 text-[#2563EB] dark:text-[#38bdf8] border border-[#2563EB]/30 px-2 py-0.5 rounded-full font-semibold">
                  300 DPI Engine
                </span>
              </div>
              <p
                className={`text-[11px] hidden sm:block ${
                  isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'
                }`}
              >
                Targeting: <span className="font-medium underline decoration-blue-500/40">{item.name}</span> ({item.paperSize} • {item.orientation})
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (isProcessing) cancelUpscale();
              setCompletedResult(null);
              onClose();
            }}
            className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                : 'bg-[#21262D] hover:bg-[#2A313C] border-[#30363D] text-[#94A3B8] hover:text-white'
            }`}
            title="Close Upscaler"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto text-xs font-sans">
          {/* Target Resolution & Projected DPI Banner */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono ${
              isLight
                ? 'bg-[#F1F5F9] border-[#E2E8F0]'
                : 'bg-[#111317] border-[#262B33]'
            }`}
          >
            <div>
              <span
                className={`text-[10px] block font-sans ${
                  isLight ? 'text-slate-500' : 'text-[#858585]'
                }`}
              >
                CURRENT POSTER STATE
              </span>
              <span className="font-bold text-sm">
                {item.width} × {item.height} px
              </span>
              <span
                className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold ${
                  verdict.tier === 'ok'
                    ? 'bg-emerald-600 text-white'
                    : verdict.tier === 'warn'
                    ? 'bg-amber-500 text-white'
                    : 'bg-rose-500 text-white'
                }`}
              >
                {currentDpi} DPI
              </span>
            </div>

            <ArrowRight className="w-4 h-4 text-[#2563EB] hidden sm:block shrink-0" />

            <div>
              <span
                className={`text-[10px] block font-sans ${
                  isLight ? 'text-slate-500' : 'text-[#858585]'
                }`}
              >
                PROJECTED RESULT ({scaleMode.toUpperCase()})
              </span>
              <span className="text-[#2563EB] dark:text-[#38bdf8] font-bold text-sm">
                {targetSpec.targetWidth} × {targetSpec.targetHeight} px
              </span>
              <span className="ml-2 bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                {targetSpec.projectedDpi} DPI [PRINT READY]
              </span>
            </div>
          </div>

          {/* Section 1: Artwork Type & Style Presets */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
              <div className="flex items-center space-x-2">
                <label
                  className={`text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1.5 ${
                    isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Artwork Content Presets</span>
                </label>
                <span className="text-[10px] bg-[#2563EB]/15 text-[#2563EB] dark:text-[#38bdf8] border border-[#2563EB]/30 px-2 py-0.5 rounded-full font-semibold">
                  Select up to 2 for Hybrid Blend
                </span>
              </div>
              <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Optimizes filtering kernel & edge contrast
              </span>
            </div>

            {/* 5 Primary Artwork Presets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {primaryPresets.map((p) => {
                const info = ARTWORK_PRESETS[p.id];
                const selectedIndex = selectedPresets.indexOf(p.id);
                const isSelected = selectedIndex !== -1;
                const isHybrid = selectedPresets.length === 2 && !isManualActive;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p.id)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between relative ${
                      isSelected
                        ? isLight
                          ? 'bg-blue-50/80 border-[#2563EB] ring-2 ring-[#2563EB]/30 shadow-xs'
                          : 'bg-[#2563EB]/15 border-[#2563EB] ring-2 ring-[#2563EB]/40 shadow-md'
                        : isLight
                        ? 'bg-white border-[#E2E8F0] hover:border-slate-300'
                        : 'bg-[#111317] border-[#262B33] hover:border-slate-500'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center space-x-2">
                          {p.icon}
                          <span className="font-bold text-xs">
                            {info.name}
                          </span>
                        </div>
                        {isSelected && (
                          isHybrid ? (
                            <span className="text-[10px] font-mono font-bold bg-[#2563EB] text-white px-1.5 py-0.5 rounded-md shadow-xs">
                              Blend #{selectedIndex + 1}
                            </span>
                          ) : (
                            <Check className="w-4 h-4 text-[#2563EB] dark:text-[#38bdf8]" />
                          )
                        )}
                      </div>
                      <p
                        className={`text-[11px] leading-snug ${
                          isLight ? 'text-slate-600' : 'text-[#94A3B8]'
                        }`}
                      >
                        {info.description}
                      </p>
                    </div>

                    <div
                      className={`mt-2.5 pt-1.5 border-t flex items-center justify-between text-[10px] ${
                        isLight ? 'border-slate-200' : 'border-[#262B33]/80'
                      }`}
                    >
                      <span className="text-[#2563EB] dark:text-[#38bdf8] font-mono font-medium">
                        {info.tagline}
                      </span>
                      <span
                        className={`font-mono font-semibold ${
                          isLight ? 'text-slate-500' : 'text-slate-400'
                        }`}
                      >
                        {info.sharpenAmount}×
                      </span>
                    </div>
                  </button>
                );
              })}

              {/* Smaller, compact Manual Tuning card in grid or inline */}
              <div
                onClick={() => handleSelectPreset('custom')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                  isManualActive
                    ? isLight
                      ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/30 shadow-xs'
                      : 'bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/30'
                    : isLight
                    ? 'bg-slate-50/70 border-dashed border-slate-300 hover:border-slate-400'
                    : 'bg-[#111317]/60 border-dashed border-[#30363D] hover:border-slate-500'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-1.5">
                      <Sliders className="w-3.5 h-3.5 text-amber-500" />
                      <span className="font-bold text-xs">
                        Manual Tuning
                      </span>
                    </div>
                    {isManualActive && (
                      <span className="text-[9px] bg-amber-500 text-white font-bold px-1.5 py-0.2 rounded">
                        Active
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-[10px] leading-tight ${
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    Custom sliders for edge sharpness, variance, and anti-halo filter.
                  </p>
                </div>

                <div
                  className={`mt-2 pt-1 border-t flex items-center justify-between text-[10px] ${
                    isLight ? 'border-slate-200' : 'border-[#262B33]'
                  }`}
                >
                  <span className="text-amber-500 font-mono text-[9px] font-medium">
                    Pro Customizer
                  </span>
                  <span className="text-slate-400 font-mono text-[9px]">Sliders</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hybrid Preset Blend Active Banner (Visible when 2 presets chosen) */}
          {selectedPresets.length === 2 && !isManualActive && (
            <div
              className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs shadow-xs ${
                isLight
                  ? 'bg-blue-50/70 border-blue-200'
                  : 'bg-[#1C2333] border-[#2563EB]/60'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#2563EB]/20 flex items-center justify-center text-[#2563EB] dark:text-[#38bdf8] shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs">
                      Hybrid Blend: {ARTWORK_PRESETS[selectedPresets[0]]?.name} + {ARTWORK_PRESETS[selectedPresets[1]]?.name}
                    </span>
                    <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-mono font-semibold">
                      50/50 Dual Blend
                    </span>
                  </div>
                  <p
                    className={`text-[11px] ${
                      isLight ? 'text-slate-600' : 'text-slate-300'
                    }`}
                  >
                    Calculated hybrid parameters: sharp edge preservation + noise-safe contour synthesis.
                  </p>
                </div>
              </div>
              <div
                className={`flex items-center space-x-3 text-[10px] font-mono shrink-0 self-end sm:self-center ${
                  isLight ? 'text-slate-700' : 'text-slate-300'
                }`}
              >
                <span>Sharp: <strong className="text-[#2563EB] dark:text-[#38bdf8]">{sharpenAmount.toFixed(2)}×</strong></span>
                <span>Var: <strong className="text-emerald-600 dark:text-emerald-400">{varianceThreshold}</strong></span>
                <span>Anti-Halo: <strong className={clampRinging ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>{clampRinging ? 'Active' : 'Off'}</strong></span>
              </div>
            </div>
          )}

          {/* Section 2: Scale Strategy Selection */}
          <div>
            <label
              className={`text-[11px] font-bold uppercase tracking-wider block mb-1.5 ${
                isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'
              }`}
            >
              Target Scale Ratio
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
              <button
                type="button"
                onClick={() => {
                  setScaleMode('target300');
                  setCompletedResult(null);
                }}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  scaleMode === 'target300'
                    ? isLight
                      ? 'bg-blue-50/80 border-[#2563EB] text-[#2563EB] font-bold shadow-xs'
                      : 'bg-[#2563EB]/20 border-[#2563EB] text-white shadow-sm'
                    : isLight
                    ? 'bg-white border-[#E2E8F0] text-slate-700 hover:bg-slate-50'
                    : 'bg-[#111317] border-[#262B33] text-[#858585] hover:text-white'
                }`}
              >
                <div className="font-bold text-xs text-[#2563EB] dark:text-[#38bdf8]">Exact 300 DPI</div>
                <div className="text-[10px] opacity-75 mt-0.5">
                  {(targetSpec.scaleFactor).toFixed(1)}× for {item.paperSize}
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setScaleMode('2x');
                  setCompletedResult(null);
                }}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  scaleMode === '2x'
                    ? isLight
                      ? 'bg-blue-50/80 border-[#2563EB] text-[#2563EB] font-bold shadow-xs'
                      : 'bg-[#2563EB]/20 border-[#2563EB] text-white shadow-sm'
                    : isLight
                    ? 'bg-white border-[#E2E8F0] text-slate-700 hover:bg-slate-50'
                    : 'bg-[#111317] border-[#262B33] text-[#858585] hover:text-white'
                }`}
              >
                <div className="font-bold text-xs">2.0× Scale</div>
                <div className="text-[10px] opacity-75 mt-0.5">Lanczos-3 2D</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setScaleMode('3x');
                  setCompletedResult(null);
                }}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  scaleMode === '3x'
                    ? isLight
                      ? 'bg-blue-50/80 border-[#2563EB] text-[#2563EB] font-bold shadow-xs'
                      : 'bg-[#2563EB]/20 border-[#2563EB] text-white shadow-sm'
                    : isLight
                    ? 'bg-white border-[#E2E8F0] text-slate-700 hover:bg-slate-50'
                    : 'bg-[#111317] border-[#262B33] text-[#858585] hover:text-white'
                }`}
              >
                <div className="font-bold text-xs">3.0× Scale</div>
                <div className="text-[10px] opacity-75 mt-0.5">High Density</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setScaleMode('4x');
                  setCompletedResult(null);
                }}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  scaleMode === '4x'
                    ? isLight
                      ? 'bg-blue-50/80 border-[#2563EB] text-[#2563EB] font-bold shadow-xs'
                      : 'bg-[#2563EB]/20 border-[#2563EB] text-white shadow-sm'
                    : isLight
                    ? 'bg-white border-[#E2E8F0] text-slate-700 hover:bg-slate-50'
                    : 'bg-[#111317] border-[#262B33] text-[#858585] hover:text-white'
                }`}
              >
                <div className="font-bold text-xs">4.0× Scale</div>
                <div className="text-[10px] opacity-75 mt-0.5">Ultra Gallery</div>
              </button>
            </div>
          </div>

          {/* Section 3: Fine-Tune Parameters (ONLY AND ONLY SHOWN IN THE MANUAL OPTION) */}
          {isManualActive && (
            <div
              className={`p-4 rounded-xl border space-y-4 transition-all ${
                isLight
                  ? 'bg-amber-50/40 border-amber-200'
                  : 'bg-[#111317] border-[#262B33]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs flex items-center space-x-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-500" />
                  <span>Manual Fine-Tune Parameters</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono font-semibold">
                    Manual Mode Active
                  </span>
                </span>

                <button
                  type="button"
                  onClick={handleResetToPresets}
                  className="text-[11px] text-[#2563EB] hover:underline font-medium flex items-center space-x-1 cursor-pointer"
                  title="Reset to preset defaults"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Switch to Preset</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>
                      Edge Sharpening Intensity
                    </span>
                    <span className="text-[#2563EB] dark:text-[#38bdf8] font-bold">
                      {sharpenAmount.toFixed(1)}×
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="2.5"
                    step="0.1"
                    value={sharpenAmount}
                    disabled={isProcessing}
                    onChange={(e) => handleManualSharpenChange(parseFloat(e.target.value))}
                    className="w-full accent-[#2563EB] cursor-pointer"
                  />
                  <p
                    className={`text-[10px] mt-1 ${
                      isLight ? 'text-slate-500' : 'text-[#94A3B8]'
                    }`}
                  >
                    High-pass delta added specifically to detected contours and text lines.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>
                      Noise Suppression Threshold
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      {varianceThreshold}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    step="5"
                    value={varianceThreshold}
                    disabled={isProcessing}
                    onChange={(e) => handleManualVarianceChange(parseInt(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <p
                    className={`text-[10px] mt-1 ${
                      isLight ? 'text-slate-500' : 'text-[#94A3B8]'
                    }`}
                  >
                    Higher values protect flat skies, skin, and backgrounds from grain blowup.
                  </p>
                </div>
              </div>

              {/* Anti-Ringing / Halo Suppression Toggle */}
              <div
                className={`pt-2 border-t flex items-center justify-between ${
                  isLight ? 'border-slate-200' : 'border-[#262B33]'
                }`}
              >
                <div>
                  <div className="font-semibold text-xs">
                    Anti-Ringing Clamping Filter
                  </div>
                  <p
                    className={`text-[10px] ${
                      isLight ? 'text-slate-500' : 'text-[#94A3B8]'
                    }`}
                  >
                    Suppresses Gibbs-phenomenon haloing around high-contrast black text and line art.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleManualClampChange(!clampRinging)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    clampRinging
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : isLight
                      ? 'bg-white border-slate-300 text-slate-500'
                      : 'bg-[#1C2027] border-[#262B33] text-slate-400'
                  }`}
                >
                  {clampRinging ? '✓ Filter Enabled' : 'Disabled'}
                </button>
              </div>
            </div>
          )}

          {/* Worker Execution Progress Bar */}
          {isProcessing && (
            <div
              className={`p-4 rounded-xl border space-y-2.5 font-mono shadow-md animate-pulse ${
                isLight
                  ? 'bg-blue-50/70 border-blue-300 text-slate-800'
                  : 'bg-[#111317] border-[#2563EB]/50'
              }`}
            >
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center space-x-2 text-[#2563EB] dark:text-[#38bdf8]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="font-bold">{stage}</span>
                </div>
                <span className="font-bold">{progress}%</span>
              </div>

              {/* Progress track */}
              <div
                className={`w-full h-2 rounded-full overflow-hidden ${
                  isLight ? 'bg-slate-200' : 'bg-[#21262D]'
                }`}
              >
                <div
                  className="h-full bg-gradient-to-r from-[#2563EB] to-emerald-400 transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div
                className={`flex justify-between text-[10px] ${
                  isLight ? 'text-slate-500' : 'text-[#858585]'
                }`}
              >
                <span>Zero UI blocking via dedicated Web Worker thread</span>
                <button
                  type="button"
                  onClick={cancelUpscale}
                  className="text-rose-500 hover:underline cursor-pointer"
                >
                  Cancel Execution
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-[#3b1219] border border-rose-300 dark:border-[#f8514966] text-rose-700 dark:text-[#f85149] rounded-xl text-xs font-mono">
              {error}
            </div>
          )}

          {/* Completed Outcome View */}
          {completedResult && (
            <div
              className={`p-4 rounded-xl border space-y-3 font-mono ${
                isLight
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : 'bg-[#0f2d1e] border-[#2ea04366]'
              }`}
            >
              <div className="flex items-center justify-between text-emerald-700 dark:text-[#3fb950]">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-bold text-xs">
                    UPSCALING COMPLETE: {completedResult.width} × {completedResult.height} PX
                  </span>
                </div>
                <span className="text-[11px] font-bold bg-[#10B981] text-white px-2 py-0.5 rounded-full">
                  300 DPI READY
                </span>
              </div>

              <p
                className={`text-[11px] leading-relaxed font-sans ${
                  isLight ? 'text-emerald-800' : 'text-[#7ee787]'
                }`}
              >
                The artwork for <span className="font-semibold">{item.name}</span> has been rebuilt using 2D Lanczos-3 sinc interpolation and style-tuned unsharp masking.
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleApplyToPoster}
                  className="flex-1 bg-[#2563EB] hover:bg-blue-700 text-white py-2.5 px-4 rounded-xl text-xs font-semibold font-sans flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-md active:scale-98"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Apply to Current Poster & Update Editor</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadStandalone}
                  className={`py-2.5 px-4 rounded-xl text-xs font-sans flex items-center space-x-1.5 transition-colors cursor-pointer border ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100'
                      : 'bg-[#21262D] hover:bg-[#2A313C] border-[#30363D] text-white'
                  }`}
                >
                  <Download className="w-4 h-4 pointer-events-none" />
                  <span>Download JPEG</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          className={`px-5 py-3.5 border-t flex items-center justify-between text-xs shrink-0 ${
            isLight ? 'bg-[#F8FAFC] border-[#E2E8F0]' : 'bg-[#1C2027] border-[#262B33]'
          }`}
        >
          <span
            className={`text-[11px] hidden sm:inline ${
              isLight ? 'text-slate-500' : 'text-[#94A3B8]'
            }`}
          >
            100% Private Client-Side Processing • Zero Cloud Uploads
          </span>

          <div className="flex items-center space-x-2 ml-auto">
            <button
              type="button"
              onClick={() => {
                if (isProcessing) cancelUpscale();
                setCompletedResult(null);
                onClose();
              }}
              className={`px-3.5 py-1.5 rounded-xl border transition-colors cursor-pointer text-xs ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                  : 'bg-[#21262D] hover:bg-[#2A313C] border-[#30363D] text-white'
              }`}
            >
              Close
            </button>

            {!completedResult && (
              <button
                type="button"
                onClick={handleStartUpscaling}
                disabled={isProcessing}
                className="bg-gradient-to-r from-[#2563EB] to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 text-xs shadow-sm active:scale-98"
              >
                <Wand2 className="w-3.5 h-3.5 text-amber-300" />
                <span>{isProcessing ? 'Processing Lanczos-3…' : 'Process Upscale'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
