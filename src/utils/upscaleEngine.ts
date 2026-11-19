/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Edge-aware reconstruction upscaler (pure, DOM-free; runs inside a Web Worker).
 *
 * Pipeline (luma channel gets the full treatment, chroma is resampled + deringed):
 *   1. RGB -> YCbCr planes (float).
 *   2. Lanczos-3 initial upscale.
 *   3. Edge-directed anti-aliasing: a structure-tensor orientation field (computed at
 *      source resolution) drives smoothing ALONG edges, removing staircase jaggies
 *      without blurring across the edge.
 *   4. Iterative back-projection (IBP): repeatedly downsample the estimate, compare to
 *      the original, and upsample the residual back in. This enforces consistency with
 *      the source and restores edge sharpness lost to interpolation.
 *   5. Deringing clamp after every step: each output pixel is kept inside the min/max
 *      of its 2x2 source footprint, eliminating Lanczos/IBP halos.
 *   6. Scale-aware adaptive unsharp mask on luma (blur radius proportional to the
 *      scale factor, soft noise coring, halo-limited overshoot).
 */

export interface UpscaleParams {
  sharpenAmount: number; // 0 .. ~2.5
  varianceThreshold: number; // noise coring control, 5 .. 60
  clampRinging: boolean; // strict anti-halo (no overshoot at all)
  refinePasses: number; // back-projection iterations, 0 .. 6
  edgeSmoothing: number; // 0 .. 1 edge-directed anti-aliasing strength
}

export type ProgressFn = (progress: number, stage: string) => void;

type Kernel = (x: number) => number;

export function lanczos3(x: number): number {
  const ax = Math.abs(x);
  if (ax === 0) return 1.0;
  if (ax >= 3.0) return 0.0;
  const piX = Math.PI * ax;
  const piX3 = piX / 3.0;
  return (Math.sin(piX) / piX) * (Math.sin(piX3) / piX3);
}

function triangle(x: number): number {
  const ax = Math.abs(x);
  return ax < 1 ? 1 - ax : 0;
}

/** Flattened filter contributions for fast inner loops. */
export interface Contribs {
  start: Int32Array;
  count: Int32Array;
  stride: number;
  weights: Float32Array;
}

export function computeContribs(
  srcSize: number,
  dstSize: number,
  kernel: Kernel = lanczos3,
  support = 3
): Contribs {
  return computeContribsMapped(0, dstSize, 0, srcSize, dstSize / srcSize, kernel, support);
}

/**
 * Filter contributions for a WINDOW of a larger resample: destination samples
 * [dstStart, dstStart+dstCount) of a full-size resample with the given global scale,
 * reading from the source window [srcStart, srcStart+srcCount). Indices are local to
 * the source window. With zero offsets this is the plain full-image resample, which lets
 * parallel bands sample exactly the same positions as a single-threaded run.
 */
export function computeContribsMapped(
  dstStart: number,
  dstCount: number,
  srcStart: number,
  srcCount: number,
  scale: number,
  kernel: Kernel = lanczos3,
  support = 3
): Contribs {
  const srcSize = srcCount;
  const dstSize = dstCount;
  const radius = scale < 1 ? support / scale : support;
  const inv = scale < 1 ? scale : 1;
  const stride = Math.ceil(radius) * 2 + 2;
  const start = new Int32Array(dstSize);
  const count = new Int32Array(dstSize);
  const weights = new Float32Array(dstSize * stride);

  for (let i = 0; i < dstSize; i++) {
    const center = (dstStart + i + 0.5) / scale - 0.5 - srcStart;
    const left = Math.max(0, Math.floor(center - radius));
    const right = Math.min(srcSize - 1, Math.ceil(center + radius));
    const n = Math.min(stride, right - left + 1);
    let total = 0;
    const base = i * stride;
    for (let j = 0; j < n; j++) {
      const w = kernel((left + j - center) * inv);
      weights[base + j] = w;
      total += w;
    }
    if (total !== 0) {
      for (let j = 0; j < n; j++) weights[base + j] /= total;
    }
    start[i] = left;
    count[i] = n;
  }
  return { start, count, stride, weights };
}

type Plane = Float32Array | Uint8ClampedArray;

/**
 * Separable resample of a single-channel plane.
 * mode 'add' accumulates into dst (used by back-projection to avoid a full temp plane).
 */
