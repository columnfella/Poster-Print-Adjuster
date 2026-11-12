/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useCallback, useEffect } from 'react';

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

export function useUpscaler() {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [stage, setStage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);

  // Terminate worker if component unmounts
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const cancelUpscale = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setIsProcessing(false);
    setProgress(0);
    setStage('Cancelled by user');
    setError(null);
  }, []);

  const upscaleImage = useCallback(
    async (
      source: File | Blob | HTMLCanvasElement,
      targetWidth: number,
      targetHeight: number,
      sharpenAmount: number = 1.3,
      varianceThreshold: number = 25,
      clampRinging: boolean = false
    ): Promise<UpscaleResult> => {
      setIsProcessing(true);
      setProgress(0);
      setStage('Extracting raw source pixel buffer…');
      setError(null);

      // Extract raw RGBA ImageData from source
      let srcCanvas: HTMLCanvasElement;
      let srcWidth: number;
      let srcHeight: number;

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
      const srcImageData = srcCtx.getImageData(0, 0, srcWidth, srcHeight);
      const rawBuffer = srcImageData.data.buffer;

      // Spawn Web Worker using Vite module worker syntax
      if (workerRef.current) {
        workerRef.current.terminate();
      }

      const worker = new Worker(
        new URL('../workers/upscale.worker.ts', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;

      return new Promise<UpscaleResult>((resolve, reject) => {
        worker.onmessage = async (e: MessageEvent) => {
          const { type, progress: p, stage: s, buffer, width, height, error: err } = e.data;

          if (type === 'PROGRESS') {
            setProgress(p);
            setStage(s);
          } else if (type === 'ERROR') {
            setIsProcessing(false);
            setError(err);
            reject(new Error(err));
          } else if (type === 'DONE') {
            setStage('Rendering upscaled result to canvas…');
            setProgress(100);

            try {
              const resultBytes = new Uint8ClampedArray(buffer);
              const resultImageData = new ImageData(resultBytes, width, height);

              const outCanvas = document.createElement('canvas');
              outCanvas.width = width;
              outCanvas.height = height;
              const outCtx = outCanvas.getContext('2d');
              if (!outCtx) throw new Error('Could not create output canvas');

              outCtx.putImageData(resultImageData, 0, 0);

              const upscaledBlob = await new Promise<Blob>((resBlob, rejBlob) => {
                outCanvas.toBlob(
                  (b) => (b ? resBlob(b) : rejBlob(new Error('Export to blob failed'))),
                  'image/jpeg',
                  0.96
                );
              });

              // Also create a high-performance preview canvas
              const maxPrev = 1600;
              const prevScale = Math.min(1, maxPrev / Math.max(width, height));
              const prevCanvas = document.createElement('canvas');
              prevCanvas.width = Math.max(1, Math.round(width * prevScale));
              prevCanvas.height = Math.max(1, Math.round(height * prevScale));
              const prevCtx = prevCanvas.getContext('2d');
              if (prevCtx) {
                prevCtx.imageSmoothingEnabled = true;
                prevCtx.imageSmoothingQuality = 'high';
                prevCtx.drawImage(outCanvas, 0, 0, prevCanvas.width, prevCanvas.height);
              }

              setIsProcessing(false);
              resolve({
                upscaledBlob,
                previewCanvas: prevCanvas,
                width,
                height,
              });
            } catch (postErr: any) {
              setIsProcessing(false);
              setError(postErr?.message || 'Failed to assemble upscaled image');
              reject(postErr);
            }
          }
        };

        worker.onerror = (wErr) => {
          setIsProcessing(false);
          const msg = wErr.message || 'Worker thread execution error';
          setError(msg);
          reject(new Error(msg));
        };

        // Transfer raw source buffer to worker for zero-copy
        worker.postMessage(
          {
            imageBuffer: rawBuffer,
            srcWidth,
            srcHeight,
            targetWidth,
            targetHeight,
            sharpenAmount,
            varianceThreshold,
            clampRinging,
          },
          [rawBuffer]
        );
      });
    },
    []
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
