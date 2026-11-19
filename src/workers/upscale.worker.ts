/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Web Worker: edge-aware reconstruction upscaler (see utils/upscaleEngine.ts)

import { upscaleRGBA } from '../utils/upscaleEngine';

self.onmessage = (e: MessageEvent) => {
  const {
    imageBuffer,
    srcWidth,
    srcHeight,
    targetWidth,
    targetHeight,
    sharpenAmount = 1.3,
    varianceThreshold = 25,
    clampRinging = false,
    refinePasses = 3,
    edgeSmoothing = 0.7,
  } = e.data;

  try {
    const src = new Uint8ClampedArray(imageBuffer);
    let lastReported = -1;
    const result = upscaleRGBA(
      src,
      srcWidth,
      srcHeight,
      targetWidth,
      targetHeight,
      { sharpenAmount, varianceThreshold, clampRinging, refinePasses, edgeSmoothing },
      (progress, stage) => {
        if (progress === lastReported) return;
        lastReported = progress;
        self.postMessage({ type: 'PROGRESS', progress, stage });
      }
    );

    self.postMessage({ type: 'PROGRESS', progress: 100, stage: 'Finalizing pixel transfer' });

    (self as unknown as Worker).postMessage(
      {
        type: 'DONE',
        buffer: result.buffer,
        width: targetWidth,
        height: targetHeight,
      },
      [result.buffer]
    );
  } catch (err: any) {
    self.postMessage({
      type: 'ERROR',
      error:
        err instanceof RangeError
          ? 'Out of memory: try a smaller scale factor.'
          : err?.message || 'Upscaler execution error in worker thread',
    });
  }
};
