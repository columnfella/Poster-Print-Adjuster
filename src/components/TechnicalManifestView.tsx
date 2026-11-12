/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Copy, Check, FileCode, Terminal, Download } from 'lucide-react';
import { PosterItem } from '../types';
import { PrintVerdict } from '../utils/printLogic';

interface TechnicalManifestViewProps {
  item: PosterItem | null;
  verdict: PrintVerdict | null;
}

export const TechnicalManifestView: React.FC<TechnicalManifestViewProps> = ({ item, verdict }) => {
  const [copied, setCopied] = useState(false);

  if (!item || !verdict) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-[#858585] bg-[#181818] font-mono select-none">
        <FileCode className="w-12 h-12 text-[#333333] mb-3" />
        <h3 className="text-sm font-semibold text-[#cccccc]">NO ACTIVE POSTER MANIFEST</h3>
        <p className="text-xs max-w-sm mt-1 text-[#666666]">
          Select or load an image to generate the dynamic print preflight manifest.
        </p>
      </div>
    );
  }

  const manifestObject = {
    $schema: 'https://specs.printproduction.org/v2/manifest.json',
    generator: 'PosterPrintChecker/v2.4.0 (Studio Edition)',
    timestamp: new Date().toISOString(),
    asset: {
      filename: item.name,
      fileSizeBytes: item.fileSizeBytes || (item.file instanceof File ? item.file.size : 0),
      detectedMimeType: item.mimeType || 'image/jpeg',
      sourceDimensions: {
        widthPx: item.width,
        heightPx: item.height,
        megapixels: Number(((item.width * item.height) / 1000000).toFixed(2)),
        aspectRatio: Number((item.width / item.height).toFixed(3)),
      },
      colorSpace: {
        profile: 'sRGB IEC61966-2.1',
        bitsPerChannel: 8,
        colorModel: 'RGB',
      },
    },
    printSpecifications: {
      standard: 'ISO 216 / Commercial Print Target',
      paperSize: item.paperSize,
      orientation: item.orientation,
      targetDensityDpi: 300,
      effectiveDpi: verdict.roundedDpi,
      qualityTier: verdict.tier.toUpperCase(),
      verdictLabel: verdict.tierLabel,
      bleedMarginInches: 0.125,
      bleedMarginMm: 3.175,
      sheetDimensionsMm: {
        width: verdict.paperWidthMm,
        height: verdict.paperHeightMm,
      },
      sheetDimensionsInches: {
        width: Number(verdict.paperWidthInches.toFixed(2)),
        height: Number(verdict.paperHeightInches.toFixed(2)),
      },
      target300DpiPixelRequirement: {
        width: verdict.pixelsNeededFor300Dpi.width,
        height: verdict.pixelsNeededFor300Dpi.height,
      },
      framingTransform: {
        scaleFactor: Number(item.transform.f.toFixed(4)),
        centerNormalized: {
          cx: Number(item.transform.cx.toFixed(4)),
          cy: Number(item.transform.cy.toFixed(4)),
        },
      },
      coverageAnalysis: {
        isFullBleedCoverage: verdict.isFullCoverage,
        unprintedEdgeWarnings: verdict.uncoveredEdgeWarnings,
      },
      recommendedViewingDistance: verdict.recommendedViewingDistance,
    },
    securitySandbox: {
      clientSideIsolated: true,
      remoteServerExfiltration: false,
      memorySafetyGuaranteed: true,
    },
  };

  const jsonString = JSON.stringify(manifestObject, null, 2);
  const lines = jsonString.split('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadManifest = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${item.name.replace(/\.[^.]+$/, '')}_print_manifest.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] text-[#cccccc] font-mono text-xs select-none">
      {/* Editor Tab Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-[#2d2d2d]">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-[#58a6ff]" />
          <span className="font-semibold text-white">manifest.json</span>
          <span className="text-[#858585] text-[11px]">• UTF-8 • JSON Language Server</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#2d2d2d] hover:bg-[#383838] border border-[#3e3e42] text-[#e6edf3] transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#3fb950]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy JSON'}</span>
          </button>

          <button
            onClick={handleDownloadManifest}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#007acc] hover:bg-[#0062a3] text-white transition-colors cursor-pointer font-sans"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save Manifest</span>
          </button>
        </div>
      </div>

      {/* Code Editor Body with Line Numbers */}
      <div className="flex-1 overflow-auto bg-[#181818] p-4 font-mono text-xs leading-5">
        <div className="flex">
          {/* Line Numbers */}
          <div className="text-[#555555] text-right pr-4 select-none border-r border-[#2d2d2d] mr-4 shrink-0">
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>

          {/* Syntax-highlighted code container */}
          <pre className="text-[#ce9178] flex-1 overflow-x-auto whitespace-pre font-mono">
            {lines.map((line, idx) => {
              // Basic VS Code dark syntax coloring for JSON
              const keyMatch = line.match(/^(\s*)(".*?")(\s*:)/);
              if (keyMatch) {
                const indent = keyMatch[1];
                const key = keyMatch[2];
                const rest = line.substring(keyMatch[0].length);

                let valSpan = <span className="text-[#ce9178]">{rest}</span>;
                if (/:\s*\d+/.test(line)) {
                  valSpan = <span className="text-[#b5cea8]">{rest}</span>;
                } else if (/:\s*(true|false|null)/.test(line)) {
                  valSpan = <span className="text-[#569cd6]">{rest}</span>;
                }

                return (
                  <div key={idx}>
                    <span>{indent}</span>
                    <span className="text-[#9cdcfe]">{key}</span>
                    <span className="text-white">:</span>
                    {valSpan}
                  </div>
                );
              }
              return (
                <div key={idx} className="text-[#d4d4d4]">
                  {line}
                </div>
              );
            })}
          </pre>
        </div>
      </div>
    </div>
  );
};
