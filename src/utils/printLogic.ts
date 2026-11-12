/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PaperSizeSpec {
  name: string;
  category: 'ISO' | 'US';
  widthInches: number;
  heightInches: number;
  widthMm: number;
  heightMm: number;
  commonUse: string;
}

export const PAPER_SIZES: Record<string, PaperSizeSpec> = {
  A4: {
    name: 'A4',
    category: 'ISO',
    widthInches: 8.27,
    heightInches: 11.69,
    widthMm: 210,
    heightMm: 297,
    commonUse: 'Small prints, flyers, art proofs',
  },
  A3: {
    name: 'A3',
    category: 'ISO',
    widthInches: 11.69,
    heightInches: 16.54,
    widthMm: 297,
    heightMm: 420,
    commonUse: 'Standard home/office poster, art prints',
  },
  A2: {
    name: 'A2',
    category: 'ISO',
    widthInches: 16.54,
    heightInches: 23.39,
    widthMm: 420,
    heightMm: 594,
    commonUse: 'Medium wall posters, exhibition prints',
  },
  A1: {
    name: 'A1',
    category: 'ISO',
    widthInches: 23.39,
    heightInches: 33.11,
    widthMm: 594,
    heightMm: 841,
    commonUse: 'Large commercial posters, retail displays',
  },
  A0: {
    name: 'A0',
    category: 'ISO',
    widthInches: 33.11,
    heightInches: 46.81,
    widthMm: 841,
    heightMm: 1189,
    commonUse: 'Gigantic billboards, trade show backdrops',
  },
  Letter: {
    name: 'US Letter',
    category: 'US',
    widthInches: 8.5,
    heightInches: 11.0,
    widthMm: 215.9,
    heightMm: 279.4,
    commonUse: 'North America standard document size',
  },
  Tabloid: {
    name: 'US Tabloid (11×17)',
    category: 'US',
    widthInches: 11.0,
    heightInches: 17.0,
    widthMm: 279.4,
    heightMm: 431.8,
    commonUse: 'Mini poster, concert flyer',
  },
  ArchD: {
    name: '24×36 Poster',
    category: 'US',
    widthInches: 24.0,
    heightInches: 36.0,
    widthMm: 609.6,
    heightMm: 914.4,
    commonUse: 'Classic movie poster, architectural banner',
  },
  '18x24': {
    name: '18×24 Poster',
    category: 'US',
    widthInches: 18.0,
    heightInches: 24.0,
    widthMm: 457.2,
    heightMm: 609.6,
    commonUse: 'Medium standard poster & gallery wall prints',
  },
  '12x18': {
    name: '12×18 Print',
    category: 'US',
    widthInches: 12.0,
    heightInches: 18.0,
    widthMm: 304.8,
    heightMm: 457.2,
    commonUse: 'Art prints, indie concert prints, photo displays',
  },
  '16x20': {
    name: '16×20 Fine Art',
    category: 'US',
    widthInches: 16.0,
    heightInches: 20.0,
    widthMm: 406.4,
    heightMm: 508.0,
    commonUse: 'Traditional fine art portrait & landscape format (4:5)',
  },
  '8x10': {
    name: '8×10 Photo',
    category: 'US',
    widthInches: 8.0,
    heightInches: 10.0,
    widthMm: 203.2,
    heightMm: 254.0,
    commonUse: 'Desktop frame, gallery wall portrait proof',
  },
  Square12: {
    name: '12×12 Square',
    category: 'US',
    widthInches: 12.0,
    heightInches: 12.0,
    widthMm: 304.8,
    heightMm: 304.8,
    commonUse: 'Vinyl LP record jacket, modern square artwork',
  },
  A5: {
    name: 'A5 Proof',
    category: 'ISO',
    widthInches: 5.83,
    heightInches: 8.27,
    widthMm: 148.0,
    heightMm: 210.0,
    commonUse: 'Flyers, booklets, mini postcard art proofs',
  },
};

export const STANDARD_BLEED_INCHES = 0.125; // 1/8 inch = 3.175 mm

