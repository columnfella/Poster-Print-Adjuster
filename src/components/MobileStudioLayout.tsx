/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  Plus,
  Sliders,
  CheckCircle2,
  Layers,
  Archive,
  Download,
  Crop,
  Wand2,
  Undo2,
  Redo2,
  BookmarkPlus,
  Sun,
  Moon,
  Trash2,
  Sparkles,
  Maximize2,
  ChevronDown,
  X,
  FileCheck,
  Check,
  Printer,
  Info,
} from 'lucide-react';
import { PosterItem } from '../types';
import {
  PAPER_SIZES,
  STANDARD_BLEED_INCHES,
  getPaperDimensions,
  calculatePresetFit,
  Orientation,
  PrintVerdict,
} from '../utils/printLogic';
import { EditorCanvas } from './EditorCanvas';
import { PrintVerdictPanel } from './PrintVerdictPanel';
import { WallSimulator } from './WallSimulator';

export interface MobileStudioLayoutProps {
  items: PosterItem[];
  currentItem: PosterItem | null;
  currentVerdict: PrintVerdict | null;
  currentId: string | null;
  onSelectItem: (item: PosterItem) => void;
  onRemoveItem: (id: string, e: React.MouseEvent) => void;
  onAddFiles: (files: FileList | File[]) => void;
  onUpdateItem: (updated: PosterItem) => void;
  onSaveToReady: () => void;
  onExportSingle: (item: PosterItem) => void;
  onBatchZipExport: () => void;
  onLoadSample: (type: 'bauhaus' | 'cyberpunk' | 'minimalist' | 'wave') => void;
  onOpenSampleModal: () => void;
  onOpenUpscaler: () => void;
  onOpenInspect: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onRecordHistory: () => void;
  isExporting: boolean;
  exportProgressText: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  readyCount: number;
}

export type MobileTab = 'editor' | 'verdict' | 'wall' | 'batch';

