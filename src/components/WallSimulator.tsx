/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { Sun, Layers, Palette, Check } from 'lucide-react';
import { PosterItem } from '../types';
import { getPaperDimensions, PrintVerdict } from '../utils/printLogic';

interface WallSimulatorProps {
  item: PosterItem | null;
  verdict: PrintVerdict | null;
  theme?: 'light' | 'dark';
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
}

function lerpColor(hexA: string, hexB: string, t: number): string {
  const clampedT = Math.min(1, Math.max(0, t));
  const [rA, gA, bA] = hexToRgb(hexA);
  const [rB, gB, bB] = hexToRgb(hexB);
  const r = Math.round(rA + (rB - rA) * clampedT);
  const g = Math.round(gA + (gB - gA) * clampedT);
  const b = Math.round(bA + (bB - bA) * clampedT);
  return `rgb(${r}, ${g}, ${b})`;
}

export const WallSimulator: React.FC<WallSimulatorProps> = ({ item, verdict, theme = 'light' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 5 Wall Finish interactive swatches per design specification
  const wallColors = [
    { name: 'Light Neutral', color: '#F3F4F6', isLight: true },
    { name: 'Warm Sand', color: '#E5E0D8', isLight: true },
    { name: 'Sage Green', color: '#B5C0B7', isLight: true },
    { name: 'Slate Navy', color: '#1E293B', isLight: false },
    { name: 'Terracotta Accent', color: '#C27863', isLight: false },
  ];

  // Default wall color: Light Neutral for Light mode, Slate Navy for Dark mode
  const [wallColor, setWallColor] = useState<string>(theme === 'dark' ? '#1E293B' : '#F3F4F6');
  const [showRulerGuides, setShowRulerGuides] = useState<boolean>(true);
  const [hasSpotlight, setHasSpotlight] = useState<boolean>(true);

  // Smooth interpolation state stored in refs to allow fluid requestAnimationFrame transitions
  const currentRgbRef = useRef<[number, number, number]>(hexToRgb(wallColor));
  const currentSpotlightRef = useRef<number>(hasSpotlight ? 1 : 0);
  const currentGuidesRef = useRef<number>(showRulerGuides ? 1 : 0);
  const animFrameRef = useRef<number | null>(null);

  // Sync default wall color when theme prop changes
  useEffect(() => {
    if (theme === 'light' && wallColor === '#1E293B') {
      setWallColor('#F3F4F6');
    } else if (theme === 'dark' && wallColor === '#F3F4F6') {
      setWallColor('#1E293B');
    }
  }, [theme]);

  const selectedSwatch = wallColors.find((w) => w.color.toLowerCase() === wallColor.toLowerCase()) || {
    name: 'Custom',
    color: wallColor,
    isLight: true,
  };

  // Main Canvas Render function accepting animated RGB, spotlight level, and guide level
  const drawScene = (
    rgb: [number, number, number],
    spotlightLevel: number,
    guidesLevel: number
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1000;
    const height = 640;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const scale = 2.4;
    const floorY = height - 55;

    const [r, g, b] = rgb;
    const luminance = Math.min(1, Math.max(0, (0.299 * r + 0.587 * g + 0.114 * b) / 255));
    const isLightWall = luminance > 0.52;

    // 1. Draw Wall Background with interpolated RGB
    ctx.fillStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    ctx.fillRect(0, 0, width, floorY);

    // Subtle Gallery Spotlight from ceiling onto poster
    if (spotlightLevel > 0.005) {
      const grad = ctx.createRadialGradient(
        width * 0.45,
        0,
        15,
        width * 0.45,
        floorY * 0.45,
        width * 0.6
      );
      const topAlpha = (0.28 + (0.45 - 0.28) * luminance) * spotlightLevel;
      const midAlpha = (0.09 + (0.15 - 0.09) * luminance) * spotlightLevel;
      grad.addColorStop(0, `rgba(255, 255, 255, ${topAlpha})`);
      grad.addColorStop(0.5, `rgba(255, 255, 255, ${midAlpha})`);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, floorY);
    }

    // 2. Floor (Architectural Hardwood / Polished Concrete)
    const floorGrad = ctx.createLinearGradient(0, floorY, 0, height);
    floorGrad.addColorStop(0, lerpColor('#11141a', '#e2e8f0', luminance));
    floorGrad.addColorStop(1, lerpColor('#090b0e', '#cbd5e1', luminance));
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, floorY, width, height - floorY);

    // Floor Baseboard molding (Skirting board)
    ctx.fillStyle = lerpColor('#22262e', '#d1d5db', luminance);
    ctx.fillRect(0, floorY - 14, width, 14);
    ctx.fillStyle = lerpColor('#333842', '#cbd5e1', luminance);
    ctx.fillRect(0, floorY - 14, width, 2);

    // 3. Contemporary Scandinavian Architectural Credenza
    const credenzaRealW = 170;
    const credenzaRealH = 52;
    const credenzaLegsH = 14 * scale;
    const credenzaW = credenzaRealW * scale;
    const credenzaH = credenzaRealH * scale;
    const credenzaX = width * 0.17;
    const credenzaY = floorY - credenzaH;

    // Floor ambient occlusion shadow under credenza
    const shadowGrad = ctx.createRadialGradient(
      credenzaX + credenzaW / 2,
      floorY,
      20,
      credenzaX + credenzaW / 2,
      floorY,
      credenzaW * 0.55
    );
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
    shadowGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.15)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(credenzaX + credenzaW / 2, floorY + 2, credenzaW * 0.52, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Credenza Slim Steel Legs (Matte Black with brass feet)
    ctx.fillStyle = lerpColor('#0f1115', '#334155', luminance);
    const legW = 5;
    const legInset = 35;
    ctx.fillRect(credenzaX + legInset, floorY - credenzaLegsH, legW, credenzaLegsH);
    ctx.fillRect(credenzaX + credenzaW / 2 - legW / 2, floorY - credenzaLegsH, legW, credenzaLegsH);
    ctx.fillRect(credenzaX + credenzaW - legInset - legW, floorY - credenzaLegsH, legW, credenzaLegsH);

    // Brass foot tips
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(credenzaX + legInset, floorY - 4, legW, 4);
    ctx.fillRect(credenzaX + credenzaW / 2 - legW / 2, floorY - 4, legW, 4);
    ctx.fillRect(credenzaX + credenzaW - legInset - legW, floorY - 4, legW, 4);

    // Credenza Cabinet Body
    const cabinetY = credenzaY;
    const cabinetH = credenzaH - credenzaLegsH;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = lerpColor('#20242c', '#ffffff', luminance);
    ctx.beginPath();
    ctx.roundRect(credenzaX, cabinetY, credenzaW, cabinetH, [8, 8, 3, 3]);
    ctx.fill();
    ctx.restore();

    // Cabinet Top Plate
    ctx.fillStyle = lerpColor('#2a303c', '#f1f5f9', luminance);
    ctx.fillRect(credenzaX, cabinetY, credenzaW, 6);
    ctx.fillStyle = lerpColor('#3c4454', '#e2e8f0', luminance);
    ctx.fillRect(credenzaX, cabinetY, credenzaW, 1.5);

    // Subtle Vertical Slatted / Fluted Detail on doors
    const doorCount = 4;
    const doorW = credenzaW / doorCount;
    for (let d = 0; d < doorCount; d++) {
      const dx = credenzaX + d * doorW;
      ctx.strokeStyle = lerpColor('#14171d', '#e2e8f0', luminance);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(dx, cabinetY + 6);
      ctx.lineTo(dx, cabinetY + cabinetH);
      ctx.stroke();

      // Delicate minimalist door pulls
      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.arc(dx + doorW - 12, cabinetY + cabinetH / 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Curated Design Accents on Credenza: Ceramic Vase with Minimalist Botanicals
    const vaseX = credenzaX + 48;
    const vaseY = cabinetY;
    ctx.fillStyle = lerpColor('#c4b5a5', '#d97706', luminance);
    ctx.beginPath();
    ctx.roundRect(vaseX - 10, vaseY - 32, 20, 32, [8, 8, 3, 3]);
    ctx.fill();
    ctx.fillStyle = lerpColor('#b0a08f', '#b45309', luminance);
    ctx.fillRect(vaseX - 6, vaseY - 36, 12, 4);

    // Botanical branch
    ctx.strokeStyle = '#4a5d4e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(vaseX, vaseY - 36);
    ctx.quadraticCurveTo(vaseX - 8, vaseY - 60, vaseX - 16, vaseY - 78);
    ctx.stroke();

    ctx.fillStyle = '#5c7361';
    ctx.beginPath();
    ctx.ellipse(vaseX - 10, vaseY - 52, 6, 3, -0.6, 0, Math.PI * 2);
    ctx.ellipse(vaseX - 16, vaseY - 68, 7, 3.5, -0.8, 0, Math.PI * 2);
    ctx.ellipse(vaseX - 18, vaseY - 80, 5, 2.5, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Architectural Monographs lying flat on right side
    const booksX = credenzaX + credenzaW - 80;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(booksX, cabinetY - 5, 48, 5);
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(booksX + 4, cabinetY - 9, 42, 4);

    // 4. DRAW 170 CM HUMAN SCALE FIGURE (CLEAN UNIVERSAL PICTOGRAM)
    const personH = 170 * scale;
    const personX = width * 0.82;
    const personFeetY = floorY;

    // Floor Contact Shadow beneath feet
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(personX, personFeetY + 2, 28, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // High contrast figure color smoothly interpolated
    const figureColor = lerpColor('#E2E8F0', '#1E293B', luminance);
    ctx.fillStyle = figureColor;

    ctx.save();
    ctx.translate(personX, personFeetY);
    ctx.scale(scale, scale);

    // 4a. HEAD
    const headRadius = 12.5;
    const headCenterY = -170 + headRadius;
    ctx.beginPath();
    ctx.arc(0, headCenterY, headRadius, 0, Math.PI * 2);
    ctx.fill();

    // 4b. TORSO
    const torsoW = 22;
    const torsoTopY = -139;
    const torsoH = 64;
    ctx.beginPath();
    ctx.roundRect(-torsoW / 2, torsoTopY, torsoW, torsoH, [5, 5, 2, 2]);
    ctx.fill();

    // 4c. ARMS
    const armW = 8.5;
    const armSlotGap = 2.5;
    const armLeftX = -(torsoW / 2 + armSlotGap + armW);
    const armRightX = torsoW / 2 + armSlotGap;
    const armH = 64;

    ctx.beginPath();
    ctx.roundRect(armLeftX, torsoTopY, armW, armH, 4.25);
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(armRightX, torsoTopY, armW, armH, 4.25);
    ctx.fill();

    // 4d. LEGS
    const personLegW = 9.2;
    const legCenterGap = 1.8;
    const legTopY = -75;
    const legH = 75;

    ctx.beginPath();
    ctx.roundRect(-(legCenterGap + personLegW), legTopY, personLegW, legH, [0, 0, 2, 2]);
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(legCenterGap, legTopY, personLegW, legH, [0, 0, 2, 2]);
    ctx.fill();

    ctx.restore();

    // 170 cm Architectural Dimension Indicator above head
    if (guidesLevel > 0.005) {
      ctx.save();
      ctx.globalAlpha = guidesLevel;
      const headY = personFeetY - personH;

      ctx.fillStyle = isLightWall ? '#0F172A' : '#F8FAFC';
      ctx.font = '600 11px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('170 cm (5′7″) • Human Scale', personX, headY - 14);

      ctx.strokeStyle = isLightWall ? '#64748B' : '#94A3B8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(personX - 44, headY - 4);
      ctx.lineTo(personX + 44, headY - 4);

      ctx.moveTo(personX - 48, headY - 8);
      ctx.lineTo(personX - 40, headY);
      ctx.moveTo(personX + 40, headY - 8);
      ctx.lineTo(personX + 48, headY);
      ctx.stroke();
      ctx.restore();
    }

    // 5. Draw Scaled Framed Poster
    const dims = item
      ? getPaperDimensions(item.paperSize, item.orientation)
      : { widthInches: 11.69, heightInches: 16.54, widthMm: 297, heightMm: 420 };

    const posterRealWcm = dims.widthMm / 10;
    const posterRealHcm = dims.heightMm / 10;

    const posterCanvasW = posterRealWcm * scale;
    const posterCanvasH = posterRealHcm * scale;

    const posterCenterY = floorY - 145 * scale;
    const posterCenterX = credenzaX + credenzaW / 2;

    const posterX = posterCenterX - posterCanvasW / 2;
    const posterY = posterCenterY - posterCanvasH / 2;

    // Poster Frame Drop Shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 12;

    // Gallery frame border
    const frameBorder = 6;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(
      posterX - frameBorder,
      posterY - frameBorder,
      posterCanvasW + frameBorder * 2,
      posterCanvasH + frameBorder * 2,
      4
    );
    ctx.fill();
    ctx.restore();

    // White mat border (passepartout)
    const matBorder = Math.max(4, Math.round(posterCanvasW * 0.03));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(posterX, posterY, posterCanvasW, posterCanvasH);

    // Draw artwork inside mat
    const innerX = posterX + matBorder;
    const innerY = posterY + matBorder;
    const innerW = posterCanvasW - matBorder * 2;
    const innerH = posterCanvasH - matBorder * 2;

    if (item && item.previewCanvas) {
      const { f, cx, cy } = item.transform;
      const drawW = f * innerW;
      const drawH = drawW * (item.height / item.width);

      ctx.save();
      ctx.beginPath();
      ctx.rect(innerX, innerY, innerW, innerH);
      ctx.clip();

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        item.previewCanvas,
        innerX + cx * innerW - drawW / 2,
        innerY + cy * innerH - drawH / 2,
        drawW,
        drawH
      );

      // Subtle museum anti-reflective glass sheen
      const glassGrad = ctx.createLinearGradient(innerX, innerY, innerX + innerW, innerY + innerH);
      glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
      glassGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.04)');
      glassGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = glassGrad;
      ctx.fillRect(innerX, innerY, innerW, innerH);

      ctx.restore();
    } else {
      const artGrad = ctx.createLinearGradient(innerX, innerY, innerX + innerW, innerY + innerH);
      artGrad.addColorStop(0, '#2563eb');
      artGrad.addColorStop(0.5, '#ef4444');
      artGrad.addColorStop(1, '#f59e0b');
      ctx.fillStyle = artGrad;
      ctx.fillRect(innerX, innerY, innerW, innerH);
    }

    // Ruler Guides & Dimension Labels
    if (guidesLevel > 0.005) {
      ctx.save();
      ctx.globalAlpha = guidesLevel;
      ctx.fillStyle = isLightWall ? '#0F172A' : '#F8FAFC';
      ctx.font = '600 12px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'center';

      const label = `${item?.paperSize || 'A3'} (${Math.round(dims.widthMm)} × ${Math.round(
        dims.heightMm
      )} mm)`;
      ctx.fillText(label, posterCenterX, posterY - 14);

      // Eye-level hanging guideline
      ctx.strokeStyle = isLightWall ? 'rgba(37, 99, 235, 0.45)' : 'rgba(0, 220, 255, 0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(posterX - 40, posterCenterY);
      ctx.lineTo(posterX + posterCanvasW + 40, posterCenterY);
      ctx.stroke();

      ctx.fillStyle = isLightWall ? '#2563EB' : '#38bdf8';
      ctx.font = '600 11px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Gallery 145cm Eye Level', posterX + posterCanvasW + 46, posterCenterY + 4);
      ctx.restore();
    }
  };

  // Smooth animation effect on wallColor, hasSpotlight, showRulerGuides, or item change
  useEffect(() => {
    const targetRgb = hexToRgb(wallColor);
    const targetSpotlight = hasSpotlight ? 1 : 0;
    const targetGuides = showRulerGuides ? 1 : 0;

    const startRgb = [...currentRgbRef.current] as [number, number, number];
    const startSpotlight = currentSpotlightRef.current;
    const startGuides = currentGuidesRef.current;

    const startTime = performance.now();
    const duration = 400; // 400ms smooth transition curve

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      // Cosine S-curve easing for ultra-smooth optical morphing
      const ease = 0.5 - 0.5 * Math.cos(t * Math.PI);

      const r = startRgb[0] + (targetRgb[0] - startRgb[0]) * ease;
      const g = startRgb[1] + (targetRgb[1] - startRgb[1]) * ease;
      const b = startRgb[2] + (targetRgb[2] - startRgb[2]) * ease;
      currentRgbRef.current = [r, g, b];

      const spot = startSpotlight + (targetSpotlight - startSpotlight) * ease;
      currentSpotlightRef.current = spot;

      const guides = startGuides + (targetGuides - startGuides) * ease;
      currentGuidesRef.current = guides;

      drawScene([r, g, b], spot, guides);

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        animFrameRef.current = null;
      }
    };

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [wallColor, hasSpotlight, showRulerGuides, item]);

  const isLightMode = theme === 'light';

  return (
    <div
      className={`h-full flex flex-col select-none transition-colors duration-300 ${
        isLightMode ? 'bg-[#F8FAFC] text-[#0F172A]' : 'bg-[#0D0F12] text-[#F8FAFC]'
      }`}
    >
      {/* Simulation Toolbar */}
      <div
        className={`flex flex-wrap items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 border-b text-xs gap-2 sm:gap-3 transition-colors duration-300 ${
          isLightMode ? 'bg-[#FFFFFF] border-[#E2E8F0]' : 'bg-[#16191E] border-[#262B33]'
        }`}
      >
        {/* Wall Finish 5-Swatch Selector */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="flex items-center space-x-1 font-medium">
            <Palette className="w-4 h-4 text-[#2563EB]" />
            <span className={isLightMode ? 'text-[#0F172A]' : 'text-[#F8FAFC]'}>Wall:</span>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-2">
            {wallColors.map((wc) => {
              const isSelected = wallColor.toLowerCase() === wc.color.toLowerCase();
              return (
                <button
                  key={wc.name}
                  type="button"
                  onClick={() => setWallColor(wc.color)}
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full transition-all duration-300 cursor-pointer flex items-center justify-center relative shadow-xs ${
                    isSelected
                      ? 'ring-2 ring-offset-2 ring-[#2563EB] scale-110 shadow-sm'
                      : 'hover:scale-105 opacity-85 hover:opacity-100 border border-black/10'
                  }`}
                  style={{ backgroundColor: wc.color }}
                  title={`${wc.name} (${wc.color})`}
                >
                  {isSelected && (
                    <Check
                      className={`w-3 sm:w-3.5 h-3 sm:h-3.5 ${wc.isLight ? 'text-[#0F172A]' : 'text-white'}`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <span
            className={`text-[11px] font-medium hidden md:inline px-2 py-0.5 rounded-full transition-colors duration-300 ${
              isLightMode ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {selectedSwatch.name}
          </span>
        </div>

        {/* View Controls */}
        <div className="flex items-center space-x-1.5 sm:space-x-2.5">
          <button
            type="button"
            onClick={() => setHasSpotlight(!hasSpotlight)}
            className={`flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-medium transition-all duration-200 cursor-pointer shadow-xs ${
              hasSpotlight
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 font-semibold'
                : isLightMode
                ? 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-800'
                : 'bg-[#21262D] border-[#30363D] text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden xs:inline">Spotlight</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRulerGuides(!showRulerGuides)}
            className={`flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-medium transition-all duration-200 cursor-pointer shadow-xs ${
              showRulerGuides
                ? 'bg-blue-500/10 border-blue-500/30 text-[#2563EB] dark:text-[#38bdf8] font-semibold'
                : isLightMode
                ? 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-800'
                : 'bg-[#21262D] border-[#30363D] text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[#2563EB]" />
            <span className="hidden xs:inline">Guides</span>
          </button>
        </div>
      </div>

      {/* Scaled Wall Canvas Container */}
      <div
        className={`flex-1 flex items-center justify-center p-2 sm:p-6 overflow-hidden transition-colors duration-300 ${
          isLightMode ? 'bg-[#F1F5F9]' : 'bg-[#111317]'
        }`}
      >
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full rounded-2xl shadow-xl border object-contain transition-all duration-300"
          style={{
            borderColor: isLightMode ? '#E2E8F0' : '#262B33',
          }}
        />
      </div>

      {/* Scale Context Info Bar */}
      <div
        className={`px-5 py-2.5 flex items-center justify-between text-xs font-medium border-t transition-colors duration-300 ${
          isLightMode
            ? 'bg-[#FFFFFF] border-[#E2E8F0] text-[#64748B]'
            : 'bg-[#16191E] border-[#262B33] text-[#94A3B8]'
        }`}
      >
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
          <span>Architectural Scale 1:10 • Standard 170 cm Observer</span>
        </div>
        <span className="text-[#2563EB] dark:text-[#38bdf8] font-semibold">
          {item ? `${item.paperSize} Poster hung at 145 cm standard eye level` : 'No poster loaded'}
        </span>
      </div>
    </div>
  );
};