export type Orientation = 'portrait' | 'landscape';
export type QualityTier = 'ok' | 'warn' | 'bad';

export interface PrintVerdict {
  paperWidthInches: number;
  paperHeightInches: number;
  paperWidthMm: number;
  paperHeightMm: number;
  exactDpi: number;
  roundedDpi: number;
  tier: QualityTier;
  tierLabel: string;
  tierDescription: string;
  imageWidthOnPosterInches: number;
  imageHeightOnPosterInches: number;
  isFullCoverage: boolean;
  uncoveredEdgeWarnings: string[];
  pixelsNeededFor300Dpi: { width: number; height: number };
  currentPixels: { width: number; height: number };
  recommendedViewingDistance: string;
}

/**
 * Get dimensions for paper size & orientation (supporting custom dimensions)
 */
export function getPaperDimensions(
  sizeKey: string,
  orientation: Orientation,
  customDims?: { widthMm?: number; heightMm?: number }
): {
  widthInches: number;
  heightInches: number;
  widthMm: number;
  heightMm: number;
} {
  if (sizeKey === 'Custom' && customDims?.widthMm && customDims?.heightMm) {
    const wMm = customDims.widthMm;
    const hMm = customDims.heightMm;
    const wIn = Number((wMm / 25.4).toFixed(2));
    const hIn = Number((hMm / 25.4).toFixed(2));
    if (orientation === 'portrait') {
      return {
        widthInches: Math.min(wIn, hIn),
        heightInches: Math.max(wIn, hIn),
        widthMm: Math.min(wMm, hMm),
        heightMm: Math.max(wMm, hMm),
      };
    } else {
      return {
        widthInches: Math.max(wIn, hIn),
        heightInches: Math.min(wIn, hIn),
        widthMm: Math.max(wMm, hMm),
        heightMm: Math.min(wMm, hMm),
      };
    }
  }

  const spec = PAPER_SIZES[sizeKey] || PAPER_SIZES['A3'];
  if (orientation === 'portrait') {
    return {
      widthInches: spec.widthInches,
      heightInches: spec.heightInches,
      widthMm: spec.widthMm,
      heightMm: spec.heightMm,
    };
  } else {
    return {
      widthInches: spec.heightInches,
      heightInches: spec.widthInches,
      widthMm: spec.heightMm,
      heightMm: spec.widthMm,
    };
  }
}

/**
 * Base zoom: zoom = 1 means image completely covers the canvas bounds
 */
export function calculateBaseFit(
  imgW: number,
  imgH: number,
  paperW: number,
  paperH: number
): number {
  if (imgW <= 0 || imgH <= 0 || paperW <= 0 || paperH <= 0) return 1;
  const imgRatio = imgW / imgH;
  const paperRatio = paperW / paperH;
  return Math.max(1, imgRatio / paperRatio);
}

/**
 * Calculate preset framing transform
 */
export function calculatePresetFit(
  mode: 'width' | 'height' | 'bleed' | 'contain',
  imgW: number,
  imgH: number,
  paperW: number,
  paperH: number,
  bleedInches: number = STANDARD_BLEED_INCHES
): { f: number; cx: number; cy: number } {
  const imgRatio = imgW / imgH;
  const b = bleedInches * 2;

  let f = 1;
  if (mode === 'width') {
    f = 1;
  } else if (mode === 'height') {
    f = (paperH * imgRatio) / paperW;
  } else if (mode === 'contain') {
    f = Math.min(1, (paperH * imgRatio) / paperW);
  } else {
    // Fill Bleed: covers paper plus bleed area
    const bleedWidth = (paperW + b) / paperW;
    const bleedHeight = ((paperH + b) * imgRatio) / paperW;
    f = Math.max(bleedWidth, bleedHeight);
  }

  return { f, cx: 0.5, cy: 0.5 };
}

/**
 * Calculate real-time print verdict & quality ratings
 */
