/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** AI super-resolution models (shared by the browser UI and the server proxy). */

export type AiModelId = 'general' | 'photo' | 'illustration';

export interface AiModelOption {
  id: AiModelId;
  name: string;
  description: string;
  /** model name on the Phips/Upscaler Hugging Face Space */
  phipsModel: string;
}

export const AI_MODELS: AiModelOption[] = [
  {
    id: 'general',
    name: 'General / Posters',
    description: 'DAT2 trained on real-world degraded images. Best all-rounder for web-sourced art.',
    phipsModel: '4xBHI_dat2_real',
  },
  {
    id: 'photo',
    name: 'Photographic',
    description: 'Tuned for compressed web photos: restores texture, removes JPEG blocking.',
    phipsModel: '4xRealWebPhoto_v4_dat2',
  },
  {
    id: 'illustration',
    name: 'Illustration & Anime',
    description: 'Clean lines and flat fills for drawn art, comics and anime.',
    phipsModel: '4xHFA2k',
  },
];

export function getAiModel(id: string | null | undefined): AiModelOption {
  return AI_MODELS.find((m) => m.id === id) ?? AI_MODELS[0];
}
