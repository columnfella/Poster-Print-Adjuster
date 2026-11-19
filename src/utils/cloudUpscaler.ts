/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Browser side of the free cloud AI upscaler.
 * Sends the image to this app's own server (/api/ai-upscale), which forwards it to a
 * public Hugging Face Space (see server/aiUpscale.ts) and streams status back.
 */

import type { AiModelId } from './aiModels';

export { AI_MODELS } from './aiModels';
export type { AiModelId, AiModelOption } from './aiModels';

/** AI output is 4x its input. Free GPU Spaces time out on huge inputs, so cap input size. */
export const AI_NATIVE_SCALE = 4;
export const AI_MAX_INPUT_PIXELS = 1_200_000;

export interface CloudStatus {
  message: string;
  /** 0..100 when known */
  progress?: number;
}

export class CloudCancelledError extends Error {
  constructor() {
    super('Cancelled');
    this.name = 'CloudCancelledError';
  }
}

export type CloudErrorCode = 'unavailable' | 'quota' | 'timeout' | 'failed';

const FRIENDLY: Record<CloudErrorCode, string> = {
  unavailable:
    "The AI upscaler isn't available right now. Please try again later, or use the Local engine instead.",
  quota:
    'The free AI upscaler has reached its usage limit for now. Please try again later, or use the Local engine instead.',
  timeout:
    'The AI upscaler is taking too long to respond (it may be overloaded). Please try again later, or use the Local engine instead.',
  failed: 'The AI upscaler could not process this image. Please try again, or use the Local engine instead.',
};

/** User-facing error: `message` is friendly, `detail` keeps the technical reason. */
export class CloudUpscaleError extends Error {
  code: CloudErrorCode;
  detail?: string;
  constructor(code: CloudErrorCode, detail?: string) {
    super(FRIENDLY[code]);
    this.name = 'CloudUpscaleError';
    this.code = code;
    this.detail = detail;
  }
}

/**
 * Probe whether the AI proxy endpoint exists (it won't on static-only hosting).
 * Requires a real JSON answer: an SPA fallback returning index.html must not count.
 */
export async function checkAiAvailability(timeoutMs = 5000): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch('/api/ai-upscale', { method: 'GET', signal: ctrl.signal, cache: 'no-store' });
    if (!resp.ok) return false;
    const json = await resp.json().catch(() => null);
    return json?.available === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Size to send so (input x 4) still covers the target, within the input cap. */
export function computeAiInputSize(
  srcWidth: number,
  srcHeight: number,
  targetWidth: number,
  targetHeight: number
): { width: number; height: number } {
  const needed = Math.max(
    targetWidth / (srcWidth * AI_NATIVE_SCALE),
    targetHeight / (srcHeight * AI_NATIVE_SCALE)
  );
  const capScale = Math.sqrt(AI_MAX_INPUT_PIXELS / (srcWidth * srcHeight));
  const s = Math.min(1, needed, capScale);
  return {
    width: Math.max(1, Math.round(srcWidth * s)),
    height: Math.max(1, Math.round(srcHeight * s)),
  };
}

async function prepareInput(source: Blob, width: number, height: number): Promise<Blob> {
  const bmp = await createImageBitmap(source);
  try {
    if (bmp.width === width && bmp.height === height && source.type === 'image/png') return source;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create canvas');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, width, height);
    return await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('PNG encode failed'))), 'image/png')
    );
  } finally {
    bmp.close();
  }
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Upscale with a free cloud AI model. Returns the raw AI output (4x of the sent image);
 * the caller resizes it to the exact print target.
 */
export async function cloudAiUpscale(
  source: Blob,
  srcWidth: number,
  srcHeight: number,
  targetWidth: number,
  targetHeight: number,
  modelId: AiModelId,
  onStatus: (s: CloudStatus) => void,
  signal?: AbortSignal
): Promise<{ blob: Blob; provider: string }> {
  const size = computeAiInputSize(srcWidth, srcHeight, targetWidth, targetHeight);
  onStatus({ message: `Preparing ${size.width}×${size.height} px input…` });
  const input = await prepareInput(source, size.width, size.height);
  if (signal?.aborted) throw new CloudCancelledError();

  let resp: Response;
  try {
    resp = await fetch(`/api/ai-upscale?model=${encodeURIComponent(modelId)}`, {
      method: 'POST',
      headers: { 'Content-Type': input.type || 'image/png' },
      body: input,
      signal,
    });
  } catch (err: any) {
    if (signal?.aborted) throw new CloudCancelledError();
    throw new CloudUpscaleError('unavailable', `Network error: ${err?.message || err}`);
  }
  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => '');
    throw new CloudUpscaleError(
      resp.status === 413 ? 'failed' : 'unavailable',
      resp.status === 404
        ? 'AI endpoint not found (the site is running without its server).'
        : `Server responded ${resp.status}${text ? `: ${text.slice(0, 200)}` : ''}`
    );
  }
  if (!String(resp.headers.get('content-type')).includes('ndjson')) {
    // e.g. a static host's SPA fallback returning index.html
    throw new CloudUpscaleError('unavailable', 'AI endpoint returned an unexpected response.');
  }

  const reader = resp.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let msg: any;
        try {
          msg = JSON.parse(line);
        } catch {
          throw new CloudUpscaleError('unavailable', 'Malformed response from the AI server.');
        }
        if (msg.type === 'status') onStatus({ message: msg.message, progress: msg.progress });
        else if (msg.type === 'error') {
          const code: CloudErrorCode = ['quota', 'timeout', 'unavailable'].includes(msg.code)
            ? msg.code
            : 'unavailable';
          throw new CloudUpscaleError(code, msg.message);
        } else if (msg.type === 'result') {
          if (typeof msg.data !== 'string' || !msg.data) {
            throw new CloudUpscaleError('failed', 'AI server returned an empty image.');
          }
          const blob = base64ToBlob(msg.data, msg.mime || 'image/png');
          // Make sure the result actually decodes before handing it on
          try {
            (await createImageBitmap(blob)).close();
          } catch {
            throw new CloudUpscaleError('failed', 'AI result could not be decoded as an image.');
          }
          return { blob, provider: msg.provider };
        }
      }
    }
  } catch (err: any) {
    if (signal?.aborted) throw new CloudCancelledError();
    if (err instanceof CloudUpscaleError) throw err;
    throw new CloudUpscaleError('unavailable', `Connection lost: ${err?.message || err}`);
  }
  if (signal?.aborted) throw new CloudCancelledError();
  throw new CloudUpscaleError('unavailable', 'AI server closed the connection without a result.');
}
