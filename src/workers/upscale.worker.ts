/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Web Worker for 2D Separable Lanczos-3 Resampling & Contrast-Adaptive Sharpening

function lanczos3(x: number): number {
  const ax = Math.abs(x);
  if (ax === 0) return 1.0;
  if (ax >= 3.0) return 0.0;
  const piX = Math.PI * ax;
  const piX3 = piX / 3.0;
  return (Math.sin(piX) / piX) * (Math.sin(piX3) / piX3);
}

interface FilterContribution {
  left: number;
  right: number;
  weights: Float32Array;
}

function computeWeights(srcSize: number, targetSize: number): FilterContribution[] {
  const scale = targetSize / srcSize;
  const filterRadius = 3.0;
  const effectiveRadius = scale < 1.0 ? filterRadius / scale : filterRadius;
  const invFactor = scale < 1.0 ? scale : 1.0;

  const contributions: FilterContribution[] = new Array(targetSize);

  for (let i = 0; i < targetSize; i++) {
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

    if (totalWeight !== 0) {
      for (let j = 0; j < numSamples; j++) {
        weights[j] /= totalWeight;
      }
    }

    contributions[i] = { left, right, weights };
  }

  return contributions;
}

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
  } = e.data;

  try {
    const src = new Uint8ClampedArray(imageBuffer);

    // -------------------------------------------------------------
    // PASS A: Horizontal Resampling (srcWidth x srcHeight -> targetWidth x srcHeight)
    // -------------------------------------------------------------
    self.postMessage({ type: 'PROGRESS', progress: 5, stage: 'Pass 1/3: Lanczos-3 Horizontal Resampling' });

    const hContribs = computeWeights(srcWidth, targetWidth);
    const intermediate = new Uint8ClampedArray(targetWidth * srcHeight * 4);

    const reportStepH = Math.max(1, Math.floor(srcHeight / 10));

    for (let y = 0; y < srcHeight; y++) {
      const srcRowOffset = y * srcWidth * 4;
      const dstRowOffset = y * targetWidth * 4;

      for (let x = 0; x < targetWidth; x++) {
        const { left, weights } = hContribs[x];
        const numWeights = weights.length;

        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;

        let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;

        for (let j = 0; j < numWeights; j++) {
          const srcX = left + j;
          const srcOffset = srcRowOffset + srcX * 4;
          const w = weights[j];
          const pr = src[srcOffset];
          const pg = src[srcOffset + 1];
          const pb = src[srcOffset + 2];

          if (clampRinging) {
            if (pr < minR) minR = pr;
            if (pr > maxR) maxR = pr;
            if (pg < minG) minG = pg;
            if (pg > maxG) maxG = pg;
            if (pb < minB) minB = pb;
            if (pb > maxB) maxB = pb;
          }

          r += pr * w;
          g += pg * w;
          b += pb * w;
          a += src[srcOffset + 3] * w;
        }

        if (clampRinging) {
          r = Math.max(minR, Math.min(maxR, r));
          g = Math.max(minG, Math.min(maxG, g));
          b = Math.max(minB, Math.min(maxB, b));
        }

        const dstOffset = dstRowOffset + x * 4;
        intermediate[dstOffset] = r < 0 ? 0 : r > 255 ? 255 : r;
        intermediate[dstOffset + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
        intermediate[dstOffset + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
        intermediate[dstOffset + 3] = a < 0 ? 0 : a > 255 ? 255 : a;
      }

      if (y % reportStepH === 0) {
        const prog = Math.round(5 + (y / srcHeight) * 40);
        self.postMessage({ type: 'PROGRESS', progress: prog, stage: 'Pass 1/3: Lanczos-3 Horizontal Resampling' });
      }
    }

    // -------------------------------------------------------------
    // PASS B: Vertical Resampling (targetWidth x srcHeight -> targetWidth x targetHeight)
    // -------------------------------------------------------------
    self.postMessage({ type: 'PROGRESS', progress: 48, stage: 'Pass 2/3: Lanczos-3 Vertical Resampling' });

    const vContribs = computeWeights(srcHeight, targetHeight);
    const resampled = new Uint8ClampedArray(targetWidth * targetHeight * 4);

    const reportStepV = Math.max(1, Math.floor(targetHeight / 10));

    for (let y = 0; y < targetHeight; y++) {
      const { left, weights } = vContribs[y];
      const numWeights = weights.length;
      const dstRowOffset = y * targetWidth * 4;

      for (let x = 0; x < targetWidth; x++) {
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;

        let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;

        for (let j = 0; j < numWeights; j++) {
          const srcY = left + j;
          const srcOffset = (srcY * targetWidth + x) * 4;
          const w = weights[j];
          const pr = intermediate[srcOffset];
          const pg = intermediate[srcOffset + 1];
          const pb = intermediate[srcOffset + 2];

          if (clampRinging) {
            if (pr < minR) minR = pr;
            if (pr > maxR) maxR = pr;
            if (pg < minG) minG = pg;
            if (pg > maxG) maxG = pg;
            if (pb < minB) minB = pb;
            if (pb > maxB) maxB = pb;
          }

          r += pr * w;
          g += pg * w;
          b += pb * w;
          a += intermediate[srcOffset + 3] * w;
        }

        if (clampRinging) {
          r = Math.max(minR, Math.min(maxR, r));
          g = Math.max(minG, Math.min(maxG, g));
          b = Math.max(minB, Math.min(maxB, b));
        }

        const dstOffset = dstRowOffset + x * 4;
        resampled[dstOffset] = r < 0 ? 0 : r > 255 ? 255 : r;
        resampled[dstOffset + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
        resampled[dstOffset + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
        resampled[dstOffset + 3] = a < 0 ? 0 : a > 255 ? 255 : a;
      }

      if (y % reportStepV === 0) {
        const prog = Math.round(48 + (y / targetHeight) * 37);
        self.postMessage({ type: 'PROGRESS', progress: prog, stage: 'Pass 2/3: Lanczos-3 Vertical Resampling' });
      }
    }


    // -------------------------------------------------------------
    // PASS C: Contrast-Adaptive Unsharp Mask (Edge Sharpening)
    // -------------------------------------------------------------
    self.postMessage({ type: 'PROGRESS', progress: 87, stage: 'Pass 3/3: Contrast-Adaptive Edge Sharpening' });

    const finalBuffer = new Uint8ClampedArray(targetWidth * targetHeight * 4);

    // 3x3 Gaussian convolution kernel weights: [1, 2, 1; 2, 4, 2; 1, 2, 1] / 16
    const reportStepS = Math.max(1, Math.floor(targetHeight / 10));

    for (let y = 0; y < targetHeight; y++) {
      const yPrev = Math.max(0, y - 1);
      const yNext = Math.min(targetHeight - 1, y + 1);

      const rowPrev = yPrev * targetWidth * 4;
      const rowCurr = y * targetWidth * 4;
      const rowNext = yNext * targetWidth * 4;

      for (let x = 0; x < targetWidth; x++) {
        const xPrev = Math.max(0, x - 1);
        const xNext = Math.min(targetWidth - 1, x + 1);

        const currIdx = rowCurr + x * 4;

        // Sample 3x3 neighborhood luminance for variance test
        // Luminance Y = 0.299R + 0.587G + 0.114B
        let lumSum = 0;
        let lumSqSum = 0;

        // Gaussian blur accumulators
        let blurR = 0;
        let blurG = 0;
        let blurB = 0;

        const rowOffsets = [rowPrev, rowCurr, rowNext];
        const colIndices = [xPrev, x, xNext];
        const kernelWeights = [
          [1 / 16, 2 / 16, 1 / 16],
          [2 / 16, 4 / 16, 2 / 16],
          [1 / 16, 2 / 16, 1 / 16],
        ];

        for (let ky = 0; ky < 3; ky++) {
          const rOff = rowOffsets[ky];
          for (let kx = 0; kx < 3; kx++) {
            const idx = rOff + colIndices[kx] * 4;
            const kw = kernelWeights[ky][kx];

            const pr = resampled[idx];
            const pg = resampled[idx + 1];
            const pb = resampled[idx + 2];

            blurR += pr * kw;
            blurG += pg * kw;
            blurB += pb * kw;

            const lum = 0.299 * pr + 0.587 * pg + 0.114 * pb;
            lumSum += lum;
            lumSqSum += lum * lum;
          }
        }

        // Local variance = E[X^2] - (E[X])^2
        const lumMean = lumSum / 9;
        const localVariance = Math.max(0, lumSqSum / 9 - lumMean * lumMean);

        const origR = resampled[currIdx];
        const origG = resampled[currIdx + 1];
        const origB = resampled[currIdx + 2];
        const origA = resampled[currIdx + 3];

        if (localVariance >= varianceThreshold && sharpenAmount > 0) {
          // Edge detected: apply adaptive sharpening
          const deltaR = (origR - blurR) * sharpenAmount;
          const deltaG = (origG - blurG) * sharpenAmount;
          const deltaB = (origB - blurB) * sharpenAmount;

          const sharpR = origR + deltaR;
          const sharpG = origG + deltaG;
          const sharpB = origB + deltaB;

          finalBuffer[currIdx] = sharpR < 0 ? 0 : sharpR > 255 ? 255 : sharpR;
          finalBuffer[currIdx + 1] = sharpG < 0 ? 0 : sharpG > 255 ? 255 : sharpG;
          finalBuffer[currIdx + 2] = sharpB < 0 ? 0 : sharpB > 255 ? 255 : sharpB;
        } else {
          // Flat / subtle texture: retain Lanczos smoothness without boosting noise
          finalBuffer[currIdx] = origR;
          finalBuffer[currIdx + 1] = origG;
          finalBuffer[currIdx + 2] = origB;
        }

        finalBuffer[currIdx + 3] = origA;
      }

      if (y % reportStepS === 0) {
        const prog = Math.round(87 + (y / targetHeight) * 12);
        self.postMessage({ type: 'PROGRESS', progress: prog, stage: 'Pass 3/3: Contrast-Adaptive Edge Sharpening' });
      }
    }

    self.postMessage({ type: 'PROGRESS', progress: 100, stage: 'Finalizing Pixel Transfer' });

    // Transferable memory buffer to main thread (zero-copy)
    (self as unknown as Worker).postMessage(
      {
        type: 'DONE',
        buffer: finalBuffer.buffer,
        width: targetWidth,
        height: targetHeight,
      },
      [finalBuffer.buffer]
    );
  } catch (err: any) {
    self.postMessage({
      type: 'ERROR',
      error: err?.message || 'Upscaler execution error in worker thread',
    });
  }
};