export function resamplePlane(
  src: Float32Array,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
  hC: Contribs,
  vC: Contribs,
  dst: Plane,
  mode: 'set' | 'add' = 'set',
  bias = 0
): void {
  // Horizontal pass: sw x sh -> dw x sh
  const tmp = new Float32Array(dw * sh);
  for (let y = 0; y < sh; y++) {
    const so = y * sw;
    const to = y * dw;
    for (let x = 0; x < dw; x++) {
      const s = hC.start[x] + so;
      const n = hC.count[x];
      const wb = x * hC.stride;
      let acc = 0;
      for (let j = 0; j < n; j++) acc += src[s + j] * hC.weights[wb + j];
      tmp[to + x] = acc;
    }
  }

  // Vertical pass: dw x sh -> dw x dh (row-streamed, cache friendly)
  const row = new Float32Array(dw);
  for (let y = 0; y < dh; y++) {
    row.fill(0);
    const s = vC.start[y];
    const n = vC.count[y];
    const wb = y * vC.stride;
    for (let j = 0; j < n; j++) {
      const w = vC.weights[wb + j];
      const ro = (s + j) * dw;
      for (let x = 0; x < dw; x++) row[x] += w * tmp[ro + x];
    }
    const o = y * dw;
    if (mode === 'add') {
      for (let x = 0; x < dw; x++) dst[o + x] += row[x];
    } else {
      for (let x = 0; x < dw; x++) dst[o + x] = row[x] + bias;
    }
  }
}

/** For each output coordinate, the two nearest source sample indices. */
export function footprintIndices(srcSize: number, dstSize: number): [Int32Array, Int32Array] {
  return footprintIndicesMapped(0, dstSize, 0, srcSize, dstSize / srcSize);
}

/** Windowed variant of footprintIndices (see computeContribsMapped). */
export function footprintIndicesMapped(
  dstStart: number,
  dstCount: number,
  srcStart: number,
  srcCount: number,
  scale: number
): [Int32Array, Int32Array] {
  const i0 = new Int32Array(dstCount);
  const i1 = new Int32Array(dstCount);
  for (let i = 0; i < dstCount; i++) {
    const u = (dstStart + i + 0.5) / scale - 0.5 - srcStart;
    const a = Math.min(srcCount - 1, Math.max(0, Math.floor(u)));
    i0[i] = a;
    i1[i] = Math.min(srcCount - 1, Math.max(0, a + 1));
  }
  return [i0, i1];
}

/** Nearest source index for each destination sample (windowed). */
function nearestIndicesMapped(
  dstStart: number,
  dstCount: number,
  srcStart: number,
  srcCount: number,
  scale: number
): Int32Array {
  const out = new Int32Array(dstCount);
  for (let i = 0; i < dstCount; i++) {
    const v = Math.floor((dstStart + i + 0.5) / scale) - srcStart;
    out[i] = v < 0 ? 0 : v >= srcCount ? srcCount - 1 : v;
  }
  return out;
}

interface Footprint {
  fx0: Int32Array;
  fx1: Int32Array;
  fy0: Int32Array;
  fy1: Int32Array;
}

/** Clamp each output pixel to [min,max] of its 2x2 source footprint (+ optional overshoot). */
function clampToFootprint(
  plane: Float32Array,
  src: Float32Array,
  sw: number,
  dw: number,
  dh: number,
  fp: Footprint,
  allowFrac = 0
): void {
  for (let y = 0; y < dh; y++) {
    const r0 = fp.fy0[y] * sw;
    const r1 = fp.fy1[y] * sw;
    const o = y * dw;
    for (let x = 0; x < dw; x++) {
      const x0 = fp.fx0[x];
      const x1 = fp.fx1[x];
      const a = src[r0 + x0];
      const b = src[r0 + x1];
      const c = src[r1 + x0];
      const d = src[r1 + x1];
      let lo = a < b ? a : b;
      let hi = a < b ? b : a;
      if (c < lo) lo = c;
      if (c > hi) hi = c;
      if (d < lo) lo = d;
      if (d > hi) hi = d;
      if (allowFrac > 0) {
        const m = (hi - lo) * allowFrac;
        lo -= m;
        hi += m;
      }
      const v = plane[o + x];
      plane[o + x] = v < lo ? lo : v > hi ? hi : v;
    }
  }
}

/**
 * Structure-tensor orientation field at source resolution.
 * Returns tangent direction (tx, ty) and an edge weight in [0,1] per source pixel.
 */
