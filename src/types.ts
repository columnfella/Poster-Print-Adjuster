/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { QualityTier } from './utils/printLogic';

export interface PosterItem {
  id: string;
  name: string;
  file: File | Blob;
  width: number;
  height: number;
  thumbnailUrl: string;
  previewCanvas: HTMLCanvasElement;
  paperSize: string;
  customWidthMm?: number;
  customHeightMm?: number;
  orientation: 'portrait' | 'landscape';
  zoom: number; // multiplier of base fit
  transform: {
    f: number;  // fraction of poster width
    cx: number; // center x (0..1)
    cy: number; // center y (0..1)
  };
  isSavedToReady: boolean;
  version: number;
  fileSizeBytes: number;
  mimeType: string;
}

export interface WallEnvironmentSettings {
  wallColor: string;
  floorColor: string;
  sofaColor: string;
  accentLighting: boolean;
  showRulerGuides: boolean;
}

export type ActiveTab = 'editor' | 'verdict' | 'wall' | 'security';
