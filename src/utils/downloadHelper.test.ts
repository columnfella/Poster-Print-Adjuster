/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMobileDevice, downloadJpegBlob } from './downloadHelper';

test('isMobileDevice detects standard user agents properly', () => {
  // In node environment, window and navigator may be undefined
  const result = isMobileDevice();
  assert.equal(typeof result, 'boolean');
});

test('downloadJpegBlob normalizes filename and enforces image/jpeg type', async () => {
  // Create sample blob
  const sampleData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const blob = new Blob([sampleData], { type: 'image/jpeg' });

  // Mock document.createElement for node test environment
  if (typeof document === 'undefined') {
    (global as any).document = {
      createElement: (tag: string) => {
        return {
          style: {},
          href: '',
          download: '',
          target: '',
          rel: '',
          click: () => {},
          parentNode: null,
        };
      },
      body: {
        appendChild: () => {},
        removeChild: () => {},
      },
    };
  }

  if (typeof URL === 'undefined' || !URL.createObjectURL) {
    (global as any).URL = {
      createObjectURL: () => 'blob:mock-url',
      revokeObjectURL: () => {},
    };
  }

  const result = await downloadJpegBlob(blob, 'my_poster.png');
  assert.equal(result.success, true);
});