export function calculatePrintVerdict(
  imgW: number,
  imgH: number,
  paperW: number,
  paperH: number,
  zoomF: number,
  cx: number = 0.5,
  cy: number = 0.5
): PrintVerdict {
  const safeZoomF = Math.max(0.01, zoomF);
  const exactDpi = imgW / (safeZoomF * paperW);
  const roundedDpi = Math.round(exactDpi);

  let tier: QualityTier = 'bad';
  let tierLabel = 'Poor';
  let tierDescription = 'Noticeable blurriness and pixelation up close. Recommended for distant viewing only.';

  if (roundedDpi >= 300) {
    tier = 'ok';
    tierLabel = 'Optimal';
    tierDescription = 'Gallery quality. Razor sharp details and ultra-crisp photographic output.';
  } else if (roundedDpi >= 150) {
    tier = 'warn';
    tierLabel = 'Acceptable';
    tierDescription = 'Commercial standard. Crisp and clear from normal poster viewing distances (0.8m+).';
  }

  const imageWidthOnPosterInches = safeZoomF * paperW;
  const imageHeightOnPosterInches = imageWidthOnPosterInches * (imgH / imgW);

  // Coverage check
  const hf = safeZoomF * (paperW / paperH) / (imgW / imgH);
  const tolerance = 0.003;

  const leftEdgeCovered = cx - safeZoomF / 2 <= tolerance;
  const rightEdgeCovered = cx + safeZoomF / 2 >= 1 - tolerance;
  const topEdgeCovered = cy - hf / 2 <= tolerance;
  const bottomEdgeCovered = cy + hf / 2 >= 1 - tolerance;

  const isFullCoverage = leftEdgeCovered && rightEdgeCovered && topEdgeCovered && bottomEdgeCovered;

  const warnings: string[] = [];
  if (!leftEdgeCovered || !rightEdgeCovered) {
    warnings.push('Unprinted white margins on horizontal sides.');
  }
  if (!topEdgeCovered || !bottomEdgeCovered) {
    warnings.push('Unprinted white margins on top/bottom.');
  }

  // Recommended viewing distance: minimum distance where human eye cannot distinguish individual pixels
  // Formula: Distance (cm) ≈ 2500 / DPI (or 3438 / DPI for 20/20 vision arcminute)
  let recommendedViewingDistance = 'Arm’s length (30–45 cm)';
  if (roundedDpi >= 300) {
    recommendedViewingDistance = 'Any distance (even close inspection < 30 cm)';
  } else if (roundedDpi >= 200) {
    recommendedViewingDistance = 'Standard viewing distance (0.5 – 0.8 m)';
  } else if (roundedDpi >= 150) {
    recommendedViewingDistance = 'Wall viewing distance (0.8 – 1.2 m)';
  } else if (roundedDpi >= 100) {
    recommendedViewingDistance = 'Room viewing distance (1.5 – 2.5 m)';
  } else {
    recommendedViewingDistance = 'Distant viewing only (> 3.0 m)';
  }

  return {
    paperWidthInches: paperW,
    paperHeightInches: paperH,
    paperWidthMm: Math.round(paperW * 25.4),
    paperHeightMm: Math.round(paperH * 25.4),
    exactDpi,
    roundedDpi,
    tier,
    tierLabel,
    tierDescription,
    imageWidthOnPosterInches,
    imageHeightOnPosterInches,
    isFullCoverage,
    uncoveredEdgeWarnings: warnings,
    pixelsNeededFor300Dpi: {
      width: Math.round(imageWidthOnPosterInches * 300),
      height: Math.round(imageHeightOnPosterInches * 300),
    },
    currentPixels: {
      width: imgW,
      height: imgH,
    },
    recommendedViewingDistance,
  };
}

/**
 * Security: Validates magic byte header from raw file buffer
 * Protects against polyglot attacks, renamed executable binaries, or malicious script-bearing SVG uploads.
 */
