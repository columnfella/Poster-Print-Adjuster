import test from 'node:test';
import assert from 'node:assert/strict';
import { upscaleRGBA, computeContribs, resamplePlane, UpscaleParams } from './upscaleEngine.ts';

const params: UpscaleParams = {
  sharpenAmount: 1.3,
  varianceThreshold: 25,
  clampRinging: true,
  refinePasses: 3,
  edgeSmoothing: 0.7,
};

function makeRGBA(w: number, h: number, f: (x: number, y: number) => number): Uint8ClampedArray {
  const a = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = f(x, y);
      const p = (y * w + x) * 4;
      a[p] = a[p + 1] = a[p + 2] = v;
      a[p + 3] = 255;
    }
  return a;
}

/** Plain Lanczos-3 luma upscale for comparison. */
function lanczosGray(src: Uint8ClampedArray, sw: number, sh: number, dw: number, dh: number) {
  const plane = new Float32Array(sw * sh);
  for (let i = 0; i < sw * sh; i++) plane[i] = src[i * 4];
  const out = new Float32Array(dw * dh);
  resamplePlane(plane, sw, sh, dw, dh, computeContribs(sw, dw), computeContribs(sh, dh), out);
  return out;
}

/** Width (in px) of the 10%..90% transition across a horizontal edge row. */
function edgeWidth(row: ArrayLike<number>, lo: number, hi: number): number {
  const t10 = lo + (hi - lo) * 0.1;
  const t90 = lo + (hi - lo) * 0.9;
  let a = -1;
  let b = -1;
  for (let i = 0; i < row.length; i++) {
    if (a < 0 && row[i] > t10) a = i;
    if (b < 0 && row[i] > t90) b = i;
  }
  return b - a;
}

test('flat image stays flat', () => {
  const src = makeRGBA(20, 20, () => 137);
  const out = upscaleRGBA(src, 20, 20, 60, 60, params);
  for (let i = 0; i < out.length; i += 4) {
    assert.ok(Math.abs(out[i] - 137) <= 1);
    assert.equal(out[i + 3], 255);
  }
});

test('edges come out sharper than plain Lanczos, with no overshoot', () => {
  const sw = 40;
  const sh = 8;
  // soft (anti-aliased) step edge, as in a typical low-res poster
  const src = makeRGBA(sw, sh, (x) => (x < 19 ? 20 : x === 19 ? 80 : x === 20 ? 170 : 230));
  const dw = sw * 4;
  const dh = sh * 4;
  const out = upscaleRGBA(src, sw, sh, dw, dh, params);
  const ref = lanczosGray(src, sw, sh, dw, dh);

  const y = dh >> 1;
  const ours = Array.from({ length: dw }, (_, x) => out[(y * dw + x) * 4]);
  const theirs = Array.from({ length: dw }, (_, x) => ref[y * dw + x]);

  const wOurs = edgeWidth(ours, 20, 230);
  const wRef = edgeWidth(theirs, 20, 230);
  assert.ok(wOurs < wRef, `expected sharper edge: ours=${wOurs}px lanczos=${wRef}px`);
  assert.ok(Math.min(...ours) >= 19 && Math.max(...ours) <= 231, 'no halo overshoot');
});

test('downsampling the result reproduces the source (back-projection consistency)', () => {
  const sw = 32;
  const sh = 32;
  const src = makeRGBA(sw, sh, (x, y) => 128 + 100 * Math.sin(x * 0.5) * Math.cos(y * 0.3));
  const out = upscaleRGBA(src, sw, sh, sw * 3, sh * 3, { ...params, sharpenAmount: 0 });
  // box-average back down 3x3
  let err = 0;
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < sw; x++) {
      let s = 0;
      for (let j = 0; j < 3; j++)
        for (let i = 0; i < 3; i++) s += out[((y * 3 + j) * sw * 3 + x * 3 + i) * 4];
      err += Math.abs(s / 9 - src[(y * sw + x) * 4]);
    }
  assert.ok(err / (sw * sh) < 4, `mean reconstruction error ${err / (sw * sh)}`);
});

test('preserves alpha and colour', () => {
  const src = new Uint8ClampedArray(4 * 4 * 4);
  for (let i = 0; i < 16; i++) src.set([200, 30, 40, i < 8 ? 255 : 0], i * 4);
  const out = upscaleRGBA(src, 4, 4, 8, 8, params);
  assert.ok(out[0] > 180 && out[1] < 50 && out[2] < 60, 'red stays red');
  assert.equal(out[3], 255);
  assert.equal(out[out.length - 1], 0);
});
