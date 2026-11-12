/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  FileImage,
  Trash2,
  Download,
  FolderArchive,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertCircle,
  Plus,
  X,
} from 'lucide-react';
import { PosterItem } from '../types';
import { calculatePrintVerdict, getPaperDimensions } from '../utils/printLogic';

interface QueueSidebarProps {
  items: PosterItem[];
  currentItem: PosterItem | null;
  onSelectItem: (item: PosterItem) => void;
  onRemoveItem: (id: string, e: React.MouseEvent) => void;
  onAddFiles: (files: FileList | File[]) => void;
  onDownloadSingle: (item: PosterItem, e: React.MouseEvent) => void;
  onDownloadAllZip: () => void;
  onOpenSampleModal: () => void;
  isExporting: boolean;
  exportProgressText: string;
  theme?: 'light' | 'dark';
  onClose?: () => void;
  onOpenExportModal?: () => void;
}

export const QueueSidebar: React.FC<QueueSidebarProps> = ({
  items,
  currentItem,
  onSelectItem,
  onRemoveItem,
  onAddFiles,
  onDownloadSingle,
  onDownloadAllZip,
  onOpenSampleModal,
  isExporting,
  exportProgressText,
  theme = 'light',
  onClose,
  onOpenExportModal,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const isLight = theme === 'light';
  const pendingItems = items.filter((i) => !i.isSavedToReady);
  const readyItems = items.filter((i) => i.isSavedToReady);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAddFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <aside
      className={`w-[88vw] max-w-[340px] md:w-84 border-r flex flex-col h-full select-none font-sans transition-colors duration-200 shadow-2xl md:shadow-none ${
        isLight ? 'bg-[#FFFFFF] border-[#E2E8F0] text-[#0F172A]' : 'bg-[#16191E] border-[#262B33] text-[#F8FAFC]'
      }`}
    >
      {/* Mobile Drawer Header with Close Button */}
      <div
        className={`flex md:hidden items-center justify-between px-4 py-3 border-b ${
          isLight ? 'bg-white border-[#E2E8F0]' : 'bg-[#1C2027] border-[#262B33]'
        }`}
      >
        <div className="flex items-center space-x-2 font-bold text-sm">
          <FolderArchive className="w-4 h-4 text-[#2563EB]" />
          <span>Poster Queue ({items.length})</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
              isLight
                ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                : 'bg-[#21262D] border-[#30363D] text-[#94A3B8] hover:text-white'
            }`}
            title="Close Drawer"
            aria-label="Close Queue"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        )}
      </div>

      {/* Sidebar Header / Upload Area */}
      <div
        className={`p-3.5 border-b transition-colors ${
          isLight ? 'bg-[#F8FAFC] border-[#E2E8F0]' : 'bg-[#12151A] border-[#262B33]'
        }`}
      >
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center space-x-2 text-xs font-semibold">
            <UploadCloud className="w-4 h-4 text-[#2563EB]" />
            <span>Image Queue</span>
          </div>

          <button
            onClick={onOpenSampleModal}
            className={`text-xs font-medium px-2 py-0.5 rounded-lg border transition-all cursor-pointer flex items-center space-x-1 ${
              isLight
                ? 'bg-white hover:bg-slate-100 border-[#E2E8F0] text-[#2563EB]'
                : 'bg-[#21262D] hover:bg-[#2A313C] border-[#30363D] text-[#38bdf8]'
            }`}
            title="Load sample posters"
          >
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Samples</span>
          </button>
        </div>

        {/* Drag & Drop / Mobile Tap Upload Box */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-3 sm:p-4 text-center cursor-pointer transition-all active:scale-98 ${
            isDragOver
              ? 'border-[#2563EB] bg-blue-50/50 scale-[0.99]'
              : isLight
              ? 'border-blue-300 hover:border-[#2563EB] bg-blue-50/30 hover:bg-blue-50/60'
              : 'border-[#30363D] hover:border-[#388bfd] bg-[#111317]'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
          />
          <div className="w-8 h-8 rounded-full bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center mx-auto mb-1.5">
            <Plus className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-[#2563EB] dark:text-[#38bdf8]">
            Tap to Upload Image
          </p>
          <p className={`text-[11px] mt-0.5 ${isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'}`}>
            PNG, JPG, WEBP • Client-side private
          </p>
        </div>
      </div>

      {/* Queue Lists Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Section 1: To Adjust (Waiting) */}
        <div>
          <div
            className={`flex items-center justify-between text-xs font-semibold mb-2 px-1 ${
              isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'
            }`}
          >
            <span className="flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>TO ADJUST</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isLight ? 'bg-slate-100 text-slate-700' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {pendingItems.length}
            </span>
          </div>

          {pendingItems.length === 0 ? (
            <div
              className={`p-3.5 rounded-xl border text-center text-xs ${
                isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-[#111317] border-[#262B33] text-slate-500'
              }`}
            >
              No images waiting. Drop files above.
            </div>
          ) : (
            <div className="space-y-2">
              {pendingItems.map((it) => {
                const isSelected = currentItem?.id === it.id;
                const dims = getPaperDimensions(it.paperSize, it.orientation);
                const verdict = calculatePrintVerdict(
                  it.width,
                  it.height,
                  dims.widthInches,
                  dims.heightInches,
                  it.transform.f,
                  it.transform.cx,
                  it.transform.cy
                );

                const tierBadge =
                  verdict.tier === 'ok'
                    ? isLight
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-[#0f2d1e] text-[#3fb950] border-[#2ea04344]'
                    : verdict.tier === 'warn'
                    ? isLight
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-[#32230a] text-[#e3b341] border-[#d2992244]'
                    : isLight
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-[#3b1219] text-[#f85149] border-[#f8514944]';

                return (
                  <div
                    key={it.id}
                    onClick={() => onSelectItem(it)}
                    className={`group relative flex items-center p-2.5 rounded-xl border text-left cursor-pointer transition-all shadow-xs ${
                      isSelected
                        ? isLight
                          ? 'bg-blue-50/80 border-[#2563EB] ring-2 ring-[#2563EB]/20 shadow-sm'
                          : 'bg-[#21262D] border-[#0084FF] shadow-sm'
                        : isLight
                        ? 'bg-white hover:bg-slate-50 border-[#E2E8F0]'
                        : 'bg-[#16191E] hover:bg-[#21262D] border-[#262B33]'
                    }`}
                  >
                    <img
                      src={it.thumbnailUrl}
                      alt={it.name}
                      className="w-11 h-11 object-cover rounded-lg bg-black shrink-0 border border-slate-200 dark:border-slate-700"
                    />

                    <div className="ml-2.5 flex-1 min-w-0 pr-6">
                      <p className="text-xs font-semibold truncate">{it.name}</p>
                      <p className={`text-[11px] ${isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'}`}>
                        {it.paperSize} • {it.width}×{it.height}px
                      </p>
                    </div>

                    {/* Quality Tag */}
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border mr-1 ${tierBadge}`}
                    >
                      {verdict.roundedDpi} DPI
                    </span>

                    {/* Single download JPEG button */}
                    <button
                      onClick={(e) => onDownloadSingle(it, e)}
                      title="Download individual 300 DPI JPEG"
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer mr-1 shrink-0 ${
                        isLight
                          ? 'bg-slate-100 hover:bg-[#2563EB] hover:text-white border-slate-200 text-slate-600'
                          : 'bg-[#21262D] hover:bg-[#0084FF] hover:text-white border-[#30363D] text-[#94A3B8]'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5 pointer-events-none" />
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={(e) => onRemoveItem(it.id, e)}
                      title="Remove from queue"
                      className="p-1.5 hover:text-[#EF4444] hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-slate-400 transition-all cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Adjusted & Ready */}
        <div>
          <div
            className={`flex items-center justify-between text-xs font-semibold mb-2 px-1 ${
              isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'
            }`}
          >
            <span className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
              <span>READY TO PRINT</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-950/60 text-emerald-400'
              }`}
            >
              {readyItems.length}
            </span>
          </div>

          {readyItems.length === 0 ? (
            <div
              className={`p-3.5 rounded-xl border text-center text-xs ${
                isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-[#111317] border-[#262B33] text-slate-500'
              }`}
            >
              No saved posters yet. Click "Save to Ready" in the editor.
            </div>
          ) : (
            <div className="space-y-2">
              {readyItems.map((it) => {
                const isSelected = currentItem?.id === it.id;
                const dims = getPaperDimensions(it.paperSize, it.orientation);
                const verdict = calculatePrintVerdict(
                  it.width,
                  it.height,
                  dims.widthInches,
                  dims.heightInches,
                  it.transform.f,
                  it.transform.cx,
                  it.transform.cy
                );

                return (
                  <div
                    key={it.id}
                    onClick={() => onSelectItem(it)}
                    className={`group relative flex items-center p-2.5 rounded-xl border text-left cursor-pointer transition-all shadow-xs ${
                      isSelected
                        ? isLight
                          ? 'bg-blue-50/80 border-[#2563EB] ring-2 ring-[#2563EB]/20 shadow-sm'
                          : 'bg-[#21262D] border-[#0084FF] shadow-sm'
                        : isLight
                        ? 'bg-white hover:bg-slate-50 border-[#E2E8F0]'
                        : 'bg-[#16191E] hover:bg-[#21262D] border-[#262B33]'
                    }`}
                  >
                    <img
                      src={it.thumbnailUrl}
                      alt={it.name}
                      className="w-11 h-11 object-cover rounded-lg bg-black shrink-0 border border-slate-200 dark:border-slate-700"
                    />

                    <div className="ml-2.5 flex-1 min-w-0 pr-14">
                      <p className="text-xs font-semibold truncate">{it.name}</p>
                      <p className="text-[11px] text-[#10B981] font-semibold">
                        {it.paperSize} {it.orientation.slice(0, 4)} • {verdict.roundedDpi} DPI
                      </p>
                    </div>

                    {/* Single download button */}
                    <button
                      onClick={(e) => onDownloadSingle(it, e)}
                      title="Download individual 300 DPI File"
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer mr-1 ${
                        isLight
                          ? 'bg-slate-100 hover:bg-[#2563EB] hover:text-white border-slate-200 text-slate-600'
                          : 'bg-[#21262D] hover:bg-[#0084FF] hover:text-white border-[#30363D] text-[#94A3B8]'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5 pointer-events-none" />
                    </button>

                    {/* Remove button */}
                    <button
                      onClick={(e) => onRemoveItem(it.id, e)}
                      title="Remove poster"
                      className="p-1.5 hover:text-[#EF4444] hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-slate-400 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 pointer-events-none" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Footer with Primary JPEG Export & Optional ZIP Archive */}
      <div
        className={`p-3.5 border-t transition-colors space-y-2 ${
          isLight ? 'bg-[#F8FAFC] border-[#E2E8F0]' : 'bg-[#12151A] border-[#262B33]'
        }`}
      >
        <button
          onClick={onOpenExportModal}
          disabled={items.length === 0 || isExporting}
          className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center space-x-2 transition-all shadow-sm cursor-pointer"
        >
          <Download className="w-4 h-4 pointer-events-none" />
          <span>Export Posters (JPEG 300 DPI)</span>
        </button>

        {readyItems.length > 0 && (
          <button
            onClick={onDownloadAllZip}
            disabled={isExporting}
            className={`w-full text-[11px] py-1.5 px-3 rounded-lg border font-medium flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
              isLight
                ? 'bg-white hover:bg-slate-100 border-[#E2E8F0] text-slate-600'
                : 'bg-[#1C2027] hover:bg-[#21262D] border-[#30363D] text-slate-400 hover:text-white'
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5 text-slate-500" />
            <span>
              {isExporting ? exportProgressText : `Download All (${readyItems.length}) ZIP Archive`}
            </span>
          </button>
        )}
      </div>
    </aside>
  );
};