function orientationField(Y: Float32Array, w: number, h: number) {
  const n = w * h;
  const jxx = new Float32Array(n);
  const jxy = new Float32Array(n);
  const jyy = new Float32Array(n);

  for (let y = 0; y < h; y++) {
    const ym = Math.max(0, y - 1) * w;
    const yc = y * w;
    const yp = Math.min(h - 1, y + 1) * w;
    for (let x = 0; x < w; x++) {
      const xm = Math.max(0, x - 1);
      const xp = Math.min(w - 1, x + 1);
      const gx =
        Y[ym + xp] + 2 * Y[yc + xp] + Y[yp + xp] - Y[ym + xm] - 2 * Y[yc + xm] - Y[yp + xm];
      const gy =
        Y[yp + xm] + 2 * Y[yp + x] + Y[yp + xp] - Y[ym + xm] - 2 * Y[ym + x] - Y[ym + xp];
      const i = yc + x;
      jxx[i] = gx * gx;
      jxy[i] = gx * gy;
      jyy[i] = gy * gy;
    }
  }

  // 3x3 [1 2 1] smoothing of the tensor
  const blur3 = (p: Float32Array) => {
    const t = new Float32Array(n);
    for (let y = 0; y < h; y++) {
      const o = y * w;
      for (let x = 0; x < w; x++) {
        const xm = Math.max(0, x - 1);
        const xp = Math.min(w - 1, x + 1);
        t[o + x] = (p[o + xm] + 2 * p[o + x] + p[o + xp]) * 0.25;
      }
    }
    for (let y = 0; y < h; y++) {
      const ym = Math.max(0, y - 1) * w;
      const yc = y * w;
      const yp = Math.min(h - 1, y + 1) * w;
      for (let x = 0; x < w; x++) p[yc + x] = (t[ym + x] + 2 * t[yc + x] + t[yp + x]) * 0.25;
    }
  };
  blur3(jxx);
  blur3(jxy);
  blur3(jyy);

  const tx = new Float32Array(n);
  const ty = new Float32Array(n);
  const wt = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = jxx[i];
    const b = jxy[i];
    const c = jyy[i];
    const tr = a + c;
    const disc = Math.sqrt(((a - c) * 0.5) ** 2 + b * b);
    const l1 = tr * 0.5 + disc;
    const l2 = tr * 0.5 - disc;
    if (l1 <= 1e-6) continue;
    const coh = ((l1 - l2) / (l1 + l2 + 1e-6)) ** 2;
    const mag = Math.sqrt(l1);
    const gate = Math.min(1, Math.max(0, (mag - 8) / 32));
    const theta = 0.5 * Math.atan2(2 * b, a - c); // gradient direction
    tx[i] = -Math.sin(theta);
    ty[i] = Math.cos(theta);
    wt[i] = coh * gate;
  }
  return { tx, ty, wt };
}

function sampleBilinear(p: Float32Array, w: number, h: number, x: number, y: number): number {
  if (x < 0) x = 0;
  else if (x > w - 1) x = w - 1;
  if (y < 0) y = 0;
  else if (y > h - 1) y = h - 1;
  const x0 = x | 0;
  const y0 = y | 0;
  const x1 = x0 + 1 < w ? x0 + 1 : x0;
  const y1 = y0 + 1 < h ? y0 + 1 : y0;
  const fx = x - x0;
  const fy = y - y0;
  const r0 = y0 * w;
  const r1 = y1 * w;
  const top = p[r0 + x0] + (p[r0 + x1] - p[r0 + x0]) * fx;
  const bot = p[r1 + x0] + (p[r1 + x1] - p[r1 + x0]) * fx;
  return top + (bot - top) * fy;
}