export function validateImageFileHeader(buffer: ArrayBuffer): {
  valid: boolean;
  mime?: string;
  error?: string;
} {
  if (!buffer || buffer.byteLength < 12) {
    return { valid: false, error: 'File is empty or too small to be a valid image.' };
  }

  const bytes = new Uint8Array(buffer);

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { valid: true, mime: 'image/png' };
  }

  // JPEG / JPG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { valid: true, mime: 'image/jpeg' };
  }

  // WebP: RIFF .... WEBP
  // 52 49 46 46 (RIFF) at offset 0, and 57 45 42 50 (WEBP) at offset 8
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { valid: true, mime: 'image/webp' };
  }

  return {
    valid: false,
    error: 'Unrecognized or untrusted file format. Only verified PNG, JPEG, and WebP images are permitted.',
  };
}

/**
 * Security: Sanitize file names to prevent path traversal, null bytes,
 * command injection, and Windows reserved device names.
 */
export function sanitizeFileName(name: string, fallback: string = 'poster'): string {
  if (!name || typeof name !== 'string') return fallback;

  // Strip path traversal sequences like ../ or ..\
  let clean = name.replace(/(\.\.[\/\\])+/g, '');

  // Strip null bytes and control chars
  clean = clean.replace(/[\x00-\x1f\x7f]/g, '');

  // Strip unsafe characters for filesystems
  clean = clean.replace(/[<>:"/\\|?*#%&{}]/g, '_');

  // Collapse consecutive underscores and trim leading/trailing underscores and dots
  clean = clean.replace(/_+/g, '_').trim().replace(/^[._]+/, '').replace(/[._]+$/, '');

  // Prevent Windows reserved filenames
  const baseOnly = clean.replace(/\.[^.]+$/, '').toUpperCase();
  const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
  if (reserved.includes(baseOnly)) {
    clean = `file_${clean}`;
  }

  return clean.length > 0 ? clean.substring(0, 100) : fallback;
}

/**
 * Embeds JFIF 300 DPI density markers into a JPEG Uint8Array buffer
 * Standard JPEG files default to 72 or 96 DPI in their EXIF/JFIF header;
 * injecting 0x012C (300) tells printers and OS previewers the intended print density.
 */
export function injectJfifDpiHeader(jpegBytes: Uint8Array, targetDpi: number = 300): Uint8Array {
  // Look for SOI (FF D8) followed by APP0 (FF E0)
  if (
    jpegBytes.length > 18 &&
    jpegBytes[0] === 0xff &&
    jpegBytes[1] === 0xd8 &&
    jpegBytes[2] === 0xff &&
    jpegBytes[3] === 0xe0 &&
    jpegBytes[6] === 0x4a && // 'J'
    jpegBytes[7] === 0x46 && // 'F'
    jpegBytes[8] === 0x49 && // 'I'
    jpegBytes[9] === 0x46 && // 'F'
    jpegBytes[10] === 0x00
  ) {
    const copy = new Uint8Array(jpegBytes);
    copy[13] = 1; // Units: 1 = dots per inch (DPI)
    copy[14] = (targetDpi >> 8) & 0xff; // Xdensity high byte (e.g. 1 for 300)
    copy[15] = targetDpi & 0xff;        // Xdensity low byte (e.g. 44 for 300 -> 0x012C)
    copy[16] = (targetDpi >> 8) & 0xff; // Ydensity high byte
    copy[17] = targetDpi & 0xff;        // Ydensity low byte
    return copy;
  }
  return jpegBytes;
}

/**
 * Safe Remote URL validation for image imports
 * Disallows javascript:, data: (scripts), file:, and private IP ranges.
 */
export function validateRemoteImageUrl(rawUrl: string): {
  valid: boolean;
  cleanUrl?: string;
  error?: string;
} {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { valid: false, error: 'Only secure HTTP/HTTPS URLs are allowed.' };
    }

    const host = parsed.hostname.toLowerCase();
    // Block localhost and internal IP ranges
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
      /^169\.254\./.test(host)
    ) {
      return { valid: false, error: 'Access to internal or loopback network addresses is prohibited.' };
    }

    return { valid: true, cleanUrl: parsed.toString() };
  } catch {
    return { valid: false, error: 'Invalid URL format.' };
  }
}
