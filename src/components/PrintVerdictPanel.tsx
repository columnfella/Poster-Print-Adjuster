/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Ruler,
  Maximize2,
  Sparkles,
  Printer,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';
import { PosterItem } from '../types';
import { PrintVerdict } from '../utils/printLogic';

interface PrintVerdictPanelProps {
  item: PosterItem | null;
  verdict: PrintVerdict | null;
  onOpenInspect: () => void;
  onApplyBleed: () => void;
  theme?: 'light' | 'dark';
}

export const PrintVerdictPanel: React.FC<PrintVerdictPanelProps> = ({
  item,
  verdict,
  onOpenInspect,
  onApplyBleed,
  theme = 'light',
}) => {
  const isLight = theme === 'light';

  if (!item || !verdict) {
    return (
      <div
        className={`flex flex-col items-center justify-center h-full p-8 text-center select-none transition-colors duration-200 ${
          isLight ? 'bg-[#F8FAFC] text-[#64748B]' : 'bg-[#0D0F12] text-[#94A3B8]'
        }`}
      >
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
            isLight ? 'bg-slate-100 text-slate-400' : 'bg-[#16191E] text-slate-600'
          }`}
        >
          <Printer className="w-8 h-8" />
        </div>
        <h3
          className={`text-base font-bold mb-1 ${
            isLight ? 'text-[#0F172A]' : 'text-[#F8FAFC]'
          }`}
        >
          NO ACTIVE PRINT MANIFEST
        </h3>
        <p className="text-xs max-w-sm">
          Select an image from the queue or load a sample poster to calculate live DPI and print clarity.
        </p>
      </div>
    );
  }

  // Calculate pin position along 0 - 450 DPI scale
  const gaugePercent = Math.min(100, Math.max(0, (verdict.roundedDpi / 450) * 100));

  const tierStyles =
    verdict.tier === 'ok'
      ? isLight
        ? {
            bg: 'bg-emerald-50 border-emerald-200 text-emerald-950',
            badge: 'bg-emerald-600 text-white',
            icon: <CheckCircle2 className="w-8 h-8 text-emerald-600" />,
          }
        : {
            bg: 'bg-[#0f2d1e] border-[#2ea04366] text-[#3fb950]',
            badge: 'bg-[#10B981] text-white',
            icon: <CheckCircle2 className="w-8 h-8 text-[#3fb950]" />,
          }
      : verdict.tier === 'warn'
      ? isLight
        ? {
            bg: 'bg-amber-50 border-amber-200 text-amber-950',
            badge: 'bg-amber-600 text-white',
            icon: <AlertTriangle className="w-8 h-8 text-amber-600" />,
          }
        : {
            bg: 'bg-[#32230a] border-[#d2992266] text-[#e3b341]',
            badge: 'bg-[#F59E0B] text-white',
            icon: <AlertTriangle className="w-8 h-8 text-[#e3b341]" />,
          }
      : isLight
      ? {
          bg: 'bg-rose-50 border-rose-200 text-rose-950',
          badge: 'bg-[#EF4444] text-white',
          icon: <XCircle className="w-8 h-8 text-[#EF4444]" />,
        }
      : {
          bg: 'bg-[#3b1219] border-[#f8514966] text-[#f85149]',
          badge: 'bg-[#EF4444] text-white',
          icon: <XCircle className="w-8 h-8 text-[#f85149]" />,
        };

  return (
    <div
      className={`h-full overflow-y-auto p-3.5 sm:p-8 select-none transition-colors duration-200 ${
        isLight ? 'bg-[#F8FAFC] text-[#0F172A]' : 'bg-[#0D0F12] text-[#F8FAFC]'
      }`}
    >
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Header Summary Card */}
        <div
          className={`p-4 sm:p-6 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm ${tierStyles.bg}`}
        >
          <div className="flex items-center space-x-4">
            <div className="p-2.5 bg-black/5 dark:bg-black/30 rounded-2xl">
              {tierStyles.icon}
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="text-xl sm:text-2xl font-bold tracking-tight">
                  {verdict.tierLabel} Print Quality
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold shadow-xs ${tierStyles.badge}`}
                >
                  {verdict.roundedDpi} DPI
                </span>
              </div>
              <p className="text-xs sm:text-sm opacity-90 mt-1 max-w-xl">
                {verdict.tierDescription}
              </p>
            </div>
          </div>

          <button
            onClick={onOpenInspect}
            className={`flex items-center space-x-2 text-xs font-semibold px-4 py-2 rounded-xl border transition-all cursor-pointer whitespace-nowrap shadow-xs ${
              isLight
                ? 'bg-white hover:bg-slate-50 border-slate-300 text-[#0F172A]'
                : 'bg-[#21262D] hover:bg-[#2A313C] border-[#30363D] text-white'
            }`}
          >
            <Maximize2 className="w-4 h-4 text-[#2563EB]" />
            <span>Inspect 1:1 Pixels</span>
          </button>
        </div>

        {/* DPI Gauge Meter (0 to 450+ DPI) */}
        <div
          className={`border rounded-2xl p-6 shadow-xs transition-colors ${
            isLight ? 'bg-[#FFFFFF] border-[#E2E8F0]' : 'bg-[#16191E] border-[#262B33]'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold mb-2">
            <span className={isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'}>
              EFFECTIVE PRINT RESOLUTION GAUGE
            </span>
            <span className="text-sm font-bold text-[#2563EB] dark:text-[#38bdf8]">
              {verdict.roundedDpi} DPI (as framed)
            </span>
          </div>

          {/* Color Gradient Track */}
          <div className="relative h-4 rounded-full bg-gradient-to-r from-[#EF4444] via-[#F59E0B] to-[#10B981] shadow-inner my-3.5">
            {/* Sliding Needle / Pin */}
            <div
              className="absolute top-[-5px] w-3.5 h-6 bg-white rounded-md shadow-lg border border-slate-400 transition-all duration-300 flex items-center justify-center"
              style={{ left: `calc(${gaugePercent}% - 7px)` }}
            >
              <div className="w-[2px] h-3.5 bg-[#2563EB] rounded-full"></div>
            </div>
          </div>

          {/* Scale Labels */}
          <div
            className={`flex justify-between text-[11px] font-medium pt-1 ${
              isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'
            }`}
          >
            <span>0 DPI (Unusable)</span>
            <span>150 DPI (Good)</span>
            <span className="text-[#10B981] font-bold">300 DPI (Gallery Target)</span>
            <span>450+ DPI (Ultra-Fine)</span>
          </div>
        </div>

        {/* Technical Data Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          {/* Card 1: Resolution & Pixels */}
          <div
            className={`border rounded-2xl p-5 space-y-3.5 shadow-xs transition-colors ${
              isLight ? 'bg-[#FFFFFF] border-[#E2E8F0]' : 'bg-[#16191E] border-[#262B33]'
            }`}
          >
            <div
              className={`flex items-center space-x-2 pb-2.5 border-b font-bold text-[#2563EB] ${
                isLight ? 'border-[#E2E8F0]' : 'border-[#262B33]'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Resolution Audit</span>
            </div>

            <div
              className={`flex justify-between py-1 border-b ${
                isLight ? 'border-slate-100' : 'border-slate-800'
              }`}
            >
              <span className={isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'}>
                Source Image Resolution
              </span>
              <span className="font-semibold">
                {verdict.currentPixels.width} × {verdict.currentPixels.height} px
              </span>
            </div>

            <div
              className={`flex justify-between py-1 border-b ${
                isLight ? 'border-slate-100' : 'border-slate-800'
              }`}
            >
              <span className={isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'}>Total Megapixels</span>
              <span className="font-semibold text-[#2563EB] dark:text-[#38bdf8]">
                {((verdict.currentPixels.width * verdict.currentPixels.height) / 1000000).toFixed(2)} MP
              </span>
            </div>

            <div
              className={`flex justify-between py-1 border-b ${
                isLight ? 'border-slate-100' : 'border-slate-800'
              }`}
            >
              <span className={isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'}>
                Target 300 DPI Pixel Need
              </span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {verdict.pixelsNeededFor300Dpi.width} × {verdict.pixelsNeededFor300Dpi.height} px
              </span>
            </div>

            <div className="flex justify-between py-1">
              <span className={isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'}>Exact Mathematical DPI</span>
              <span className="font-bold text-[#10B981]">{verdict.exactDpi.toFixed(2)} DPI</span>
            </div>
          </div>

          {/* Card 2: Print Sheet Dimensions */}
          <div
            className={`border rounded-2xl p-5 space-y-3.5 shadow-xs transition-colors ${
              isLight ? 'bg-[#FFFFFF] border-[#E2E8F0]' : 'bg-[#16191E] border-[#262B33]'
            }`}
          >
            <div
              className={`flex items-center space-x-2 pb-2.5 border-b font-bold text-[#10B981] ${
                isLight ? 'border-[#E2E8F0]' : 'border-[#262B33]'
              }`}
            >
              <Ruler className="w-4 h-4 text-[#10B981]" />
              <span>Sheet Dimensions</span>
            </div>

            <div
              className={`flex justify-between py-1 border-b ${
                isLight ? 'border-slate-100' : 'border-slate-800'
              }`}
            >
              <span className={isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'}>Selected Format</span>
              <span className="font-semibold">
                {item.paperSize} ({item.orientation})
              </span>
            </div>

            <div
              className={`flex justify-between py-1 border-b ${
                isLight ? 'border-slate-100' : 'border-slate-800'
              }`}
            >
              <span className={isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'}>Metric Trim Size</span>
              <span className="font-semibold text-[#2563EB] dark:text-[#38bdf8]">
                {verdict.paperWidthMm} × {verdict.paperHeightMm} mm
              </span>
            </div>

            <div
              className={`flex justify-between py-1 border-b ${
                isLight ? 'border-slate-100' : 'border-slate-800'
              }`}
            >
              <span className={isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'}>Imperial Size</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {verdict.paperWidthInches.toFixed(2)}″ × {verdict.paperHeightInches.toFixed(2)}″
              </span>
            </div>

            <div className="flex justify-between py-1">
              <span className={isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'}>Image on Sheet Size</span>
              <span className="font-semibold text-purple-600 dark:text-purple-400">
                {verdict.imageWidthOnPosterInches.toFixed(2)}″ × {verdict.imageHeightOnPosterInches.toFixed(2)}″
              </span>
            </div>
          </div>

          {/* Card 3: Coverage & Bleed Analysis */}
          <div
            className={`border rounded-2xl p-5 space-y-3.5 shadow-xs transition-colors ${
              isLight ? 'bg-[#FFFFFF] border-[#E2E8F0]' : 'bg-[#16191E] border-[#262B33]'
            }`}
          >
            <div
              className={`flex items-center space-x-2 pb-2.5 border-b font-bold text-amber-500 ${
                isLight ? 'border-[#E2E8F0]' : 'border-[#262B33]'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>Bleed & Trim Margins</span>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className={isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'}>Bleed Status</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  verdict.isFullCoverage
                    ? 'bg-emerald-500/10 text-[#10B981]'
                    : 'bg-rose-500/10 text-[#EF4444]'
                }`}
              >
                {verdict.isFullCoverage ? 'Full Bleed Achieved' : 'White Margin Warning'}
              </span>
            </div>

            {verdict.isFullCoverage ? (
              <p
                className={`text-[11px] leading-relaxed ${
                  isLight ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                The image extends fully past the print trim bounds. No unprinted white paper borders will appear after trimming.
              </p>
            ) : (
              <div className="space-y-2.5">
                <p className="text-[11px] text-[#EF4444] font-medium leading-relaxed">
                  The image does not cover the complete paper area. White unprinted strips will be visible on the sides or edges.
                </p>
                <button
                  onClick={onApplyBleed}
                  className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white py-2 px-3 rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-sm"
                >
                  Apply "Fill Bleed" Automatically
                </button>
              </div>
            )}
          </div>

          {/* Card 4: Human Vision & Viewing Distance */}
          <div
            className={`border rounded-2xl p-5 space-y-3.5 shadow-xs transition-colors ${
              isLight ? 'bg-[#FFFFFF] border-[#E2E8F0]' : 'bg-[#16191E] border-[#262B33]'
            }`}
          >
            <div
              className={`flex items-center space-x-2 pb-2.5 border-b font-bold text-purple-600 dark:text-purple-400 ${
                isLight ? 'border-[#E2E8F0]' : 'border-[#262B33]'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>Human Vision Distance</span>
            </div>

            <div className="py-1">
              <span
                className={`block text-[11px] mb-1 ${
                  isLight ? 'text-[#64748B]' : 'text-[#94A3B8]'
                }`}
              >
                Recommended Viewing Distance:
              </span>
              <span className="text-base font-bold text-[#2563EB] dark:text-[#38bdf8]">
                {verdict.recommendedViewingDistance}
              </span>
            </div>

            <p
              className={`text-[11px] leading-relaxed ${
                isLight ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              Based on standard 20/20 human eye acuity, at distances greater than{' '}
              <span className="font-semibold text-[#10B981]">
                {(3438 / Math.max(50, verdict.roundedDpi) / 100).toFixed(1)} meters
              </span>
              , individual pixels become completely indistinguishable to the naked eye.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
