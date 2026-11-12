/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Checks if the current browser environment is a mobile device or touch tablet
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints != null && navigator.maxTouchPoints > 2) ||
    (typeof window !== 'undefined' && window.innerWidth < 768)
  );
}

/**
 * Downloads a JPEG Blob reliably across desktop and mobile devices.
 *
 * 1. Enforces image/jpeg MIME type and .jpg file extension.
 * 2. On mobile devices, leverages the native Web Share API so users can directly tap
 *    "Save Image" to their iOS Camera Roll / Android Photos library.
 * 3. Falls back to DOM-attached anchor download for desktop and supported browsers.
 * 4. Generates a data URL for instant mobile preview and touch-to-save fallback.
 */
export async function downloadJpegBlob(
  blob: Blob,
  rawFilename: string
): Promise<{ success: boolean; dataUrl?: string; usedShare?: boolean; error?: string }> {
  try {
    // Ensure filename ends strictly with .jpg
    const safeName = rawFilename.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_');
    const filename = `${safeName}.jpg`;

    // Ensure blob is strictly typed as image/jpeg
    const jpegBlob = blob.type === 'image/jpeg' ? blob : new Blob([blob], { type: 'image/jpeg' });
    const file = new File([jpegBlob], filename, { type: 'image/jpeg', lastModified: Date.now() });

    // 1. Mobile Web Share API: Native "Save Image" to Photos / Files
    if (isMobileDevice() && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: filename,
            text: `300 DPI Poster: ${filename}`,
          });
          return { success: true, usedShare: true };
        }
      } catch (shareErr: any) {
        // User cancelled share sheet (AbortError), which is a normal cancellation
        if (shareErr.name === 'AbortError') {
          return { success: true, usedShare: true };
        }
        console.warn('Web Share failed, falling back to download link:', shareErr);
      }
    }

    // 2. Browser Anchor Download with DOM attachment
    const downloadUrl = URL.createObjectURL(jpegBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = downloadUrl;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    }, 20000);

    // 3. Generate data URL for mobile preview fallback
    let dataUrl: string | undefined;
    if (isMobileDevice()) {
      dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(jpegBlob);
      });
    }

    return { success: true, dataUrl, usedShare: false };
  } catch (err: any) {
    console.error('downloadJpegBlob error:', err);
    return { success: false, error: err?.message || 'Download failed' };
  }
}
