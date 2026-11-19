/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { planBands, stitchBand, type UpscaleParams } from '../utils/upscaleEngine';

export interface UpscaleProgress {
  isProcessing: boolean;
  progress: number;
  stage: string;
  error: string | null;
}

export interface UpscaleResult {
  upscaledBlob: Blob;
  previewCanvas: HTMLCanvasElement;
  width: number;
  height: number;
}

/** Worker threads to use: one per logical core, capped to keep memory sane. */
function getThreadCount(): number {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  return Math.max(1, Math.min(8, cores));
}

export function useUpscaler() {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [stage, setStage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const workersRef = useRef<Worker[]>([]);
  const abortJobRef = useRef<((reason: Error) => void) | null>(null);

  const terminateAll = useCallback(() => {
    for (const w of workersRef.current) w.terminate();
    workersRef.current = [];
  }, []);

  // Terminate workers if component unmounts
  useEffect(() => {
    return () => {
      abortJobRef.current?.(new Error('Cancelled'));
      terminateAll();
    };
  }, [terminateAll]);

  const cancelUpscale = useCallback(() => {
    abortJobRef.current?.(new Error('Cancelled'));
    abortJobRef.current = null;
    terminateAll();
    setIsProcessing(false);
    setProgress(0);
    setStage('Cancelled by user');
    setError(null);
  }, [terminateAll]);

  const upscaleImage = useCallback(
    async (
      source: File | Blob | HTMLCanvasElement,
      targetWidth: number,
      targetHeight: number,
      sharpenAmount: number = 1.3,
      varianceThreshold: number = 25,
      clampRinging: boolean = false,
      refinePasses: number = 3,
      edgeSmoothing: number = 0.7
    ): Promise<UpscaleResult> => {
      setIsProcessing(true);
      setProgress(0);
      setStage('Extracting raw source pixel buffer…');
      setError(null);

      // Extract raw RGBA ImageData from source
      let srcWidth: number;
      let srcHeight: number;
      let srcPixels: Uint8ClampedArray;

      try {
        let srcCanvas: HTMLCanvasElement;
        if (source instanceof HTMLCanvasElement) {
          srcCanvas = source;
          srcWidth = source.width;
          srcHeight = source.height;
        } else {
          const bmp = await createImageBitmap(source);
          srcWidth = bmp.width;
          srcHeight = bmp.height;
          srcCanvas = document.createElement('canvas');
          srcCanvas.width = srcWidth;
          srcCanvas.height = srcHeight;
          const ctx = srcCanvas.getContext('2d');
          if (!ctx) {
            bmp.close();
            throw new Error('Failed to create 2D canvas context');
          }
          ctx.drawImage(bmp, 0, 0);
          bmp.close();
        }

        const srcCtx = srcCanvas.getContext('2d');
        if (!srcCtx) throw new Error('Could not access canvas context');
        srcPixels = srcCtx.getImageData(0, 0, srcWidth, srcHeight).data;
      } catch (decodeErr: any) {
        const msg = decodeErr?.message || 'Could not decode source image';
        setIsProcessing(false);
        setError(msg);
        throw decodeErr instanceof Error ? decodeErr : new Error(msg);
      }

      // ---- Parallel processing: one horizontal band per worker thread --------
      const params: UpscaleParams = {
        sharpenAmount,
        varianceThreshold,
        clampRinging,
        refinePasses,
        edgeSmoothing,
      };
      const bands = planBands(srcHeight, targetHeight, getThreadCount(), params);
      const threadLabel = bands.length > 1 ? ` • ${bands.length} threads` : '';
      const out = new Uint8ClampedArray(targetWidth * targetHeight * 4);
      const bandProgress = new Array<number>(bands.length).fill(0);

      abortJobRef.current?.(new Error('Cancelled'));
      terminateAll();
      const workers = bands.map(
        () => new Worker(new URL('../workers/upscale.worker.ts', import.meta.url), { type: 'module' })
      );
      workersRef.current = workers;

      try {
        await new Promise<void>((resolve, reject) => {
          let remaining = bands.length;
          let settled = false;
          const fail = (err: Error) => {
            if (settled) return;
            settled = true;
            abortJobRef.current = null;
            for (const w of workers) w.terminate();
            reject(err);
          };
          abortJobRef.current = fail;

          bands.forEach((band, i) => {
            const worker = workers[i];
            worker.onmessage = (e: MessageEvent) => {
              const { type, progress: p, stage: s, buffer, error: err } = e.data;
              if (settled) return;
              if (type === 'PROGRESS') {
                bandProgress[i] = p;
                // Overall progress = average across bands; label from the slowest band
                const avg = bandProgress.reduce((a, b) => a + b, 0) / bands.length;
                setProgress(Math.min(99, Math.round(avg)));
                if (p === Math.min(...bandProgress)) setStage(`${s}${threadLabel}`);
              } else if (type === 'ERROR') {
                fail(new Error(err));
              } else if (type === 'DONE') {
                stitchBand(out, new Uint8ClampedArray(buffer), targetWidth, band);
                worker.terminate();
                if (--remaining === 0) {
                  settled = true;
                  abortJobRef.current = null;
                  resolve();
                }
              }
            };
            worker.onerror = (wErr) => fail(new Error(wErr.message || 'Worker thread execution error'));

            // Each worker gets its own copy of just its source rows (transferred, zero-copy after slice)
            const rowBytes = srcWidth * 4;
            const slice = srcPixels.slice(band.srcY0 * rowBytes, (band.srcY0 + band.srcRows) * rowBytes);
            worker.postMessage(
              {
                imageBuffer: slice.buffer,
                srcWidth,
                srcHeight: band.srcRows,
                targetWidth,
                targetHeight: band.dstRows,
                ...params,
                region: {
                  srcY0: band.srcY0,
                  dstY0: band.dstY0,
                  fullSrcH: srcHeight,
                  fullDstH: targetHeight,
                },
              },
              [slice.buffer]
            );
          });
        });
      } catch (err: any) {
        terminateAll();
        if (err?.message !== 'Cancelled') {
          setIsProcessing(false);
          setError(/memory/i.test(err?.message || '') ? 'Out of memory: try a smaller scale factor.' : err?.message);
        }
        throw err;
      }
      workersRef.current = [];

      // ---- Assemble result -----------------------------------------------------
      setStage('Rendering upscaled result to canvas…');
      setProgress(100);
      try {
        const outCanvas = document.createElement('canvas');
        outCanvas.width = targetWidth;
        outCanvas.height = targetHeight;
        const outCtx = outCanvas.getContext('2d');
        if (!outCtx) throw new Error('Could not create output canvas');
        outCtx.putImageData(new ImageData(out, targetWidth, targetHeight), 0, 0);

        const upscaledBlob = await new Promise<Blob>((resBlob, rejBlob) => {
          outCanvas.toBlob(
            (b) => (b ? resBlob(b) : rejBlob(new Error('Export to blob failed'))),
            'image/jpeg',
            0.96
          );
        });

        // Also create a high-performance preview canvas
        const maxPrev = 1600;
        const prevScale = Math.min(1, maxPrev / Math.max(targetWidth, targetHeight));
        const prevCanvas = document.createElement('canvas');
        prevCanvas.width = Math.max(1, Math.round(targetWidth * prevScale));
        prevCanvas.height = Math.max(1, Math.round(targetHeight * prevScale));
        const prevCtx = prevCanvas.getContext('2d');
        if (prevCtx) {
          prevCtx.imageSmoothingEnabled = true;
          prevCtx.imageSmoothingQuality = 'high';
          prevCtx.drawImage(outCanvas, 0, 0, prevCanvas.width, prevCanvas.height);
        }

        setIsProcessing(false);
        return { upscaledBlob, previewCanvas: prevCanvas, width: targetWidth, height: targetHeight };
      } catch (postErr: any) {
        setIsProcessing(false);
        setError(postErr?.message || 'Failed to assemble upscaled image');
        throw postErr;
      }
    },
    [terminateAll]
  );

  return {
    isProcessing,
    progress,
    stage,
    error,
    upscaleImage,
    cancelUpscale,
  };
}
