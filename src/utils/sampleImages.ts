/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Generates high-resolution sample posters client-side for testing
 */
export async function createSamplePosterBlob(
  type: 'bauhaus' | 'minimalist' | 'cyberpunk' | 'wave'
): Promise<{ file: File; width: number; height: number }> {
  const canvas = document.createElement('canvas');

  let width = 3600;
  let height = 5400; // 300 DPI for 12x18 inch (standard poster)

  if (type === 'cyberpunk') {
    width = 4200;
    height = 5940; // ~300 DPI for A2
  } else if (type === 'minimalist') {
    width = 2480;
    height = 3508; // Exact A4 @ 300 DPI
  } else if (type === 'wave') {
    width = 3500;
    height = 4950; // Near A3 @ 300 DPI
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create 2D canvas context');

  // Background
  if (type === 'bauhaus') {
    // Warm Bauhaus ivory
    ctx.fillStyle = '#f5efe0';
    ctx.fillRect(0, 0, width, height);

    // Deep geometric shapes
    ctx.fillStyle = '#d9381e'; // Bauhaus vermilion
    ctx.beginPath();
    ctx.arc(width * 0.45, height * 0.35, width * 0.32, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e3888'; // Bauhaus cobalt
    ctx.fillRect(width * 0.15, height * 0.48, width * 0.7, height * 0.18);

    ctx.fillStyle = '#e8a820'; // Bauhaus ochre
    ctx.beginPath();
    ctx.moveTo(width * 0.72, height * 0.2);
    ctx.lineTo(width * 0.9, height * 0.45);
    ctx.lineTo(width * 0.54, height * 0.45);
    ctx.closePath();
    ctx.fill();

    // Charcoal structure lines
    ctx.strokeStyle = '#1b1b1b';
    ctx.lineWidth = width * 0.012;
    ctx.beginPath();
    ctx.moveTo(width * 0.1, height * 0.72);
    ctx.lineTo(width * 0.9, height * 0.72);
    ctx.stroke();

    // Clean typography
    ctx.fillStyle = '#1b1b1b';
    ctx.font = `900 ${width * 0.07}px system-ui, sans-serif`;
    ctx.fillText('BAUHAUS', width * 0.1, height * 0.82);

    ctx.font = `600 ${width * 0.024}px system-ui, sans-serif`;
    ctx.fillText('AUSSTELLUNG WEIMAR • STAATLICHES BAUHAUS 1923', width * 0.1, height * 0.88);
    ctx.fillText('EDITION NO. 04 / 300 DPI ARCHIVAL PROOF', width * 0.1, height * 0.92);

  } else if (type === 'cyberpunk') {
    // Dark void background with neon grid
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#0a0a14');
    grad.addColorStop(0.65, '#120d26');
    grad.addColorStop(1, '#2c0d38');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Glowing synthwave sun
    const sunGrad = ctx.createLinearGradient(0, height * 0.2, 0, height * 0.58);
    sunGrad.addColorStop(0, '#ff007f');
    sunGrad.addColorStop(0.5, '#ff7700');
    sunGrad.addColorStop(1, '#ffdd00');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.4, width * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Horizontal sun blind slices
    ctx.fillStyle = '#0a0a14';
    for (let y = height * 0.38; y < height * 0.58; y += height * 0.018) {
      const sliceH = (y - height * 0.36) * 0.22;
      ctx.fillRect(0, y, width, sliceH);
    }

    // Grid lines on perspective ground
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = width * 0.003;
    for (let i = 0; i <= 20; i++) {
      const x = (width * i) / 20;
      ctx.beginPath();
      ctx.moveTo(width * 0.5, height * 0.55);
      ctx.lineTo(x * 2 - width * 0.5, height);
      ctx.stroke();
    }

    ctx.fillStyle = '#00f0ff';
    ctx.font = `800 ${width * 0.065}px system-ui, sans-serif`;
    ctx.fillText('NEO TOKYO 2099', width * 0.08, height * 0.14);

  } else if (type === 'minimalist') {
    // Nordic modern sage & stone
    ctx.fillStyle = '#eae6df';
    ctx.fillRect(0, 0, width, height);

    // Organic arch
    ctx.fillStyle = '#4a5b52';
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.48, width * 0.34, Math.PI, 0, false);
    ctx.lineTo(width * 0.84, height * 0.72);
    ctx.lineTo(width * 0.16, height * 0.72);
    ctx.closePath();
    ctx.fill();

    // Terracotta sun
    ctx.fillStyle = '#c86d51';
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.28, width * 0.14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#262927';
    ctx.font = `300 ${width * 0.045}px system-ui, sans-serif`;
    ctx.fillText('K O P E N H A G E N', width * 0.22, height * 0.86);

  } else {
    // Great Wave aesthetic
    ctx.fillStyle = '#f0ebe1';
    ctx.fillRect(0, 0, width, height);

    const grad = ctx.createLinearGradient(0, height * 0.3, 0, height);
    grad.addColorStop(0, '#1c4966');
    grad.addColorStop(0.5, '#226089');
    grad.addColorStop(1, '#0c2233');
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(0, height * 0.55);
    ctx.bezierCurveTo(width * 0.3, height * 0.4, width * 0.4, height * 0.7, width * 0.7, height * 0.45);
    ctx.bezierCurveTo(width * 0.85, height * 0.3, width * 0.95, height * 0.5, width, height * 0.6);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    // Foam crests
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(width * 0.7, height * 0.45, width * 0.08, 0, Math.PI * 2);
    ctx.arc(width * 0.62, height * 0.48, width * 0.06, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1c262e';
    ctx.font = `700 ${width * 0.05}px serif`;
    ctx.fillText('冨嶽三十六景', width * 0.08, height * 0.18);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/jpeg', 0.96);
  });

  const file = new File([blob], `${type}_fine_art_poster.jpg`, { type: 'image/jpeg' });
  return { file, width, height };
}