/** Smooth along local edge tangents (anti-aliases jaggies, preserves edge contrast). */
function edgeDirectedSmooth(
  H: Float32Array,
  out: Float32Array,
  dw: number,
  dh: number,
  field: { tx: Float32Array; ty: Float32Array; wt: Float32Array },
  sw: number,
  nearX: Int32Array,
  nearY: Int32Array,
  scale: number,
  strength: number
): void {
  const step = Math.max(1, scale * 0.5);
  // Gaussian-ish taps along the tangent: center, ±1 step, ±2 steps
  const w0 = 0.4;
  const w1 = 0.2;
  const w2 = 0.1;
  for (let y = 0; y < dh; y++) {
    const sy = nearY[y] * sw;
    const o = y * dw;
    for (let x = 0; x < dw; x++) {
      const si = sy + nearX[x];
      const k = field.wt[si] * strength;
      const v = H[o + x];
      if (k < 0.02) {
        out[o + x] = v;
        continue;
      }
      const dx = field.tx[si] * step;
      const dy = field.ty[si] * step;
      const avg =
        w0 * v +
        w1 * (sampleBilinear(H, dw, dh, x + dx, y + dy) + sampleBilinear(H, dw, dh, x - dx, y - dy)) +
        w2 *
          (sampleBilinear(H, dw, dh, x + 2 * dx, y + 2 * dy) +
            sampleBilinear(H, dw, dh, x - 2 * dx, y - 2 * dy));
      out[o + x] = v + (avg - v) * (k > 1 ? 1 : k);
    }
  }
}

function gaussianKernel(sigma: number): Float32Array {
  const r = Math.max(1, Math.ceil(sigma * 3));
  const k = new Float32Array(r * 2 + 1);
  let s = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k[i + r] = v;
    s += v;
  }
  for (let i = 0; i < k.length; i++) k[i] /= s;
  return k;
}

/**
 * Horizontal band of a larger image, for multi-threaded processing.
 * The rgba passed in holds source rows [srcY0, srcY0+sh); the call produces output rows
 * [dstY0, dstY0+dh) of a full-size fullSrcH -> fullDstH resample.
 */
export interface BandRegion {
  srcY0: number;
  dstY0: number;
  fullSrcH: number;
  fullDstH: number;
}

/**
 * Upscale an RGBA buffer. Returns a new RGBA Uint8ClampedArray of dw x dh.
 * With `region`, sh/dh are the band's local heights (see BandRegion).
 */
