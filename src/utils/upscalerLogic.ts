/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getPaperDimensions, Orientation } from './printLogic';

/**
 * 1D Lanczos kernel function with a = 3:
 * L(x) = sinc(x) * sinc(x / 3) for -3 < x < 3
 * L(0) = 1
 * L(x) = 0 for |x| >= 3
 */
export function lanczos3(x: number): number {
  const ax = Math.abs(x);
  if (ax === 0) return 1.0;
  if (ax >= 3.0) return 0.0;

  const piX = Math.PI * ax;
  const piX3 = piX / 3.0;
  return (Math.sin(piX) / piX) * (Math.sin(piX3) / piX3);
}

/**
 * Precomputes normalized Lanczos-3 filter weights for a 1D scaling step.
 * Returns sample indices and normalized weights for each target coordinate.
 */
export interface FilterContribution {
  left: number;
  right: number;
  weights: Float32Array;
}

export function computeLanczosWeights(
  srcSize: number,
  targetSize: number
): FilterContribution[] {
  const scale = targetSize / srcSize;
  const filterRadius = 3.0; // Lanczos-3
  // When downscaling, broaden filter; when upscaling, standard radius 3
  const effectiveRadius = scale < 1.0 ? filterRadius / scale : filterRadius;
  const invFactor = scale < 1.0 ? scale : 1.0;

  const contributions: FilterContribution[] = new Array(targetSize);

  for (let i = 0; i < targetSize; i++) {
    // Continuous coordinate in source image
    const center = (i + 0.5) / scale - 0.5;
    const left = Math.max(0, Math.floor(center - effectiveRadius));
    const right = Math.min(srcSize - 1, Math.ceil(center + effectiveRadius));
    const numSamples = right - left + 1;

    const weights = new Float32Array(numSamples);
    let totalWeight = 0;

    for (let j = 0; j < numSamples; j++) {
      const srcIdx = left + j;
      const weight = lanczos3((srcIdx - center) * invFactor);
      weights[j] = weight;
      totalWeight += weight;
    }

    // Normalize weights so brightness is preserved
    if (totalWeight !== 0) {
      for (let j = 0; j < numSamples; j++) {
        weights[j] /= totalWeight;
      }
    }

    contributions[i] = { left, right, weights };
  }

  return contributions;
}

export interface UpscaleDpiTarget {
  targetWidth: number;
  targetHeight: number;
  scaleFactor: number;
  currentDpi: number;
  projectedDpi: number;
  mode: 'target300' | '2x' | '3x' | '4x';
}

/**
 * Calculates target upscale dimensions taking into account paper size,
 * current effective DPI, and target 300 DPI commercial print standard.
 */
export function calculateUpscaleTargetDimensions(
  srcWidth: number,
  srcHeight: number,
  paperSize: string,
  orientation: Orientation,
  currentFramedDpi: number,
  mode: 'target300' | '2x' | '3x' | '4x' = 'target300',
  targetDpi: number = 300
): UpscaleDpiTarget {
  const dims = getPaperDimensions(paperSize, orientation);
  const printWidthInches = dims.widthInches;
  const printHeightInches = dims.heightInches;

  let scaleFactor = 1.0;

  if (mode === 'target300') {
    // If current DPI is 150, we need scaleFactor = 300 / 150 = 2.0x
    // Clamp to minimum 1.25x and max 6.0x to avoid runaway memory
    const neededScale = currentFramedDpi > 0 ? targetDpi / currentFramedDpi : 2.0;
    scaleFactor = Math.min(6.0, Math.max(1.25, neededScale));
  } else if (mode === '2x') {
    scaleFactor = 2.0;
  } else if (mode === '3x') {
    scaleFactor = 3.0;
  } else if (mode === '4x') {
    scaleFactor = 4.0;
  }

  let targetWidth = Math.round(srcWidth * scaleFactor);
  let targetHeight = Math.round(srcHeight * scaleFactor);

  // Safety memory bound: cap at ~30 megapixels for browser worker memory stability
  const maxPixels = 32000000;
  if (targetWidth * targetHeight > maxPixels) {
    const ratio = Math.sqrt(maxPixels / (targetWidth * targetHeight));
    targetWidth = Math.round(targetWidth * ratio);
    targetHeight = Math.round(targetHeight * ratio);
    scaleFactor = targetWidth / srcWidth;
  }

  const projectedDpi = Math.round(currentFramedDpi * scaleFactor);

  return {
    targetWidth,
    targetHeight,
    scaleFactor: Number(scaleFactor.toFixed(3)),
    currentDpi: Math.round(currentFramedDpi),
    projectedDpi,
    mode,
  };
}

/**
 * 3x3 Contrast-Adaptive Sharpening for a single pixel neighborhood:
 * - Computes Gaussian blur
 * - Computes local luminance variance
 * - Flat areas (variance < threshold) get 0 sharpening to avoid boosting noise/grain
 * - Edge areas get delta * sharpenAmount
 */
