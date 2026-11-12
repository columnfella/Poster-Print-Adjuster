/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sparkles, X, PlusCircle, Check } from 'lucide-react';
import { useModalTransition } from '../hooks/useModalTransition';

interface SamplePostersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadSample: (type: 'bauhaus' | 'cyberpunk' | 'minimalist' | 'wave') => void;
  onLoadAllSamples: () => void;
}

export const SamplePostersModal: React.FC<SamplePostersModalProps> = ({
  isOpen,
  onClose,
  onLoadSample,
  onLoadAllSamples,
}) => {
  const { isRendered, isVisible } = useModalTransition(isOpen, 280);
  if (!isRendered) return null;

  const samples = [
    {
      id: 'bauhaus' as const,
      title: 'Bauhaus 1923 Exhibition',
      category: 'Geometric Constructivism',
      res: '3600 × 5400 px',
      dpiTarget: 'A3 @ 300 DPI',
      description: 'Classic Weimar geometry with vermilion circle, cobalt band, and ochre triangle.',
      accent: 'from-[#d9381e] to-[#1e3888]',
    },
    {
      id: 'cyberpunk' as const,
      title: 'Neo Tokyo 2099',
      category: 'Synthwave / Sci-Fi',
      res: '4200 × 5940 px',
      dpiTarget: 'A2 @ 300 DPI',
      description: 'Ultraviolet horizon, glowing vector grid lines, and high-contrast typography.',
      accent: 'from-[#ff007f] to-[#00f0ff]',
    },
    {
      id: 'minimalist' as const,
      title: 'Kopenhagen Modern',
      category: 'Scandinavian Organic',
      res: '2480 × 3508 px',
      dpiTarget: 'A4 @ 300 DPI',
      description: 'Warm terracotta disc above deep forest sage architectural arch on limestone ivory.',
      accent: 'from-[#c86d51] to-[#4a5b52]',
    },
    {
      id: 'wave' as const,
      title: 'Kanagawa Woodblock Wave',
      category: 'Traditional Ukiyo-e',
      res: '3500 × 4950 px',
      dpiTarget: 'A3 @ 300 DPI',
      description: 'Prussian indigo cresting wave against pale parchment and kanji calligraphy.',
      accent: 'from-[#1c4966] to-[#ffffff]',
    },
  ];

  return (
    <div
      onClick={onClose}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 select-none font-sans transition-opacity duration-300 ease-out ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-[#16191E] border border-[#262B33] rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden text-white transition-all duration-300 ease-out transform ${
          isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-3'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#1C2027] border-b border-[#262B33]">
          <div className="flex items-center space-x-2.5">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-base">Load Sample Archival Artwork</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-[#262B33] text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
          <div className="flex items-center justify-between text-xs text-[#94A3B8]">
            <span>Instant high-resolution vectors rendered directly in client memory</span>
            <button
              onClick={() => {
                onLoadAllSamples();
                onClose();
              }}
              className="text-[#2563EB] hover:text-blue-400 font-semibold cursor-pointer underline"
            >
              Load All 4 Posters (+Batch)
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {samples.map((s) => (
              <div
                key={s.id}
                className="bg-[#111317] border border-[#262B33] hover:border-[#2563EB] rounded-xl p-4 flex flex-col justify-between transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8]">
                      {s.category}
                    </span>
                    <span className="text-[10px] text-[#10B981] font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      {s.dpiTarget}
                    </span>
                  </div>

                  <div className={`h-2 rounded-full bg-gradient-to-r ${s.accent} mb-3 opacity-90`} />

                  <h4 className="font-bold text-white text-sm group-hover:text-[#38bdf8] transition-colors">
                    {s.title}
                  </h4>
                  <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                    {s.description}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-2 font-medium">
                    Source: {s.res}
                  </p>
                </div>

                <button
                  onClick={() => {
                    onLoadSample(s.id);
                    onClose();
                  }}
                  className="mt-4 w-full bg-[#21262D] hover:bg-[#2563EB] text-[#F8FAFC] hover:text-white py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer border border-[#30363D] hover:border-transparent shadow-xs"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Load Into Queue</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#1C2027] border-t border-[#262B33] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-slate-700 hover:bg-slate-600 text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