export function upscaleRGBA(
  rgba: Uint8ClampedArray,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
  params: UpscaleParams,
  onProgress: ProgressFn = () => {},
  region?: BandRegion
): Uint8ClampedArray {
  const srcY0 = region?.srcY0 ?? 0;
  const dstY0 = region?.dstY0 ?? 0;
  const scaleX = dw / sw;
  const scaleY = region ? region.fullDstH / region.fullSrcH : dh / sh;
  const scale = Math.sqrt(scaleX * scaleY);
  const ns = sw * sh;
  const nd = dw * dh;

  // ---- 1. Colour space split -------------------------------------------------
  onProgress(2, 'Analyzing source: YCbCr colour split');
  const Y = new Float32Array(ns);
  const Cb = new Float32Array(ns);
  const Cr = new Float32Array(ns);
  let opaque = true;
  for (let i = 0, p = 0; i < ns; i++, p += 4) {
    const r = rgba[p];
    const g = rgba[p + 1];
    const b = rgba[p + 2];
    Y[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    Cb[i] = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    Cr[i] = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    if (rgba[p + 3] !== 255) opaque = false;
  }

  const upH = computeContribs(sw, dw);
  const upV = computeContribsMapped(dstY0, dh, srcY0, sh, scaleY);
  const [fx0, fx1] = footprintIndices(sw, dw);
  const [fy0, fy1] = footprintIndicesMapped(dstY0, dh, srcY0, sh, scaleY);
  const fp: Footprint = { fx0, fx1, fy0, fy1 };

  // ---- 2. Initial Lanczos-3 upscale of luma --------------------------------
  onProgress(6, 'Pass 1/5: Lanczos-3 base interpolation');
  let H = new Float32Array(nd);
  resamplePlane(Y, sw, sh, dw, dh, upH, upV, H);
  let scratch = new Float32Array(nd);

  // ---- 3. Edge-directed anti-aliasing --------------------------------------
  if (params.edgeSmoothing > 0 && scale > 1.1) {
    onProgress(18, 'Pass 2/5: Edge-directed anti-aliasing (structure tensor)');
    const field = orientationField(Y, sw, sh);
    const nearX = nearestIndicesMapped(0, dw, 0, sw, scaleX);
    const nearY = nearestIndicesMapped(dstY0, dh, srcY0, sh, scaleY);
    edgeDirectedSmooth(H, scratch, dw, dh, field, sw, nearX, nearY, scale, params.edgeSmoothing);
    const t = H;
    H = scratch;
    scratch = t;
  }
  clampToFootprint(H, Y, sw, dw, dh, fp);

  // ---- 4. Iterative back-projection ----------------------------------------
  const passes = Math.max(0, Math.min(6, Math.round(params.refinePasses)));
  if (passes > 0) {
    const downH = computeContribs(dw, sw, triangle, 1);
    const downV = computeContribsMapped(srcY0, sh, dstY0, dh, 1 / scaleY, triangle, 1);
    const D = new Float32Array(ns);
    for (let k = 0; k < passes; k++) {
      onProgress(
        30 + Math.round((k / passes) * 35),
        `Pass 3/5: Back-projection detail reconstruction (${k + 1}/${passes})`
      );
      resamplePlane(H, dw, dh, sw, sh, downH, downV, D);
      for (let i = 0; i < ns; i++) D[i] = Y[i] - D[i];
      resamplePlane(D, sw, sh, dw, dh, upH, upV, H, 'add');
      clampToFootprint(H, Y, sw, dw, dh, fp);
    }
  }

  // ---- 5. Chroma: Lanczos + dering, stored compactly -----------------------
  onProgress(68, 'Pass 4/5: Chroma reconstruction');
  const CbH = new Uint8ClampedArray(nd);
  const CrH = new Uint8ClampedArray(nd);
  resamplePlane(Cb, sw, sh, dw, dh, upH, upV, scratch);
  clampToFootprint(scratch, Cb, sw, dw, dh, fp);
  CbH.set(scratch);
  resamplePlane(Cr, sw, sh, dw, dh, upH, upV, scratch);
  clampToFootprint(scratch, Cr, sw, dw, dh, fp);
  CrH.set(scratch);

  let AH: Uint8ClampedArray | null = null;
  if (!opaque) {
    const A = new Float32Array(ns);
    for (let i = 0; i < ns; i++) A[i] = rgba[i * 4 + 3];
    resamplePlane(A, sw, sh, dw, dh, upH, upV, scratch);
    clampToFootprint(scratch, A, sw, dw, dh, fp);
    AH = new Uint8ClampedArray(nd);
    AH.set(scratch);
  }

  // ---- 6. Scale-aware adaptive sharpening + RGB recomposition --------------
  onProgress(80, 'Pass 5/5: Scale-aware adaptive sharpening');
  const amount = Math.max(0, params.sharpenAmount);
  const sigma = Math.max(0.8, 0.6 * scale);
  const gk = gaussianKernel(sigma);
  const gr = (gk.length - 1) >> 1;
  const coring = Math.max(0, params.varianceThreshold) * 0.1;
  const allow = params.clampRinging ? 0 : 0.2;

  // horizontal blur into scratch
  if (amount > 0) {
    for (let y = 0; y < dh; y++) {
      const o = y * dw;
      for (let x = 0; x < dw; x++) {
        let acc = 0;
        for (let k = -gr; k <= gr; k++) {
          let xx = x + k;
          if (xx < 0) xx = 0;
          else if (xx >= dw) xx = dw - 1;
          acc += H[o + xx] * gk[k + gr];
        }
        scratch[o + x] = acc;
      }
    }
  }

  const out = new Uint8ClampedArray(nd * 4);
  const reportEvery = Math.max(1, Math.floor(dh / 10));
  for (let y = 0; y < dh; y++) {
    const o = y * dw;
    const r0 = fy0[y] * sw;
    const r1 = fy1[y] * sw;
    for (let x = 0; x < dw; x++) {
      const i = o + x;
      let yv = H[i];
      if (amount > 0) {
        // vertical blur sample (row-streamed)
        let blur = 0;
        for (let k = -gr; k <= gr; k++) {
          let yy = y + k;
          if (yy < 0) yy = 0;
          else if (yy >= dh) yy = dh - 1;
          blur += scratch[yy * dw + x] * gk[k + gr];
        }
        let d = yv - blur;
        // soft coring: suppress low-amplitude noise/grain
        d = d > coring ? d - coring : d < -coring ? d + coring : 0;
        if (d !== 0) {
          yv += d * amount;
          // halo limiter against the source footprint
          const x0 = fx0[x];
          const x1 = fx1[x];
          const a = Y[r0 + x0];
          const b = Y[r0 + x1];
          const c = Y[r1 + x0];
          const e = Y[r1 + x1];
          let lo = a < b ? a : b;
          let hi = a < b ? b : a;
          if (c < lo) lo = c;
          if (c > hi) hi = c;
          if (e < lo) lo = e;
          if (e > hi) hi = e;
          const m = (hi - lo) * allow;
          lo -= m;
          hi += m;
          yv = yv < lo ? lo : yv > hi ? hi : yv;
        }
      }
      const cb = CbH[i] - 128;
      const cr = CrH[i] - 128;
      const p = i * 4;
      out[p] = yv + 1.402 * cr;
      out[p + 1] = yv - 0.344136 * cb - 0.714136 * cr;
      out[p + 2] = yv + 1.772 * cb;
      out[p + 3] = AH ? AH[i] : 255;
    }
    if (y % reportEvery === 0) {
      onProgress(80 + Math.round((y / dh) * 19), 'Pass 5/5: Scale-aware adaptive sharpening');
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Multi-threading support: split the output into horizontal bands with overlap
// ---------------------------------------------------------------------------

export interface BandPlan {
  /** source rows handed to the worker */
  srcY0: number;
  srcRows: number;
  /** output rows the worker computes (band + overlap) */
  dstY0: number;
  dstRows: number;
  /** rows of the worker output to keep, and where they go in the final image */
  keepFrom: number;
  keepRows: number;
  outY0: number;
}

/**
 * Overlap (in source rows) needed so that a band's kept rows are unaffected by the cut:
 * the sum of the reach of every stage (Lanczos, back-projection passes, edge field,
 * sharpening blur), with margin.
 */
export function bandOverlapRows(srcH: number, dstH: number, params: UpscaleParams): number {
  const scaleY = dstH / srcH;
  const lanczosReach = scaleY < 1 ? 3 / scaleY : 3;
  const passes = Math.max(0, Math.min(6, Math.round(params.refinePasses)));
  const sigma = Math.max(0.8, 0.6 * scaleY);
  const blurReach = Math.ceil(sigma * 3) / scaleY;
  return Math.ceil(lanczosReach * (1 + passes) + passes + 4 + blurReach) + 4;
}

export function planBands(srcH: number, dstH: number, threads: number, params: UpscaleParams): BandPlan[] {
  const scaleY = dstH / srcH;
  const halo = bandOverlapRows(srcH, dstH, params);
  const haloDst = Math.ceil(halo * scaleY);
  // Keep bands tall enough that the overlap stays a small fraction of the work
  const minKeep = Math.max(64, haloDst * 3);
  const n = Math.max(1, Math.min(threads, Math.floor(dstH / minKeep)));

  const bands: BandPlan[] = [];
  for (let k = 0; k < n; k++) {
    const d0 = Math.round((k * dstH) / n);
    const d1 = Math.round(((k + 1) * dstH) / n);
    const sLo = Math.floor((d0 + 0.5) / scaleY - 0.5);
    const sHi = Math.ceil((d1 - 0.5) / scaleY - 0.5) + 1;
    const srcA = Math.max(0, sLo - halo);
    const srcB = Math.min(srcH, sHi + halo);
    const dA = Math.max(0, d0 - haloDst);
    const dB = Math.min(dstH, d1 + haloDst);
    bands.push({
      srcY0: srcA,
      srcRows: srcB - srcA,
      dstY0: dA,
      dstRows: dB - dA,
      keepFrom: d0 - dA,
      keepRows: d1 - d0,
      outY0: d0,
    });
  }
  return bands;
}

/** Copy a band's kept rows into the final output buffer. */
export function stitchBand(out: Uint8ClampedArray, bandOut: Uint8ClampedArray, dw: number, band: BandPlan): void {
  const rowBytes = dw * 4;
  out.set(
    bandOut.subarray(band.keepFrom * rowBytes, (band.keepFrom + band.keepRows) * rowBytes),
    band.outY0 * rowBytes
  );
}

/** Sequential reference implementation of the banded path (used by tests). */
export function upscaleRGBABanded(
  rgba: Uint8ClampedArray,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
  params: UpscaleParams,
  threads: number
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(dw * dh * 4);
  for (const b of planBands(sh, dh, threads, params)) {
    const slice = rgba.subarray(b.srcY0 * sw * 4, (b.srcY0 + b.srcRows) * sw * 4);
    const res = upscaleRGBA(slice, sw, b.srcRows, dw, b.dstRows, params, undefined, {
      srcY0: b.srcY0,
      dstY0: b.dstY0,
      fullSrcH: sh,
      fullDstH: dh,
    });
    stitchBand(out, res, dw, b);
  }
  return out;
}