export function calculateAdaptiveSharpenDelta(
  originalVal: number,
  blurredVal: number,
  localVariance: number,
  varianceThreshold: number,
  sharpenAmount: number
): number {
  if (localVariance < varianceThreshold) {
    // Flat texture / noise suppression
    return 0;
  }
  // Adaptive factor smoothly scales with contrast
  const edgeDelta = originalVal - blurredVal;
  return edgeDelta * sharpenAmount;
}

export type ArtworkPresetId =
  | 'text'
  | 'lineart'
  | 'photo'
  | 'digital-art'
  | 'vintage'
  | 'custom';

export interface ArtworkPreset {
  id: ArtworkPresetId;
  name: string;
  tagline: string;
  description: string;
  sharpenAmount: number;
  varianceThreshold: number;
  clampRinging: boolean;
}

export const ARTWORK_PRESETS: Record<ArtworkPresetId, ArtworkPreset> = {
  text: {
    id: 'text',
    name: 'Typography & Text-Heavy',
    tagline: 'Crisp Lettering • Anti-Halo',
    description: 'Sharpens small text, titles, quotes, and credits without white ringing halos.',
    sharpenAmount: 1.8,
    varianceThreshold: 15,
    clampRinging: true,
  },
  lineart: {
    id: 'lineart',
    name: 'Line Art & Vector Graphic',
    tagline: 'Sharp Outlines • Flat Fills',
    description: 'Ideal for comics, anime, vector art, and logos with clean solid color fills.',
    sharpenAmount: 1.6,
    varianceThreshold: 20,
    clampRinging: true,
  },
  photo: {
    id: 'photo',
    name: 'Photographic & Portrait',
    tagline: 'Micro-Contrast • Low Noise',
    description: 'Preserves smooth skin, portraits, and skies without amplifying camera noise.',
    sharpenAmount: 0.9,
    varianceThreshold: 35,
    clampRinging: false,
  },
  'digital-art': {
    id: 'digital-art',
    name: 'Digital Art & CGI',
    tagline: 'Rich Textures • Highlights',
    description: 'Balances digital brushwork, stylized 3D renders, and textured lighting.',
    sharpenAmount: 1.3,
    varianceThreshold: 25,
    clampRinging: false,
  },
  vintage: {
    id: 'vintage',
    name: 'Vintage & Archival Litho',
    tagline: 'Preserves Grain & Tooth',
    description: 'Gentle enhancement for watercolor washes, lithographs, and paper grain.',
    sharpenAmount: 0.7,
    varianceThreshold: 45,
    clampRinging: false,
  },
  custom: {
    id: 'custom',
    name: 'Pro Manual Tuning',
    tagline: 'Direct Slider Control',
    description: 'Manual adjustment of sharpness, noise suppression, and anti-halo filter.',
    sharpenAmount: 1.3,
    varianceThreshold: 25,
    clampRinging: false,
  },
};

export function getPresetById(id: ArtworkPresetId): ArtworkPreset {
  return ARTWORK_PRESETS[id] || ARTWORK_PRESETS.text;
}

/**
 * Blends up to 2 artwork presets together (e.g. Text + Digital Art hybrid).
 * Calculates weighted average parameters and enforces anti-ringing if required by either preset.
 */
export function blendArtworkPresets(
  presetIds: ArtworkPresetId[]
): {
  sharpenAmount: number;
  varianceThreshold: number;
  clampRinging: boolean;
  name: string;
  tagline: string;
  description: string;
  isHybrid: boolean;
} {
  const valid = presetIds.filter((id) => id !== 'custom');

  if (valid.length === 0) {
    const c = getPresetById('custom');
    return {
      sharpenAmount: c.sharpenAmount,
      varianceThreshold: c.varianceThreshold,
      clampRinging: c.clampRinging,
      name: c.name,
      tagline: c.tagline,
      description: c.description,
      isHybrid: false,
    };
  }

  if (valid.length === 1) {
    const p = getPresetById(valid[0]);
    return {
      sharpenAmount: p.sharpenAmount,
      varianceThreshold: p.varianceThreshold,
      clampRinging: p.clampRinging,
      name: p.name,
      tagline: p.tagline,
      description: p.description,
      isHybrid: false,
    };
  }

  // 2 Presets Blended (50/50 Hybrid)
  const p1 = getPresetById(valid[0]);
  const p2 = getPresetById(valid[1]);

  const avgSharpen = Number(((p1.sharpenAmount + p2.sharpenAmount) / 2).toFixed(2));
  const avgVariance = Math.round((p1.varianceThreshold + p2.varianceThreshold) / 2);
  const clampRinging = p1.clampRinging || p2.clampRinging;

  return {
    sharpenAmount: avgSharpen,
    varianceThreshold: avgVariance,
    clampRinging,
    name: `${p1.name} + ${p2.name}`,
    tagline: `Hybrid Blend (${p1.id} + ${p2.id})`,
    description: `Balanced 50/50 blend combining ${p1.name} and ${p2.name} processing characteristics.`,
    isHybrid: true,
  };
}


