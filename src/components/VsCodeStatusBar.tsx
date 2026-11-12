/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GitBranch, AlertTriangle, CheckCircle2, Shield, Eye, Layers } from 'lucide-react';
import { PosterItem } from '../types';
import { PrintVerdict } from '../utils/printLogic';

interface VsCodeStatusBarProps {
  currentItem: PosterItem | null;
  verdict: PrintVerdict | null;
  totalCount: number;
  readyCount: number;
  onOpenSecurityModal: () => void;
}

export const VsCodeStatusBar: React.FC<VsCodeStatusBarProps> = ({
  currentItem,
  verdict,
  totalCount,
  readyCount,
  onOpenSecurityModal,
}) => {
  const dpiColor =
    verdict?.tier === 'ok'
      ? 'text-[#3fb950]'
      : verdict?.tier === 'warn'
      ? 'text-[#d29922]'
      : 'text-[#f85149]';

  return (
    <footer className="h-6 bg-[#007acc] text-white flex items-center justify-between px-2 text-[11px] font-mono select-none z-20 shadow-md">
      {/* Left side items */}
      <div className="flex items-center space-x-3 overflow-hidden">
        {/* Branch / Workspace */}
        <div className="flex items-center space-x-1 hover:bg-[#ffffff22] px-1.5 py-0.5 rounded cursor-pointer transition-colors">
          <GitBranch className="w-3 h-3" />
          <span>main*</span>
        </div>

        {/* Coverage Warnings / Issues */}
        <div className="flex items-center space-x-1 hover:bg-[#ffffff22] px-1.5 py-0.5 rounded cursor-pointer transition-colors">
          {verdict && !verdict.isFullCoverage ? (
            <div className="flex items-center space-x-1 text-[#ffe57f]">
              <AlertTriangle className="w-3 h-3" />
              <span>1 warning (unprinted edges)</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>0 errors</span>
            </div>
          )}
        </div>

        {/* Queue status */}
        <div className="hidden sm:flex items-center space-x-1 hover:bg-[#ffffff22] px-1.5 py-0.5 rounded transition-colors">
          <Layers className="w-3 h-3" />
          <span>
            Queue: {readyCount}/{totalCount} ready
          </span>
        </div>
      </div>

      {/* Right side items */}
      <div className="flex items-center space-x-3 text-[11px]">
        {/* Paper Size & Dimensions */}
        {currentItem && verdict && (
          <div className="hidden md:flex items-center space-x-1 hover:bg-[#ffffff22] px-1.5 py-0.5 rounded transition-colors">
            <span className="font-semibold">{currentItem.paperSize}</span>
            <span className="opacity-80">
              ({verdict.paperWidthMm} × {verdict.paperHeightMm} mm)
            </span>
          </div>
        )}

        {/* Live Effective DPI */}
        {verdict && (
          <div className="flex items-center space-x-1 bg-[#00000033] px-2 py-0.5 rounded font-bold">
            <span>DPI:</span>
            <span className={dpiColor}>{verdict.roundedDpi}</span>
            <span className="text-[9px] uppercase tracking-wider opacity-90">
              [{verdict.tierLabel}]
            </span>
          </div>
        )}

        {/* Zoom percentage */}
        {currentItem && (
          <div className="hidden sm:flex items-center space-x-1 hover:bg-[#ffffff22] px-1.5 py-0.5 rounded transition-colors">
            <span>Zoom: {Math.round((currentItem.transform.f / 1) * 100)}%</span>
          </div>
        )}

        {/* Standard print resolution & color space */}
        <div className="hidden lg:flex items-center space-x-2 text-[10px] opacity-85">
          <span>Target: 300 DPI</span>
          <span>•</span>
          <span>sRGB IEC61966-2.1</span>
          <span>•</span>
          <span>UTF-8</span>
        </div>

        {/* Security sandbox status button */}
        <button
          onClick={onOpenSecurityModal}
          className="flex items-center space-x-1 hover:bg-[#ffffff33] px-1.5 py-0.5 rounded cursor-pointer transition-colors"
          title="Strict Client-Side Security. Zero API Exfiltration."
        >
          <Shield className="w-3 h-3 text-[#7ee787]" />
          <span className="hidden sm:inline">Local Memory Only</span>
        </button>
      </div>
    </footer>
  );
};