export const MobileStudioLayout: React.FC<MobileStudioLayoutProps> = ({
  items,
  currentItem,
  currentVerdict,
  currentId,
  onSelectItem,
  onRemoveItem,
  onAddFiles,
  onUpdateItem,
  onSaveToReady,
  onExportSingle,
  onBatchZipExport,
  onLoadSample,
  onOpenSampleModal,
  onOpenUpscaler,
  onOpenInspect,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onRecordHistory,
  isExporting,
  exportProgressText,
  theme,
  onToggleTheme,
  readyCount,
}) => {
  const isLight = theme === 'light';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>('editor');
  const [isPaperSheetOpen, setIsPaperSheetOpen] = useState(false);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(e.target.files);
      e.target.value = '';
    }
  };

  // Helper for applying framing presets on mobile
  const handleApplyPreset = (type: 'bleed' | 'width' | 'height') => {
    if (!currentItem) return;
    onRecordHistory();
    const dims = getPaperDimensions(currentItem.paperSize, currentItem.orientation);
    const preset = calculatePresetFit(type, currentItem.width, currentItem.height, dims.widthInches, dims.heightInches);
    onUpdateItem({
      ...currentItem,
      zoom: preset.f,
      transform: preset,
      version: currentItem.version + 1,
    });
  };

  const handleCenter = () => {
    if (!currentItem) return;
    onRecordHistory();
    onUpdateItem({
      ...currentItem,
      transform: { ...currentItem.transform, cx: 0.5, cy: 0.5 },
      version: currentItem.version + 1,
    });
  };

  const handlePaperSizeChange = (newSize: string) => {
    if (!currentItem) return;
    onRecordHistory();
    const dims = getPaperDimensions(newSize, currentItem.orientation);
    const preset = calculatePresetFit('bleed', currentItem.width, currentItem.height, dims.widthInches, dims.heightInches);
    onUpdateItem({
      ...currentItem,
      paperSize: newSize,
      zoom: preset.f,
      transform: preset,
      version: currentItem.version + 1,
    });
  };

  const handleOrientationToggle = (newOrientation: Orientation) => {
    if (!currentItem || currentItem.orientation === newOrientation) return;
    onRecordHistory();
    const dims = getPaperDimensions(currentItem.paperSize, newOrientation);
    const preset = calculatePresetFit('bleed', currentItem.width, currentItem.height, dims.widthInches, dims.heightInches);
    onUpdateItem({
      ...currentItem,
      orientation: newOrientation,
      zoom: preset.f,
      transform: preset,
      version: currentItem.version + 1,
    });
  };

  // Standard Paper sizes metadata for the bottom sheet
  const paperOptions = [
    { id: 'A4', label: 'A4', desc: '210 × 297 mm (Standard Document / Small Poster)' },
    { id: 'A3', label: 'A3', desc: '297 × 420 mm (Popular Medium Poster)' },
    { id: 'A2', label: 'A2', desc: '420 × 594 mm (Classic Large Gallery Poster)' },
    { id: 'A1', label: 'A1', desc: '594 × 841 mm (Extra Large Architectural Print)' },
    { id: 'Letter', label: 'US Letter', desc: '8.5 × 11 in (216 × 279 mm)' },
    { id: 'Tabloid', label: 'US Tabloid', desc: '11 × 17 in (279 × 432 mm)' },
    { id: 'ArchD', label: '24×36 Poster', desc: '24 × 36 in (610 × 914 mm Standard US Poster)' },
  ];

  return (
    <div
      className={`flex flex-col h-full w-full overflow-hidden select-none ${
        isLight ? 'bg-[#F8FAFC] text-[#0F172A]' : 'bg-[#0D0F12] text-[#F8FAFC]'
      }`}
    >
      {/* Hidden File Input for Mobile Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
      />

      {/* TOP HEADER: Prominent Upload Button & Brand Bar */}
      <header
        className={`px-3 py-2.5 border-b shrink-0 flex items-center justify-between gap-2 shadow-xs transition-colors ${
          isLight ? 'bg-[#FFFFFF] border-[#E2E8F0]' : 'bg-[#16191E] border-[#262B33]'
        }`}
      >
        <div className="flex items-center space-x-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#2563EB] via-[#3B82F6] to-[#EF4444] flex items-center justify-center text-white shadow-xs shrink-0">
            <Printer className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-xs tracking-tight truncate">POSTER STUDIO</span>
              <span className="bg-[#EF4444] text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase">
                300 DPI
              </span>
            </div>
            <p className="text-[10px] text-slate-500 truncate">
              {items.length} {items.length === 1 ? 'image' : 'images'} loaded
            </p>
          </div>
        </div>

        {/* Right Header Actions: High-visibility Upload & Theme switch */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* HIGH-VISIBILITY PRIMARY UPLOAD BUTTON */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1.5 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] active:scale-95 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-md cursor-pointer transition"
            title="Upload photo from phone or files"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Upload Photo</span>
          </button>

          {/* Quick sample trigger */}
          <button
            type="button"
            onClick={onOpenSampleModal}
            className={`p-2 rounded-xl border text-xs font-medium transition active:scale-95 ${
              isLight
                ? 'bg-[#F8FAFC] hover:bg-slate-100 border-[#E2E8F0] text-slate-700'
                : 'bg-[#21262D] hover:bg-[#2A313C] border-[#30363D] text-[#94A3B8]'
            }`}
            title="Sample Artworks"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
          </button>

          {/* Dark / Light Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            className={`p-2 rounded-xl border transition active:scale-95 ${
              isLight
                ? 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-700'
                : 'bg-[#21262D] border-[#30363D] text-amber-400'
            }`}
            title="Toggle theme"
          >
            {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* PROMINENT UPLOADED IMAGES STRIP (FILES LIST) - ALWAYS VISIBLE */}
      <section
        className={`px-3 py-2 border-b shrink-0 transition-colors ${
          isLight ? 'bg-slate-50/70 border-[#E2E8F0]' : 'bg-[#12151A] border-[#262B33]'
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Uploaded Images
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                items.length > 0
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
              }`}
            >
              {items.length}
            </span>
          </div>

          {/* Quick status & Batch link */}
          {items.length > 1 && (
            <button
              onClick={() => setMobileTab('batch')}
              className="text-[11px] font-semibold text-[#2563EB] dark:text-[#38bdf8] flex items-center space-x-1 active:underline cursor-pointer"
            >
              <span>Batch ({readyCount} Ready)</span>
            </button>
          )}
        </div>

        {/* Horizontal Carousel of Uploaded Images */}
        <div className="flex items-center space-x-2.5 overflow-x-auto no-scrollbar py-0.5">
          {items.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`flex-1 py-3 px-4 rounded-xl border border-dashed flex items-center justify-center space-x-2 cursor-pointer transition ${
                isLight
                  ? 'bg-white border-blue-300 text-blue-600'
                  : 'bg-[#16191E] border-blue-500/40 text-blue-400'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              <span className="text-xs font-semibold">Tap to upload your first artwork</span>
            </div>
          ) : (
            <>
              {items.map((item) => {
                const isSelected = item.id === currentId || (!currentId && item.id === items[0]?.id);
                // Calculate item DPI verdict estimate
                const dims = getPaperDimensions(item.paperSize, item.orientation);
                const approxDpi = Math.round(
                  Math.min(item.width / dims.widthInches, item.height / dims.heightInches)
                );

                return (
                  <div
                    key={item.id}
                    onClick={() => onSelectItem(item)}
                    className={`relative shrink-0 w-28 p-1.5 rounded-xl border transition cursor-pointer flex flex-col items-center ${
                      isSelected
                        ? isLight
                          ? 'bg-white border-[#2563EB] ring-2 ring-[#2563EB]/25 shadow-md'
                          : 'bg-[#1A1F26] border-[#38bdf8] ring-2 ring-[#38bdf8]/25 shadow-md'
                        : isLight
                        ? 'bg-white/80 border-slate-200 hover:border-slate-300'
                        : 'bg-[#16191E] border-[#2A313C] hover:border-slate-600'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="w-full h-16 rounded-lg bg-slate-100 dark:bg-[#0D0F12] overflow-hidden flex items-center justify-center relative mb-1.5">
                      <img
                        src={item.thumbnailUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                      {/* Ready Badge checkmark */}
                      {item.isSavedToReady && (
                        <div className="absolute bottom-1 right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>

                    {/* File Name */}
                    <p className="text-[10px] font-semibold truncate w-full text-center leading-tight mb-0.5">
                      {item.name}
                    </p>

                    {/* DPI Badge */}
                    <div className="flex items-center space-x-1">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                          approxDpi >= 300
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : approxDpi >= 200
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {approxDpi} DPI
                      </span>
                    </div>

                    {/* Quick Remove Button */}
                    <button
                      type="button"
                      onClick={(e) => onRemoveItem(item.id, e)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-md active:scale-90"
                      title="Remove image"
                    >
                      <X className="w-3 h-3 stroke-[3]" />
                    </button>
                  </div>
                );
              })}

              {/* Add More Card at end of carousel */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`shrink-0 w-20 h-26 rounded-xl border border-dashed flex flex-col items-center justify-center space-y-1 cursor-pointer transition active:scale-95 ${
                  isLight
                    ? 'border-blue-300 hover:bg-blue-50/50 text-blue-600'
                    : 'border-blue-500/40 hover:bg-blue-500/10 text-blue-400'
                }`}
                title="Add more photos"
              >
                <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-semibold text-center leading-none">Add Image</span>
              </div>
            </>
          )}
        </div>
      </section>

      {/* MAIN VIEWPORT: Render active mobile tab */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {/* TAB: EDITOR */}
        {mobileTab === 'editor' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Canvas Viewport (touch pinch & drag) */}
            <div className="flex-1 relative overflow-hidden">
              <EditorCanvas
                item={currentItem}
                onUpdateItem={onUpdateItem}
                onSaveToReady={onSaveToReady}
                verdict={currentVerdict}
                onUndo={onUndo}
                onRedo={onRedo}
                canUndo={canUndo}
                canRedo={canRedo}
                onOpenUpscaler={onOpenUpscaler}
                onRecordHistory={onRecordHistory}
                theme={theme}
                onAddFiles={onAddFiles}
                onLoadSample={onLoadSample}
                hideToolbar={true}
              />
            </div>

            {/* PROMINENT MOBILE EDIT ACTION BAR */}
            {currentItem && (
              <div
                className={`p-2.5 border-t shrink-0 flex flex-col gap-2 transition-colors shadow-lg ${
                  isLight ? 'bg-white border-[#E2E8F0]' : 'bg-[#16191E] border-[#262B33]'
                }`}
              >
                {/* Row 1: Paper Format Pill + AI Upscaler + Export */}
                <div className="flex items-center gap-1.5">
                  {/* Paper Format & Orientation Trigger Button */}
                  <button
                    type="button"
                    onClick={() => setIsPaperSheetOpen(true)}
                    className={`flex-1 flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold shadow-xs active:scale-98 transition cursor-pointer ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-800'
                        : 'bg-[#21262D] border-[#30363D] text-slate-200'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 truncate">
                      <span className="text-[#2563EB] dark:text-[#38bdf8] font-bold">
                        {currentItem.paperSize}
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="capitalize">{currentItem.orientation}</span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                  </button>

                  {/* AI 300 DPI Upscaler Button */}
                  <button
                    type="button"
                    onClick={onOpenUpscaler}
                    className="flex items-center space-x-1.5 bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-indigo-500/15 hover:from-amber-500/25 border border-amber-500/40 text-amber-600 dark:text-amber-400 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95 shadow-xs cursor-pointer shrink-0"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-amber-500" />
                    <span>Upscale</span>
                  </button>

                  {/* Export 300 DPI Action */}
                  <button
                    type="button"
                    onClick={() => onExportSingle(currentItem)}
                    disabled={isExporting}
                    className="flex items-center space-x-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs active:scale-95 transition cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export</span>
                  </button>
                </div>

                {/* Row 2: Framing Presets & Quick Touch Tools */}
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center space-x-1.5 flex-1">
                    {/* Fill Bleed (Primary preset) */}
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('bleed')}
                      className={`flex-1 flex items-center justify-center space-x-1 py-1.5 px-2 rounded-xl border text-xs font-semibold shadow-xs active:scale-95 cursor-pointer ${
                        isLight
                          ? 'bg-blue-50 border-blue-200 text-[#2563EB]'
                          : 'bg-[#21262D] border-[#30363D] text-[#38bdf8]'
                      }`}
                      title="Fill entire poster with 3mm bleed"
                    >
                      <Crop className="w-3.5 h-3.5" />
                      <span>Fill Bleed</span>
                    </button>

                    {/* Fit In */}
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('width')}
                      className={`flex-1 py-1.5 px-2 rounded-xl border text-xs font-medium active:scale-95 cursor-pointer ${
                        isLight
                          ? 'bg-slate-50 border-slate-200 text-slate-700'
                          : 'bg-[#21262D] border-[#30363D] text-slate-300'
                      }`}
                      title="Fit entire artwork on sheet"
                    >
                      Fit In
                    </button>

                    {/* Center */}
                    <button
                      type="button"
                      onClick={handleCenter}
                      className={`py-1.5 px-2.5 rounded-xl border text-xs font-medium active:scale-95 cursor-pointer ${
                        isLight
                          ? 'bg-slate-50 border-slate-200 text-slate-700'
                          : 'bg-[#21262D] border-[#30363D] text-slate-300'
                      }`}
                      title="Re-center image"
                    >
                      Center
                    </button>
                  </div>

                  {/* Undo & Redo Buttons */}
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      type="button"
                      onClick={onUndo}
                      disabled={!canUndo}
                      className={`p-2 rounded-xl border transition active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${
                        isLight
                          ? 'bg-slate-50 border-slate-200 text-slate-700'
                          : 'bg-[#21262D] border-[#30363D] text-slate-300'
                      }`}
                      title="Undo"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={onRedo}
                      disabled={!canRedo}
                      className={`p-2 rounded-xl border transition active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${
                        isLight
                          ? 'bg-slate-50 border-slate-200 text-slate-700'
                          : 'bg-[#21262D] border-[#30363D] text-slate-300'
                      }`}
                      title="Redo"
                    >
                      <Redo2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Save to Ready Toggle */}
                    <button
                      type="button"
                      onClick={onSaveToReady}
                      className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold shadow-xs active:scale-95 transition cursor-pointer ${
                        currentItem.isSavedToReady
                          ? 'bg-[#10B981] text-white'
                          : isLight
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                          : 'bg-[#2A313C] text-slate-200 border border-[#30363D]'
                      }`}
                      title="Mark as ready for batch printing"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      <span>{currentItem.isSavedToReady ? 'Ready' : 'Save'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: PRINT VERDICT & DPI CHECK */}
        {mobileTab === 'verdict' && (
          <div className="flex-1 overflow-y-auto p-3">
            <PrintVerdictPanel
              item={currentItem}
              verdict={currentVerdict}
              onOpenInspect={onOpenInspect}
              onApplyBleed={() => handleApplyPreset('bleed')}
              theme={theme}
            />
          </div>
        )}

        {/* TAB: WALL SIMULATOR (ROOM PREVIEW) */}
        {mobileTab === 'wall' && (
          <div className="flex-1 overflow-hidden">
            <WallSimulator item={currentItem} verdict={currentVerdict} theme={theme} />
          </div>
        )}

        {/* TAB: BATCH & FILES LIST */}
        {mobileTab === 'batch' && (
          <div className="flex-1 overflow-y-auto p-4 flex flex-col space-y-4">
            {/* Batch Status Card */}
            <div
              className={`p-4 rounded-2xl border shadow-sm ${
                isLight ? 'bg-white border-[#E2E8F0]' : 'bg-[#16191E] border-[#262B33]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-sm tracking-tight">Batch Print Packaging</h3>
                <span className="text-xs font-bold text-[#2563EB] dark:text-[#38bdf8]">
                  {readyCount} of {items.length} Ready
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Export all prepared posters bundled into a single ZIP archive, each embedded with 300 DPI metadata.
              </p>

              <button
                type="button"
                onClick={onBatchZipExport}
                disabled={readyCount === 0 || isExporting}
                className="w-full flex items-center justify-center space-x-2 bg-[#10B981] hover:bg-[#059669] disabled:opacity-40 text-white font-bold text-xs py-2.5 rounded-xl shadow-md cursor-pointer transition active:scale-98"
              >
                <Archive className="w-4 h-4" />
                <span>Download All {readyCount} Posters in ZIP</span>
              </button>
            </div>

            {/* Files Detailed List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                All Loaded Files ({items.length})
              </h4>
              {items.map((item, index) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectItem(item);
                    setMobileTab('editor');
                  }}
                  className={`p-3 rounded-xl border flex items-center justify-between transition cursor-pointer ${
                    item.id === currentId
                      ? isLight
                        ? 'bg-blue-50/50 border-[#2563EB]'
                        : 'bg-blue-950/20 border-[#38bdf8]'
                      : isLight
                      ? 'bg-white border-slate-200'
                      : 'bg-[#16191E] border-[#262B33]'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <img
                      src={item.thumbnailUrl}
                      alt={item.name}
                      className="w-12 h-12 object-cover rounded-lg border border-slate-200 dark:border-slate-800 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{item.name}</p>
                      <p className="text-[10px] text-slate-500">
                        {item.paperSize} • {item.orientation} • {item.width}×{item.height}px
                      </p>
                      {item.isSavedToReady && (
                        <span className="inline-block mt-0.5 text-[9px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.2 rounded-full">
                          Ready to Print
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onExportSingle(item);
                      }}
                      className="p-2 rounded-xl bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 active:scale-95"
                      title="Download 300 DPI"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => onRemoveItem(item.id, e)}
                      className="p-2 rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 active:scale-95"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Sample Poster Loader */}
            <div className="pt-2">
              <button
                type="button"
                onClick={onOpenSampleModal}
                className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:border-[#2563EB] flex items-center justify-center space-x-2"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Explore Preset Archival Sample Artworks</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION DOCK */}
      <nav
        className={`border-t px-2 py-1.5 shrink-0 flex items-center justify-around transition-colors z-30 ${
          isLight ? 'bg-white border-[#E2E8F0]' : 'bg-[#16191E] border-[#262B33]'
        }`}
      >
        {/* Editor Tab */}
        <button
          type="button"
          onClick={() => setMobileTab('editor')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition cursor-pointer ${
            mobileTab === 'editor'
              ? 'text-[#2563EB] dark:text-[#38bdf8] font-bold'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium'
          }`}
        >
          <Sliders className="w-4.5 h-4.5 mb-0.5" />
          <span className="text-[10px]">Editor</span>
        </button>

        {/* DPI Verdict Tab */}
        <button
          type="button"
          onClick={() => setMobileTab('verdict')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition cursor-pointer relative ${
            mobileTab === 'verdict'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium'
          }`}
        >
          <div className="relative">
            <CheckCircle2 className="w-4.5 h-4.5 mb-0.5" />
            {currentVerdict && (
              <span
                className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
                  currentVerdict.tier === 'ok'
                    ? 'bg-emerald-500'
                    : currentVerdict.tier === 'warn'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
              />
            )}
          </div>
          <span className="text-[10px]">DPI Check</span>
        </button>

        {/* Room View Tab */}
        <button
          type="button"
          onClick={() => setMobileTab('wall')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition cursor-pointer ${
            mobileTab === 'wall'
              ? 'text-purple-600 dark:text-purple-400 font-bold'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium'
          }`}
        >
          <Layers className="w-4.5 h-4.5 mb-0.5" />
          <span className="text-[10px]">Room View</span>
        </button>

        {/* Batch & Files Tab */}
        <button
          type="button"
          onClick={() => setMobileTab('batch')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition cursor-pointer relative ${
            mobileTab === 'batch'
              ? 'text-[#2563EB] dark:text-[#38bdf8] font-bold'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium'
          }`}
        >
          <div className="relative">
            <Archive className="w-4.5 h-4.5 mb-0.5" />
            {readyCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-emerald-500 text-white text-[9px] font-bold px-1 rounded-full">
                {readyCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">Files & ZIP</span>
        </button>
      </nav>

      {/* MOBILE PAPER & ORIENTATION BOTTOM SHEET */}
      {isPaperSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-black/60 transition-opacity"
            onClick={() => setIsPaperSheetOpen(false)}
          />

          <div
            className={`relative z-10 rounded-t-3xl p-5 border-t shadow-2xl max-h-[85vh] overflow-y-auto transition-transform ${
              isLight ? 'bg-white border-slate-200 text-[#0F172A]' : 'bg-[#16191E] border-[#2A313C] text-white'
            }`}
          >
            {/* Sheet Handle */}
            <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold tracking-tight">Print Paper & Dimensions</h3>
              <button
                type="button"
                onClick={() => setIsPaperSheetOpen(false)}
                className="p-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Orientation Toggle Switch */}
            <div className="mb-4">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                Sheet Orientation
              </label>
              <div
                className={`grid grid-cols-2 p-1 rounded-xl border ${
                  isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#0D0F12] border-[#30363D]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleOrientationToggle('portrait')}
                  className={`py-2 rounded-lg text-xs font-bold transition ${
                    currentItem?.orientation === 'portrait'
                      ? 'bg-[#2563EB] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Portrait (Vertical)
                </button>
                <button
                  type="button"
                  onClick={() => handleOrientationToggle('landscape')}
                  className={`py-2 rounded-lg text-xs font-bold transition ${
                    currentItem?.orientation === 'landscape'
                      ? 'bg-[#2563EB] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Landscape (Horizontal)
                </button>
              </div>
            </div>

            {/* Standard Paper Sizes List */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                Standard Poster Formats
              </label>
              <div className="space-y-2">
                {paperOptions.map((opt) => {
                  const isCurrent = (currentItem?.paperSize || 'A3') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        handlePaperSizeChange(opt.id);
                        setIsPaperSheetOpen(false);
                      }}
                      className={`w-full text-left p-3 rounded-xl border flex items-center justify-between transition cursor-pointer ${
                        isCurrent
                          ? isLight
                            ? 'bg-blue-50 border-[#2563EB] text-[#2563EB]'
                            : 'bg-blue-950/30 border-[#38bdf8] text-[#38bdf8]'
                          : isLight
                          ? 'bg-slate-50/80 hover:bg-slate-100 border-slate-200'
                          : 'bg-[#21262D] hover:bg-[#2A313C] border-[#30363D]'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-xs">{opt.label}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</p>
                      </div>
                      {isCurrent && <Check className="w-4 h-4 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
