import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePrintVerdict,
  getPaperDimensions,
  calculatePresetFit,
  sanitizeFileName,
  validateImageFileHeader,
  validateRemoteImageUrl,
  injectJfifDpiHeader,
} from './printLogic.ts';

test('getPaperDimensions returns correct ISO dimensions', () => {
  const a3Port = getPaperDimensions('A3', 'portrait');
  assert.equal(a3Port.widthInches, 11.69);
  assert.equal(a3Port.heightInches, 16.54);
  assert.equal(a3Port.widthMm, 297);
  assert.equal(a3Port.heightMm, 420);

  const a3Land = getPaperDimensions('A3', 'landscape');
  assert.equal(a3Land.widthInches, 16.54);
  assert.equal(a3Land.heightInches, 11.69);

  // New popular formats
  const poster18x24 = getPaperDimensions('18x24', 'portrait');
  assert.equal(poster18x24.widthInches, 18.0);
  assert.equal(poster18x24.heightInches, 24.0);

  const square = getPaperDimensions('Square12', 'portrait');
  assert.equal(square.widthInches, 12.0);
  assert.equal(square.heightInches, 12.0);

  // Custom dimensions (e.g. 500 x 700 mm)
  const custom = getPaperDimensions('Custom', 'portrait', { widthMm: 500, heightMm: 700 });
  assert.equal(custom.widthMm, 500);
  assert.equal(custom.heightMm, 700);
  assert.equal(custom.widthInches, 19.69);
  assert.equal(custom.heightInches, 27.56);
});

test('calculatePrintVerdict computes DPI and quality tier correctly', () => {
  // A4 is 8.27 x 11.69 in
  // 3000 x 4000 px image at zoom = 1 on A4 portrait
  // DPI = 3000 / 8.27 ≈ 362.75 -> Optimal
  const verdictHigh = calculatePrintVerdict(3000, 4000, 8.27, 11.69, 1, 0.5, 0.5);
  assert.equal(verdictHigh.roundedDpi >= 300, true);
  assert.equal(verdictHigh.tier, 'ok');
  assert.equal(verdictHigh.tierLabel, 'Optimal');

  // Low res: 800 x 1200 px on A3 (11.69 in wide) -> 800 / 11.69 ≈ 68.4 DPI -> Poor
  const verdictLow = calculatePrintVerdict(800, 1200, 11.69, 16.54, 1, 0.5, 0.5);
  assert.equal(verdictLow.roundedDpi < 150, true);
  assert.equal(verdictLow.tier, 'bad');
  assert.equal(verdictLow.tierLabel, 'Poor');

  // Medium res: 2000 x 3000 px on A3 (11.69 in wide) -> 2000 / 11.69 ≈ 171 DPI -> Acceptable
  const verdictMed = calculatePrintVerdict(2000, 3000, 11.69, 16.54, 1, 0.5, 0.5);
  assert.equal(verdictMed.roundedDpi >= 150 && verdictMed.roundedDpi < 300, true);
  assert.equal(verdictMed.tier, 'warn');
  assert.equal(verdictMed.tierLabel, 'Acceptable');
});

test('calculatePresetFit handles fit modes', () => {
  const fitWidth = calculatePresetFit('width', 2000, 1000, 10, 20);
  assert.equal(fitWidth.f, 1);
  assert.equal(fitWidth.cx, 0.5);
  assert.equal(fitWidth.cy, 0.5);

  const fitBleed = calculatePresetFit('bleed', 2000, 1000, 10, 20, 0.125);
  assert.equal(fitBleed.f > 1, true);
});

test('sanitizeFileName removes dangerous characters and path traversal', () => {
  assert.equal(sanitizeFileName('../../../etc/passwd.jpg'), 'etc_passwd.jpg');
  assert.equal(sanitizeFileName('<script>alert("xss")</script>.png'), 'script_alert(_xss_)_script_.png');
  assert.equal(sanitizeFileName('CON.jpg'), 'file_CON.jpg');
  assert.equal(sanitizeFileName('my-poster 2026.png'), 'my-poster 2026.png');
});

test('validateImageFileHeader verifies PNG, JPEG, WebP magic bytes and rejects bad data', () => {
  // Mock PNG
  const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]).buffer;
  assert.equal(validateImageFileHeader(pngHeader).valid, true);
  assert.equal(validateImageFileHeader(pngHeader).mime, 'image/png');

  // Mock JPEG
  const jpgHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]).buffer;
  assert.equal(validateImageFileHeader(jpgHeader).valid, true);
  assert.equal(validateImageFileHeader(jpgHeader).mime, 'image/jpeg');

  // Mock WebP
  const webpHeader = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]).buffer;
  assert.equal(validateImageFileHeader(webpHeader).valid, true);
  assert.equal(validateImageFileHeader(webpHeader).mime, 'image/webp');

  // Malicious / Invalid header (e.g. bash script or SVG script disguised as JPG)
  const badHeader = new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0x20, 0x78, 0x6d, 0x6c, 0x6e, 0x73, 0x3d, 0x22]).buffer;
  assert.equal(validateImageFileHeader(badHeader).valid, false);
});

test('validateRemoteImageUrl blocks SSRF / private networks and non-http protocols', () => {
  assert.equal(validateRemoteImageUrl('https://example.com/poster.jpg').valid, true);
  assert.equal(validateRemoteImageUrl('javascript:alert(1)').valid, false);
  assert.equal(validateRemoteImageUrl('file:///etc/passwd').valid, false);
  assert.equal(validateRemoteImageUrl('http://127.0.0.1:8080/image.jpg').valid, false);
  assert.equal(validateRemoteImageUrl('http://192.168.1.1/router.jpg').valid, false);
});

test('injectJfifDpiHeader embeds 300 DPI into JPEG header', () => {
  // Create sample valid JFIF header
  const rawJfif = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00,
    0x01, 0x01, 0x00, // units at index 13 was 0
    0x00, 0x48, 0x00, 0x48, // 72 dpi
    0x00, 0x00
  ]);
  const updated = injectJfifDpiHeader(rawJfif, 300);
  assert.equal(updated[13], 1); // Units = DPI
  assert.equal(updated[14], 1); // 300 high byte: 0x01
  assert.equal(updated[15], 44); // 300 low byte: 0x2C (44)
});
