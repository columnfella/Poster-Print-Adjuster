/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Download, Share2, Check, Smartphone, Image as ImageIcon } from 'lucide-react';
import { useModalTransition } from '../hooks/useModalTransition';

interface MobileSaveImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  filename: string;
  blob: Blob | null;
  theme?: 'light' | 'dark';
}

export const MobileSaveImageModal: React.FC<MobileSaveImageModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  filename,
  blob,
  theme = 'light',
}) => {
  const { isRendered, isVisible } = useModalTransition(isOpen, 280);
  const isLight = theme === 'light';

  if (!isRendered || !imageUrl) return null;

  const handleShare = async () => {
    if (!blob) return;
    try {
      const file = new File([blob], filename, { type: 'image/jpeg' });
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          files: [file],
          title: filename,
        });
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.warn('Share error:', e);
      }
    }
  };

  const handleDirectDownload = () => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 2000);
  };

  const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div
      onClick={onClose}
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs transition-opacity duration-300 ease-out ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg flex flex-col rounded-2xl border shadow-2xl overflow-hidden max-h-[92vh] transition-all duration-300 ease-out transform ${
          isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        } ${
          isLight ? 'bg-white border-[#E2E8F0] text-[#0F172A]' : 'bg-[#16191E] border-[#262B33] text-[#F8FAFC]'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${
            isLight ? 'bg-slate-50 border-[#E2E8F0]' : 'bg-[#1C2027] border-[#262B33]'
          }`}
        >
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#2563EB] text-white flex items-center justify-center shrink-0">
              <ImageIcon className="w-4 h-4 pointer-events-none" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-xs sm:text-sm truncate">{filename}</h3>
              <p className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                300 DPI Archival JPEG • High Resolution
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
              isLight
                ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                : 'bg-[#21262D] hover:bg-[#2A313C] border-[#30363D] text-slate-300'
            }`}
            title="Close"
          >
            <X className="w-4 h-4 pointer-events-none" />
          </button>
        </div>

        {/* Poster Image Viewport */}
        <div className="p-3 sm:p-4 flex flex-col items-center justify-center overflow-y-auto space-y-3">
          <div
            className={`w-full p-2 rounded-xl flex items-center justify-center border shadow-inner ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#111317] border-[#262B33]'
            }`}
          >
            <img
              src={imageUrl}
              alt={filename}
              className="max-h-[48vh] sm:max-h-[55vh] max-w-full object-contain rounded-lg shadow-md select-none touch-auto"
            />
          </div>

          {/* Mobile Instruction Callout */}
          <div
            className={`w-full px-3 py-2 rounded-xl text-[11px] flex items-center space-x-2 ${
              isLight ? 'bg-blue-50 text-blue-800 border border-blue-100' : 'bg-blue-950/40 text-blue-300 border border-blue-900/50'
            }`}
          >
            <Smartphone className="w-4 h-4 text-blue-500 shrink-0 pointer-events-none" />
            <span>
              <strong>iPhone / Android tip:</strong> Touch and hold the picture above to save directly to your Photos library, or use the buttons below.
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div
          className={`p-3.5 border-t flex flex-col sm:flex-row items-center gap-2 ${
            isLight ? 'bg-slate-50 border-[#E2E8F0]' : 'bg-[#1C2027] border-[#262B33]'
          }`}
        >
          {hasNativeShare && (
            <button
              type="button"
              onClick={handleShare}
              className="w-full flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-95 text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center space-x-2 transition-all shadow-xs cursor-pointer"
            >
              <Share2 className="w-4 h-4 pointer-events-none" />
              <span>Save to Photos / Share</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDirectDownload}
            className={`w-full ${
              hasNativeShare ? 'sm:w-auto' : 'flex-1'
            } bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center space-x-2 transition-all shadow-xs cursor-pointer`}
          >
            <Download className="w-4 h-4 pointer-events-none" />
            <span>Download .JPG File</span>
          </button>
        </div>
      </div>
    </div>
  );
};
