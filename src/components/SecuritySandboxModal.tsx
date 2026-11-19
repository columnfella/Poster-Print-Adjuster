/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  FileCheck2,
  AlertOctagon,
  HardDrive,
  Globe,
  CheckCircle,
  X,
  ExternalLink,
} from 'lucide-react';
import { validateRemoteImageUrl } from '../utils/printLogic';

interface SecuritySandboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportVerifiedUrl: (url: string) => void;
}

export const SecuritySandboxModal: React.FC<SecuritySandboxModalProps> = ({
  isOpen,
  onClose,
  onImportVerifiedUrl,
}) => {
  const [testUrl, setTestUrl] = useState('');
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleTestUrl = () => {
    if (!testUrl.trim()) return;
    const res = validateRemoteImageUrl(testUrl);
    if (res.valid && res.cleanUrl) {
      setTestResult({
        valid: true,
        message: 'URL passed security audit: Protocol is HTTPS, host is public and non-internal, no script injection detected.',
      });
    } else {
      setTestResult({
        valid: false,
        message: res.error || 'URL rejected by security sandbox filter.',
      });
    }
  };

  const handleImportVerified = () => {
    if (testResult?.valid && testUrl.trim()) {
      onImportVerifiedUrl(testUrl.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 select-none font-sans">
      <div className="bg-[#1e1e1e] border border-[#333333] rounded-xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden text-[#cccccc]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#252526] border-b border-[#333333]">
          <div className="flex items-center space-x-2.5">
            <ShieldCheck className="w-5 h-5 text-[#3fb950]" />
            <h3 className="font-mono font-bold text-white text-sm">SECURITY & INTEGRITY ARCHITECTURE</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#333333] text-[#858585] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto max-h-[75vh] text-xs">
          {/* Status Banner */}
          <div className="bg-[#0f2d1e] border border-[#2ea04366] rounded-lg p-3.5 flex items-start space-x-3 text-[#3fb950]">
            <Lock className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-bold text-sm text-white font-mono">100% Client-Side Air-Gapped Execution</h4>
              <p className="mt-1 text-[#7ee787] text-xs leading-relaxed">
                All image processing, high-resolution 300 DPI canvas rendering, EXIF/JFIF density header synthesis, and ZIP archives are generated strictly inside your browser memory. No files or pixels are ever transmitted to any remote server or third-party service.
              </p>
            </div>
          </div>

          {/* Hardened Safeguards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
            <div className="bg-[#181818] border border-[#2d2d2d] rounded-lg p-3 space-y-1.5">
              <div className="flex items-center space-x-2 text-[#58a6ff]">
                <FileCheck2 className="w-4 h-4" />
                <span className="font-bold">Magic Bytes Inspection</span>
              </div>
              <p className="text-[#858585] text-[11px] font-sans">
                Validates binary file headers (PNG <code className="text-[#79c0ff]">89 50 4E 47</code>, JPEG <code className="text-[#79c0ff]">FF D8 FF</code>, WebP <code className="text-[#79c0ff]">RIFF/WEBP</code>). Blocks disguised scripts or renamed executables.
              </p>
            </div>

            <div className="bg-[#181818] border border-[#2d2d2d] rounded-lg p-3 space-y-1.5">
              <div className="flex items-center space-x-2 text-[#d2a8ff]">
                <AlertOctagon className="w-4 h-4" />
                <span className="font-bold">Filename Sanitization</span>
              </div>
              <p className="text-[#858585] text-[11px] font-sans">
                Removes path traversal sequences (<code className="text-[#d2a8ff]">../</code>), null bytes, Windows reserved device names, and illegal characters to protect local filesystems upon download.
              </p>
            </div>

            <div className="bg-[#181818] border border-[#2d2d2d] rounded-lg p-3 space-y-1.5">
              <div className="flex items-center space-x-2 text-[#e3b341]">
                <HardDrive className="w-4 h-4" />
                <span className="font-bold">Memory Leak Protection</span>
              </div>
              <p className="text-[#858585] text-[11px] font-sans">
                Explicitly closes <code className="text-[#e3b341]">ImageBitmap</code> instances, bounds canvas allocations to avoid tab crashes, and revokes Blob URLs after downloads.
              </p>
            </div>

            <div className="bg-[#181818] border border-[#2d2d2d] rounded-lg p-3 space-y-1.5">
              <div className="flex items-center space-x-2 text-[#3fb950]">
                <Globe className="w-4 h-4" />
                <span className="font-bold">Bundled Offline Libraries</span>
              </div>
              <p className="text-[#858585] text-[11px] font-sans">
                Eliminates unpinned third-party CDN scripts. JSZip is securely bundled in the application build, preventing supply chain script tampering.
              </p>
            </div>
          </div>

          {/* Safe URL Import & SSRF Inspector Tool */}
          <div className="bg-[#181818] border border-[#2d2d2d] rounded-lg p-4 space-y-3">
            <div className="flex items-center space-x-2 text-white font-mono font-semibold">
              <Globe className="w-4 h-4 text-[#58a6ff]" />
              <span>Safe Remote URL Import Validator</span>
            </div>
            <p className="text-[11px] text-[#858585]">
              Verify and safely load an image from an external URL. Filters out private loopback IP ranges, unsafe schemes (<code className="text-[#f85149]">javascript:</code>, <code className="text-[#f85149]">file:</code>), and malicious parameters.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="https://example.com/poster-artwork.jpg"
                value={testUrl}
                onChange={(e) => {
                  setTestUrl(e.target.value);
                  setTestResult(null);
                }}
                className="flex-1 bg-[#121316] border border-[#3e3e42] rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#007acc]"
              />
              <button
                onClick={handleTestUrl}
                className="bg-[#2d2d2d] hover:bg-[#383838] border border-[#3e3e42] text-white px-3 py-1.5 rounded text-xs font-mono transition-colors cursor-pointer"
              >
                Audit URL
              </button>
            </div>

            {testResult && (
              <div
                className={`p-2.5 rounded text-xs font-mono flex items-start space-x-2 ${
                  testResult.valid
                    ? 'bg-[#0f2d1e] text-[#3fb950] border border-[#2ea04344]'
                    : 'bg-[#3b1219] text-[#f85149] border border-[#f8514944]'
                }`}
              >
                {testResult.valid ? (
                  <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                ) : (
                  <AlertOctagon className="w-4 h-4 mt-0.5 shrink-0" />
                )}
                <div className="flex-1">
                  <span>{testResult.message}</span>
                  {testResult.valid && (
                    <div className="mt-2">
                      <button
                        onClick={handleImportVerified}
                        className="bg-[#238636] hover:bg-[#2ea043] text-white px-3 py-1 rounded text-[11px] font-sans font-medium transition-colors cursor-pointer"
                      >
                        Import Into Studio
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#252526] border-t border-[#333333] flex justify-end">
          <button
            onClick={onClose}
            className="bg-[#007acc] hover:bg-[#0062a3] text-white px-4 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
};
