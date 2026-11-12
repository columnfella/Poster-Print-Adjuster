import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lanczos3,
  computeLanczosWeights,
  calculateUpscaleTargetDimensions,
  calculateAdaptiveSharpenDelta,
  ARTWORK_PRESETS,
  getPresetById,
  blendArtworkPresets,
} from './upscalerLogic.ts';

test('lanczos3 mathematical kernel properties', () => {
  // L(0) = 1
  assert.equal(lanczos3(0), 1.0);

  // Symmetry: L(x) == L(-x)
  assert.equal(lanczos3(1.2), lanczos3(-1.2));
  assert.equal(lanczos3(0.5), lanczos3(-0.5));

  // Zero-crossings: L(x) = 0 at x = 1, 2, 3
  assert.ok(Math.abs(lanczos3(1.0)) < 1e-6);
  assert.ok(Math.abs(lanczos3(2.0)) < 1e-6);
  assert.equal(lanczos3(3.0), 0.0);

  // Zero outside [-3, 3]
  assert.equal(lanczos3(3.5), 0.0);
  assert.equal(lanczos3(-4.2), 0.0);
});

test('computeLanczosWeights normalizes weights to sum to 1.0', () => {
  const contributions = computeLanczosWeights(100, 200);
  assert.equal(contributions.length, 200);

  for (let i = 0; i < 200; i += 25) {
    const c = contributions[i];
    let sum = 0;
    for (let j = 0; j < c.weights.length; j++) {
      sum += c.weights[j];
    }
    // Sum of normalized weights should equal 1.0
    assert.ok(Math.abs(sum - 1.0) < 1e-5);
  }
});

test('calculateUpscaleTargetDimensions computes DPI target accurately', () => {
  // If current framed DPI is 150 on A3, target300 mode should calculate scale ~ 2.0x
  const target = calculateUpscaleTargetDimensions(1000, 1500, 'A3', 'portrait', 150, 'target300', 300);
  assert.equal(target.scaleFactor, 2.0);
  assert.equal(target.targetWidth, 2000);
  assert.equal(target.targetHeight, 3000);
  assert.equal(target.projectedDpi, 300);

  // 2x mode
  const target2x = calculateUpscaleTargetDimensions(1000, 1500, 'A3', 'portrait', 150, '2x');
  assert.equal(target2x.scaleFactor, 2.0);
  assert.equal(target2x.targetWidth, 2000);

  // 4x mode
  const target4x = calculateUpscaleTargetDimensions(1000, 1500, 'A3', 'portrait', 75, '4x');
  assert.equal(target4x.scaleFactor, 4.0);
  assert.equal(target4x.targetWidth, 4000);
  assert.equal(target4x.projectedDpi, 300);
});

test('calculateAdaptiveSharpenDelta suppresses flat areas and sharpens edges', () => {
  // Low variance (flat area / smooth gradient) -> should return 0
  const flatDelta = calculateAdaptiveSharpenDelta(120, 118, 5, 20, 1.4);
  assert.equal(flatDelta, 0);

  // High variance (edge area) -> should return (Original - Blurred) * sharpenAmount
  const edgeDelta = calculateAdaptiveSharpenDelta(150, 120, 45, 20, 1.4);
  // (150 - 120) * 1.4 = 30 * 1.4 = 42
  assert.equal(edgeDelta, 42);
});

test('ARTWORK_PRESETS defines valid presets for text, line art, photo, etc.', () => {
  // Text preset must have strong sharpening and anti-ringing filter enabled
  const textPreset = getPresetById('text');
  assert.equal(textPreset.id, 'text');
  assert.ok(textPreset.sharpenAmount >= 1.5);
  assert.equal(textPreset.clampRinging, true);

  // Line art preset must have anti-ringing enabled and clean contours
  const lineartPreset = getPresetById('lineart');
  assert.equal(lineartPreset.id, 'lineart');
  assert.equal(lineartPreset.clampRinging, true);

  // Photo preset must have conservative sharpening and higher variance threshold
  const photoPreset = getPresetById('photo');
  assert.equal(photoPreset.id, 'photo');
  assert.ok(photoPreset.varianceThreshold >= 30);
  assert.equal(photoPreset.clampRinging, false);

  // Vintage preset must preserve grain
  const vintagePreset = getPresetById('vintage');
  assert.ok(vintagePreset.varianceThreshold >= 40);

  // Fallback for invalid preset ID
  const fallback = getPresetById('unknown' as any);
  assert.equal(fallback.id, 'text');
});

test('blendArtworkPresets properly blends parameters for up to 2 presets', () => {
  // Single preset
  const single = blendArtworkPresets(['text']);
  assert.equal(single.isHybrid, false);
  assert.equal(single.sharpenAmount, 1.8);
  assert.equal(single.varianceThreshold, 15);
  assert.equal(single.clampRinging, true);

  // Text + Digital Art hybrid
  const textAndArt = blendArtworkPresets(['text', 'digital-art']);
  assert.equal(textAndArt.isHybrid, true);
  assert.equal(textAndArt.sharpenAmount, 1.55); // (1.8 + 1.3) / 2
  assert.equal(textAndArt.varianceThreshold, 20); // (15 + 25) / 2
  assert.equal(textAndArt.clampRinging, true); // true || false = true

  // Photo + Vintage hybrid
  const photoAndVintage = blendArtworkPresets(['photo', 'vintage']);
  assert.equal(photoAndVintage.isHybrid, true);
  assert.equal(photoAndVintage.sharpenAmount, 0.8); // (0.9 + 0.7) / 2
  assert.equal(photoAndVintage.varianceThreshold, 40); // (35 + 45) / 2
  assert.equal(photoAndVintage.clampRinging, false); // false || false = false

  // Empty or custom preset returns default custom config
  const customOnly = blendArtworkPresets(['custom']);
  assert.equal(customOnly.isHybrid, false);
});

