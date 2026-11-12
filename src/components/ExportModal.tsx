/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useId } from 'react';
import {
  Download,
  X,
  CheckCircle2,
  Share2,
  FolderArchive,
  Image as ImageIcon,
  Check,
  FileCheck,
  Smartphone,
  Sparkles,
  Info,
} from 'lucide-react';
import { PosterItem } from '../types';
import { calculatePrintVerdict, getPaperDimensions } from '../utils/printLogic';
import { useModalTransition } from '../hooks/useModalTransition';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: PosterItem[];
  currentItem: PosterItem | null;
  onDownloadSingleJpeg: (item: PosterItem) => Promise<void>;
  onDownloadMultipleJpegs: (items: PosterItem[]) => Promise<void>;
  onDownloadZip: () => void;
  isExporting: boolean;
  exportProgressText: string;
  theme?: 'light' | 'dark';
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  items,
  currentItem,
  onDownloadSingleJpeg,
  onDownloadMultipleJpegs,
  onDownloadZip,
  isExporting,
  exportProgressText,
  theme = 'light',
}) => {
  const isLight = theme === 'light';
  const { isRendered, isVisible } = useModalTransition(isOpen, 280);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => items.map((i) => i.id));
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen && items.length > 0) {
      setSelectedIds(items.map((i) => i.id));
    }
  }, [isOpen, items.length]);

  if (!isRendered) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedIds(items.map((i) => i.id));
  };

  const deselectAll = () => {
    setSelectedIds([]);
  };

  const handleSingleDownload = async (item: PosterItem) => {
    try {
      setDownloadingId(item.id);
      await onDownloadSingleJpeg(item);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadSelected = async () => {
    const selectedItems = items.filter((i) => selectedIds.includes(i.id));
    if (selectedItems.length === 0) return;
    await onDownloadMultipleJpegs(selectedItems);
  };

  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div
      onClick={onClose}
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs transition-opacity duration-300 ease-out ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden transition-all duration-300 ease-out transform ${
          isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-3'
        } ${
          isLight ? 'bg-white border-[#E2E8F0] text-[#0F172A]' : 'bg-[#16191E] border-[#262B33] text-[#F8FAFC]'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between px-4 sm:px-6 py-4 border-b shrink-0 ${
            isLight ? 'bg-slate-50/70 border-[#E2E8F0]' : 'bg-[#1C2027] border-[#262B33]'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#2563EB] to-[#10B981] flex items-center justify-center text-white shadow-xs">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                Download Posters (300 DPI)
              </h2>
              <p className={`text-xs ${isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'}`}>
                Individual JPEG files • Ready for direct print & mobile photos
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
              isLight
                ? 'bg-white hover:bg-slate-100 border-[#E2E8F0] text-slate-600'
                : 'bg-[#21262D] hover:bg-[#2A313C] border-[#30363D] text-[#94A3B8] hover:text-white'
            }`}
            aria-label="Close export dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informative Note for Mobile Users with Select All / Clear */}
        <div
          className={`px-4 sm:px-6 py-2.5 border-b text-xs flex flex-wrap items-center justify-between gap-2 shrink-0 ${
            isLight ? 'bg-blue-50/60 border-blue-100 text-blue-900' : 'bg-blue-950/20 border-blue-900/40 text-blue-300'
          }`}
        >
          <div className="flex items-center space-x-1.5 min-w-0">
            <Smartphone className="w-4 h-4 text-[#2563EB] shrink-0" />
            <span className="truncate">
              Tap <strong>Download JPEG</strong> to save 300 DPI image directly.
            </span>
          </div>

          <div className="flex items-center space-x-2 text-[11px] shrink-0 font-semibold">
            <button
              type="button"
              onClick={selectAll}
              className="text-[#2563EB] dark:text-[#38bdf8] hover:underline cursor-pointer"
            >
              Select All
            </button>
            <span className="text-slate-400">•</span>
            <button
              type="button"
              onClick={deselectAll}
              className="hover:underline text-slate-500 cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Scrollable Posters List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold">No posters in queue</p>
            </div>
          ) : (
            items.map((it) => {
              const isSelected = selectedIds.includes(it.id);
              const isCurrent = currentItem?.id === it.id;
              const isDownloadingThis = downloadingId === it.id;
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

              const estW = Math.round(dims.widthInches * 300);
              const estH = Math.round(dims.heightInches * 300);

              return (
                <div
                  key={it.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl border transition-all gap-3 ${
                    isSelected
                      ? isLight
                        ? 'bg-blue-50/40 border-[#2563EB]/40 shadow-xs ring-1 ring-[#2563EB]/20'
                        : 'bg-[#21262D]/70 border-[#38bdf8]/40 shadow-xs'
                      : isLight
                      ? 'bg-white hover:bg-slate-50 border-[#E2E8F0]'
                      : 'bg-[#1C2027] hover:bg-[#21262D] border-[#262B33]'
                  }`}
                >
                  {/* Left: Checkbox + Thumbnail + Details */}
                  <div className="flex items-center space-x-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(it.id)}
                      className="w-4 h-4 rounded-md accent-[#2563EB] cursor-pointer shrink-0"
                    />

                    <img
                      src={it.thumbnailUrl}
                      alt={it.name}
                      className="w-13 h-13 object-cover rounded-xl bg-black border border-slate-200 dark:border-slate-700 shrink-0 shadow-xs"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-1.5 flex-wrap">
                        <p className="text-xs sm:text-sm font-bold truncate max-w-[200px] sm:max-w-xs">
                          {it.name}
                        </p>
                        {isCurrent && (
                          <span className="text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/60 text-[#2563EB] dark:text-[#38bdf8] px-1.5 py-0.2 rounded-md">
                            Current
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 mt-0.5 text-[11px] text-slate-500 flex-wrap">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {it.paperSize} ({it.orientation.slice(0, 4)})
                        </span>
                        <span>•</span>
                        <span>{estW} × {estH} px</span>
                        <span>•</span>
                        <span
                          className={`font-semibold ${
                            verdict.tier === 'ok'
                              ? 'text-emerald-600'
                              : verdict.tier === 'warn'
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {verdict.roundedDpi} DPI
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Individual Download JPEG Action */}
                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleSingleDownload(it)}
                      disabled={isExporting}
                      className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-40 whitespace-nowrap ${
                        isLight
                          ? 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white'
                          : 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white'
                      }`}
                      title="Download this poster directly as regular JPEG"
                    >
                      <Download className="w-3.5 h-3.5 pointer-events-none" />
                      <span>{isDownloadingThis ? 'Rendering…' : 'Download JPEG'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer with Batch Actions */}
        <div
          className={`px-4 sm:px-6 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 ${
            isLight ? 'bg-slate-50/80 border-[#E2E8F0]' : 'bg-[#1C2027] border-[#262B33]'
          }`}
        >
          {/* Secondary option: Download as ZIP for desktop users if desired */}
          <div className="order-2 sm:order-1 flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                onDownloadZip();
                onClose();
              }}
              disabled={isExporting || items.length === 0}
              className={`text-xs px-3 py-2 rounded-xl border font-medium flex items-center space-x-1.5 transition-all cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-slate-100 border-[#E2E8F0] text-slate-700'
                  : 'bg-[#21262D] hover:bg-[#2A313C] border-[#30363D] text-slate-300'
              }`}
              title="Download all ready posters packaged in a single ZIP file"
            >
              <FolderArchive className="w-3.5 h-3.5 text-slate-500" />
              <span>Or Download ZIP Archive</span>
            </button>
          </div>

          {/* Primary Action: Download Selected Posters as separate JPEGs */}
          <div className="order-1 sm:order-2 w-full sm:w-auto flex items-center space-x-2">
            <button
              type="button"
              onClick={handleDownloadSelected}
              disabled={isExporting || selectedIds.length === 0}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-[#10B981] hover:bg-[#059669] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-xl transition-all shadow-md cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4 pointer-events-none" />
              <span>
                {isExporting
                  ? exportProgressText || 'Exporting JPEGs…'
                  : `Download ${selectedIds.length} Selected JPEG${selectedIds.length > 1 ? 's' : ''}`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
