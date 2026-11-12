/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Sliders,
  CheckCircle2,
  Maximize2,
  Download,
  FolderArchive,
  Layers,
  Sparkles,
  Sun,
  Moon,
  Printer,
  Archive,
} from 'lucide-react';
import { ActiveTab, PosterItem } from '../types';

interface VsCodeHeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  currentItem: PosterItem | null;
  onOpenInspectModal: () => void;
  onDownloadCurrent: () => void;
  onDownloadAllZip: () => void;
  readyCount: number;
  isExporting: boolean;
  isQueueOpen: boolean;
  onToggleQueue: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onAddFiles?: (files: FileList | File[]) => void;
  totalQueueCount?: number;
  onOpenExportModal?: () => void;
}

export const VsCodeHeader: React.FC<VsCodeHeaderProps> = ({
  activeTab,
  setActiveTab,
  currentItem,
  onOpenInspectModal,
  onDownloadCurrent,
  onDownloadAllZip,
  readyCount,
  isExporting,
  isQueueOpen,
  onToggleQueue,
  theme = 'light',
  onToggleTheme,
  onAddFiles,
  totalQueueCount = 0,
  onOpenExportModal,
}) => {
  const isLight = theme === 'light';
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onAddFiles) {
      onAddFiles(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <header
      className={`border-b select-none transition-colors duration-200 shrink-0 ${
        isLight ? 'bg-[#FFFFFF] border-[#E2E8F0]' : 'bg-[#16191E] border-[#262B33]'
      }`}
    >
      {/* Hidden file input for header upload button */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
      />

      {/* Top Brand, Primary Upload & Utility Bar */}
      <div
        className={`flex items-center justify-between px-3 sm:px-4 h-13 border-b text-xs ${
          isLight ? 'border-[#E2E8F0]' : 'border-[#262B33]'
        }`}
      >
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#2563EB] via-[#3B82F6] to-[#EF4444] flex items-center justify-center shadow-xs text-white shrink-0">
            <Printer className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <span
                className={`font-bold tracking-tight text-xs sm:text-sm truncate ${
                  isLight ? 'text-[#0F172A]' : 'text-[#F8FAFC]'
                }`}
              >
                POSTER STUDIO
              </span>
              <span className="bg-[#EF4444] text-white text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                300 DPI
              </span>
            </div>
            <p
              className={`text-[10px] hidden md:block truncate ${
                isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'
              }`}
            >
              Archival Print Framing & Inspection
            </p>
          </div>
        </div>

        {/* Center: Active File Pill (Desktop) */}
        <div
          className={`hidden lg:flex items-center px-3 py-1 rounded-full text-xs transition-colors border max-w-xs truncate ${
            isLight
              ? 'bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A]'
              : 'bg-[#111317] border-[#30363D] text-[#F8FAFC]'
          }`}
        >
          <span className="font-medium truncate max-w-[160px]">
            {currentItem ? currentItem.name : 'No image loaded'}
          </span>
          {currentItem && (
            <span className="ml-2 text-[10px] font-bold bg-[#2563EB]/10 text-[#2563EB] dark:text-[#38bdf8] px-2 py-0.5 rounded-full shrink-0">
              {currentItem.paperSize} • {currentItem.orientation.slice(0, 4)}
            </span>
          )}
        </div>

        {/* Right: High-Visibility Upload Button, Queue Drawer & Theme */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {/* Prominent "+ Upload" Button - Mobile only (desktop has permanent upload dropzone in sidebar) */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex md:hidden items-center space-x-1.5 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] active:scale-95 text-white font-semibold text-xs px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl transition-all shadow-sm cursor-pointer"
            title="Upload image or poster (PNG, JPG, WEBP)"
          >
            <span className="text-base leading-none font-bold">+</span>
            <span className="font-semibold tracking-wide">Upload</span>
          </button>

          {/* Queue Drawer Button with Item Counter Badge - Mobile only (desktop has permanent sidebar) */}
          <button
            type="button"
            onClick={onToggleQueue}
            className={`flex md:hidden items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border text-xs font-medium cursor-pointer transition-all active:scale-95 ${
              isQueueOpen
                ? 'bg-[#2563EB] text-white border-[#2563EB]'
                : isLight
                ? 'bg-[#F8FAFC] hover:bg-slate-100 border-[#E2E8F0] text-[#0F172A]'
                : 'bg-[#21262D] hover:bg-[#2A313C] border-[#30363D] text-[#F8FAFC]'
            }`}
            title="Open Batch Queue"
          >
            <FolderArchive className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#38bdf8]" />
            <span className="hidden xs:inline">Queue</span>
            {totalQueueCount > 0 && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                  isQueueOpen
                    ? 'bg-white text-[#2563EB]'
                    : 'bg-[#2563EB] text-white'
                }`}
              >
                {totalQueueCount}
              </span>
            )}
          </button>

          {/* Theme Switcher Button */}
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className={`p-2 rounded-xl border transition-all cursor-pointer shadow-xs active:scale-95 ${
                isLight
                  ? 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-700 hover:bg-slate-100'
                  : 'bg-[#21262D] border-[#30363D] text-slate-200 hover:bg-slate-700'
              }`}
              title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              aria-label="Toggle Theme"
            >
              {isLight ? (
                <Moon className="w-4 h-4 text-slate-700" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Mode Navigation & Export Actions */}
      <div
        className={`flex items-center justify-between px-2.5 sm:px-3 py-1.5 gap-2 overflow-x-auto no-scrollbar ${
          isLight ? 'bg-[#FAFAFA]' : 'bg-[#12151A]'
        }`}
      >
        {/* Navigation Tabs (Smooth segmented pill control) */}
        <div className="flex items-center space-x-1 shrink-0">
          <button
            onClick={() => setActiveTab('editor')}
            className={`flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'editor'
                ? isLight
                  ? 'bg-[#FFFFFF] text-[#2563EB] shadow-xs font-semibold border border-[#E2E8F0]'
                  : 'bg-[#21262D] text-[#38bdf8] shadow-xs font-semibold border border-[#30363D]'
                : isLight
                ? 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1A1D24]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>Framing</span>
          </button>

          <button
            onClick={() => setActiveTab('verdict')}
            className={`flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'verdict'
                ? isLight
                  ? 'bg-[#FFFFFF] text-[#10B981] shadow-xs font-semibold border border-[#E2E8F0]'
                  : 'bg-[#21262D] text-[#34d399] shadow-xs font-semibold border border-[#30363D]'
                : isLight
                ? 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1A1D24]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
            <span>Verdict</span>
          </button>

          <button
            onClick={() => setActiveTab('wall')}
            className={`flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'wall'
                ? isLight
                  ? 'bg-[#FFFFFF] text-[#8B5CF6] shadow-xs font-semibold border border-[#E2E8F0]'
                  : 'bg-[#21262D] text-[#c084fc] shadow-xs font-semibold border border-[#30363D]'
                : isLight
                ? 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1A1D24]'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>Wall</span>
          </button>
        </div>

        {/* Action Controls on Right */}
        <div className="flex items-center space-x-1.5 shrink-0">
          {/* 100% Loupe button */}
          <button
            onClick={onOpenInspectModal}
            disabled={!currentItem}
            className={`flex items-center space-x-1 text-xs px-2.5 sm:px-3 py-1.5 rounded-xl border transition-all cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ${
              isLight
                ? 'bg-[#FFFFFF] hover:bg-slate-50 border-[#E2E8F0] text-[#0F172A]'
                : 'bg-[#21262D] hover:bg-[#2A313C] border-[#30363D] text-[#F8FAFC]'
            }`}
            title="Inspect 1:1 actual print pixels"
          >
            <Maximize2 className="w-3.5 h-3.5 text-[#2563EB]" />
            <span className="hidden sm:inline font-medium">100% Loupe</span>
          </button>

          {/* Export Posters (JPEG / Batch) - Mobile only (desktop has permanent primary Export button in sidebar footer) */}
          <button
            onClick={onOpenExportModal || onDownloadCurrent}
            disabled={!currentItem || isExporting}
            className="flex md:hidden items-center space-x-1.5 text-xs bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-3 sm:px-4 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer whitespace-nowrap active:scale-95"
            title="Download posters as regular 300 DPI JPEG"
          >
            <Download className="w-3.5 h-3.5 pointer-events-none" />
            <span>Export</span>
          </button>

          {/* Batch ZIP Export - Mobile only */}
          {readyCount > 1 && (
            <button
              onClick={onDownloadAllZip}
              disabled={isExporting}
              className="flex md:hidden items-center space-x-1 text-xs bg-[#10B981] hover:bg-[#059669] disabled:opacity-40 text-white font-semibold px-2.5 sm:px-3 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer whitespace-nowrap active:scale-95"
              title={`Download all ${readyCount} print-ready posters in ZIP`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>({readyCount})</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

