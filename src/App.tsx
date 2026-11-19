/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import { VsCodeHeader } from './components/VsCodeHeader';
import { QueueSidebar } from './components/QueueSidebar';
import { EditorCanvas } from './components/EditorCanvas';
import { PrintVerdictPanel } from './components/PrintVerdictPanel';
import { WallSimulator } from './components/WallSimulator';
import { InspectionModal } from './components/InspectionModal';
import { SecuritySandboxModal } from './components/SecuritySandboxModal';
import { SamplePostersModal } from './components/SamplePostersModal';
import { PosterUpscalerUI } from './components/PosterUpscalerUI';
import { AdjustPosterSizeModal } from './components/AdjustPosterSizeModal';
import { ExportModal } from './components/ExportModal';
import { ActiveTab, PosterItem } from './types';
import {
  calculatePrintVerdict,
  getPaperDimensions,
  calculatePresetFit,
  sanitizeFileName,
  validateImageFileHeader,
  injectJfifDpiHeader,
  PrintVerdict,
} from './utils/printLogic';
import { createSamplePosterBlob } from './utils/sampleImages';
import { downloadJpegBlob, isMobileDevice } from './utils/downloadHelper';
import { MobileSaveImageModal } from './components/MobileSaveImageModal';

interface HistorySnapshot {
  itemId: string;
  transform: { f: number; cx: number; cy: number };
  paperSize: string;
  orientation: 'portrait' | 'landscape';
  width: number;
  height: number;
  file: File | Blob;
  previewCanvas: HTMLCanvasElement;
}

export default function App() {
  const [items, setItems] = useState<PosterItem[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('editor');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  // Modals
  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [isSampleOpen, setIsSampleOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isUpscalerOpen, setIsUpscalerOpen] = useState(false);
  const [isAdjustSizeOpen, setIsAdjustSizeOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [mobileModalData, setMobileModalData] = useState<{
    isOpen: boolean;
    imageUrl: string;
    filename: string;
    blob: Blob | null;
  }>({
    isOpen: false,
    imageUrl: '',
    filename: '',
    blob: null,
  });

  // History stack for Undo / Redo (Ctrl+Z / Ctrl+Y)
  const [historyStack, setHistoryStack] = useState<HistorySnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgressText, setExportProgressText] = useState('');
  // Toast: slides in, holds, then fades out (stays mounted during the exit animation)
  const TOAST_HOLD_MS = 3200;
  const TOAST_EXIT_MS = 250;
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);
  const [toastLeaving, setToastLeaving] = useState(false);
  const toastTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const showToast = useCallback((msg: string) => {
    toastTimersRef.current.forEach(clearTimeout);
    setToast({ id: Date.now() + Math.random(), msg });
    setToastLeaving(false);
    toastTimersRef.current = [
      setTimeout(() => setToastLeaving(true), TOAST_HOLD_MS),
      setTimeout(() => setToast(null), TOAST_HOLD_MS + TOAST_EXIT_MS),
    ];
  }, []);
  useEffect(() => () => toastTimersRef.current.forEach(clearTimeout), []);

  const currentItem = items.find((i) => i.id === currentId) || (items.length > 0 ? items[0] : null);

  // Compute live verdict for current item
  const currentVerdict: PrintVerdict | null = currentItem
    ? (() => {
        const dims = getPaperDimensions(
          currentItem.paperSize,
          currentItem.orientation,
          currentItem.customWidthMm && currentItem.customHeightMm
            ? { widthMm: currentItem.customWidthMm, heightMm: currentItem.customHeightMm }
            : undefined
        );
        return calculatePrintVerdict(
          currentItem.width,
          currentItem.height,
          dims.widthInches,
          dims.heightInches,
          currentItem.transform.f,
          currentItem.transform.cx,
          currentItem.transform.cy
        );
      })()
    : null;

  // Process and ingest an image file with strict security header validation
  const processImageFile = useCallback(
    async (file: File | Blob, customName?: string): Promise<PosterItem | null> => {
      try {
        const buffer = await file.arrayBuffer();
        const headerCheck = validateImageFileHeader(buffer);
        if (!headerCheck.valid) {
          showToast(`Security Warning: ${customName || (file instanceof File ? file.name : 'File')} was rejected. ${headerCheck.error}`);
          return null;
        }

        const bmp = await createImageBitmap(new Blob([buffer], { type: headerCheck.mime }));
        const w = bmp.width;
        const h = bmp.height;

        // Render preview canvas (bounded to max 1600px for high performance in DOM)
        const maxPrev = 1600;
        const scale = Math.min(1, maxPrev / Math.max(w, h));
        const prevW = Math.max(1, Math.round(w * scale));
        const prevH = Math.max(1, Math.round(h * scale));

        const prevCanvas = document.createElement('canvas');
        prevCanvas.width = prevW;
        prevCanvas.height = prevH;
        const ctx = prevCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, prevW, prevH);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(bmp, 0, 0, prevW, prevH);
        }

        // Generate small thumbnail for queue list
        const thumbCanvas = document.createElement('canvas');
        const thumbMax = 200;
        const thumbScale = Math.min(1, thumbMax / Math.max(w, h));
        thumbCanvas.width = Math.max(1, Math.round(w * thumbScale));
        thumbCanvas.height = Math.max(1, Math.round(h * thumbScale));
        const tctx = thumbCanvas.getContext('2d');
        if (tctx) {
          tctx.drawImage(bmp, 0, 0, thumbCanvas.width, thumbCanvas.height);
        }
        const thumbnailUrl = thumbCanvas.toDataURL('image/jpeg', 0.85);

        bmp.close(); // Clean up native bitmap memory immediately

        const orientation = w >= h ? 'landscape' : 'portrait';
        const defaultPaper = 'A3';
        const dims = getPaperDimensions(defaultPaper, orientation);
        const preset = calculatePresetFit('bleed', w, h, dims.widthInches, dims.heightInches);

        const safeRawName = customName || (file instanceof File ? file.name : 'poster_artwork.jpg');
        const cleanName = sanitizeFileName(safeRawName);

        const newItem: PosterItem = {
          id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: cleanName,
          file,
          width: w,
          height: h,
          thumbnailUrl,
          previewCanvas: prevCanvas,
          paperSize: defaultPaper,
          orientation,
          zoom: preset.f,
          transform: preset,
          isSavedToReady: false,
          version: 1,
          fileSizeBytes: buffer.byteLength,
          mimeType: headerCheck.mime || 'image/jpeg',
        };

        return newItem;
      } catch (err: any) {
        showToast(`Failed to parse image: ${err?.message || 'Unsupported format'}`);
        return null;
      }
    },
    [showToast]
  );

  // Ingest batch files
  const handleAddFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      const newItems: PosterItem[] = [];
      for (const f of files) {
        const item = await processImageFile(f);
        if (item) newItems.push(item);
      }

      if (newItems.length > 0) {
        setItems((prev) => [...prev, ...newItems]);
        if (!currentId) {
          setCurrentId(newItems[0].id);
        }
        showToast(`Loaded ${newItems.length} image${newItems.length > 1 ? 's' : ''} into queue.`);
      }
    },
    [currentId, processImageFile, showToast]
  );

  // Ingest a procedural sample poster
  const handleLoadSample = useCallback(
    async (type: 'bauhaus' | 'cyberpunk' | 'minimalist' | 'wave') => {
      try {
        const { file, width, height } = await createSamplePosterBlob(type);
        const item = await processImageFile(file, file.name);
        if (item) {
          sampleIdsRef.current.add(item.id);
          setItems((prev) => [...prev, item]);
          setCurrentId(item.id);
          showToast(`Loaded sample poster: ${item.name}`);
        }
      } catch (err) {
        showToast('Error generating sample poster');
      }
    },
    [processImageFile, showToast]
  );

  // Ingest all 4 samples for instant batch testing
  const handleLoadAllSamples = useCallback(async () => {
    const types = ['bauhaus', 'cyberpunk', 'minimalist', 'wave'] as const;
    const added: PosterItem[] = [];
    for (const t of types) {
      const { file } = await createSamplePosterBlob(t);
      const item = await processImageFile(file, file.name);
      if (item) {
        sampleIdsRef.current.add(item.id);
        added.push(item);
      }
    }
    if (added.length > 0) {
      setItems((prev) => [...prev, ...added]);
      setCurrentId(added[0].id);
      showToast('Loaded 4 archival sample posters into batch queue.');
    }
  }, [processImageFile, showToast]);

  const initialSeedRef = useRef(false);

  // Demo posters (auto-loaded or from Samples) don't count as unsaved work until edited
  const sampleIdsRef = useRef<Set<string>>(new Set());
  const hasUnsavedWork = items.some((i) => !sampleIdsRef.current.has(i.id) || i.version > 1);

  // Nothing is persisted, so ask before a refresh/close would discard uploaded or edited posters
  useEffect(() => {
    if (!hasUnsavedWork) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // required by some browsers to show the native prompt
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedWork]);

  // Initial load: seed one sample poster ONCE on mount so app is immediately alive on initial boot.
  // CRITICAL FIX: Does NOT respawn if the user deletes the poster from the queue!
  useEffect(() => {
    if (!initialSeedRef.current && items.length === 0) {
      initialSeedRef.current = true;
      handleLoadSample('bauhaus');
    }
  }, [handleLoadSample, items.length]);

  // Update item transforms or settings
  const handleUpdateItem = useCallback((updated: PosterItem) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }, []);

  // History snapshot recording
  const recordHistorySnapshot = useCallback(() => {
    if (!currentItem) return;
    const snap: HistorySnapshot = {
      itemId: currentItem.id,
      transform: { ...currentItem.transform },
      paperSize: currentItem.paperSize,
      orientation: currentItem.orientation,
      width: currentItem.width,
      height: currentItem.height,
      file: currentItem.file,
      previewCanvas: currentItem.previewCanvas,
    };

    setHistoryStack((prev) => {
      const sliced = prev.slice(0, historyIndex + 1);
      const last = sliced[sliced.length - 1];
      if (
        last &&
        last.itemId === snap.itemId &&
        last.transform.f === snap.transform.f &&
        last.transform.cx === snap.transform.cx &&
        last.transform.cy === snap.transform.cy &&
        last.paperSize === snap.paperSize &&
        last.orientation === snap.orientation &&
        last.width === snap.width &&
        last.height === snap.height
      ) {
        return prev;
      }
      const updated = [...sliced, snap].slice(-40);
      setHistoryIndex(updated.length - 1);
      return updated;
    });
  }, [currentItem, historyIndex]);

  // Handler to readjust poster size, change paper standard or custom dimensions, and refit artwork
  const handleApplyNewSize = useCallback(
    (
      newPaperSize: string,
      newOrientation: 'portrait' | 'landscape',
      fitMode: 'bleed' | 'fit' | 'keep',
      customDims?: { widthMm: number; heightMm: number }
    ) => {
      if (!currentItem) return;
      const dims = getPaperDimensions(newPaperSize, newOrientation, customDims);
      let newTransform = currentItem.transform;

      if (fitMode === 'bleed') {
        newTransform = calculatePresetFit(
          'bleed',
          currentItem.width,
          currentItem.height,
          dims.widthInches,
          dims.heightInches
        );
      } else if (fitMode === 'fit') {
        newTransform = calculatePresetFit(
          'contain',
          currentItem.width,
          currentItem.height,
          dims.widthInches,
          dims.heightInches
        );
      }

      const updated: PosterItem = {
        ...currentItem,
        paperSize: newPaperSize,
        orientation: newOrientation,
        customWidthMm: customDims?.widthMm,
        customHeightMm: customDims?.heightMm,
        transform: newTransform,
        zoom: newTransform.f,
        version: currentItem.version + 1,
      };

      handleUpdateItem(updated);
      showToast(
        `Poster size set to ${
          newPaperSize === 'Custom' ? 'Custom Dimensions' : newPaperSize
        } (${dims.widthMm} × ${dims.heightMm} mm)`
      );
      setTimeout(() => recordHistorySnapshot(), 50);
    },
    [currentItem, handleUpdateItem, recordHistorySnapshot, showToast]
  );

  // Seed initial history when selecting an item if not yet tracked
  useEffect(() => {
    if (currentItem && (historyStack.length === 0 || historyStack[0].itemId !== currentItem.id)) {
      const initialSnap: HistorySnapshot = {
        itemId: currentItem.id,
        transform: { ...currentItem.transform },
        paperSize: currentItem.paperSize,
        orientation: currentItem.orientation,
        width: currentItem.width,
        height: currentItem.height,
        file: currentItem.file,
        previewCanvas: currentItem.previewCanvas,
      };
      setHistoryStack([initialSnap]);
      setHistoryIndex(0);
    }
  }, [currentItem?.id]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      const target = historyStack[prevIdx];
      setHistoryIndex(prevIdx);

      setItems((prev) =>
        prev.map((i) =>
          i.id === target.itemId
            ? {
                ...i,
                transform: { ...target.transform },
                paperSize: target.paperSize,
                orientation: target.orientation,
                width: target.width,
                height: target.height,
                file: target.file,
                previewCanvas: target.previewCanvas,
                version: i.version + 1,
              }
            : i
        )
      );
      showToast('Undo (Ctrl+Z)');
    }
  }, [historyIndex, historyStack, showToast]);

  const handleRedo = useCallback(() => {
    if (historyIndex < historyStack.length - 1) {
      const nextIdx = historyIndex + 1;
      const target = historyStack[nextIdx];
      setHistoryIndex(nextIdx);

      setItems((prev) =>
        prev.map((i) =>
          i.id === target.itemId
            ? {
                ...i,
                transform: { ...target.transform },
                paperSize: target.paperSize,
                orientation: target.orientation,
                width: target.width,
                height: target.height,
                file: target.file,
                previewCanvas: target.previewCanvas,
                version: i.version + 1,
              }
            : i
        )
      );
      showToast('Redo (Ctrl+Y)');
    }
  }, [historyIndex, historyStack, showToast]);

  // Apply completed upscaler result
  const handleApplyUpscaledItem = useCallback(
    (
      updatedItem: PosterItem,
      upscaledBlob: Blob,
      newCanvas: HTMLCanvasElement,
      newWidth: number,
      newHeight: number
    ) => {
      setItems((prev) => prev.map((i) => (i.id === updatedItem.id ? updatedItem : i)));

      setTimeout(() => {
        const snap: HistorySnapshot = {
          itemId: updatedItem.id,
          transform: { ...updatedItem.transform },
          paperSize: updatedItem.paperSize,
          orientation: updatedItem.orientation,
          width: newWidth,
          height: newHeight,
          file: upscaledBlob,
          previewCanvas: newCanvas,
        };
        setHistoryStack((prev) => {
          const sliced = prev.slice(0, historyIndex + 1);
          const nextStack = [...sliced, snap].slice(-40);
          setHistoryIndex(nextStack.length - 1);
          return nextStack;
        });
      }, 50);

      showToast(`Upscaled to ${newWidth} × ${newHeight} px!`);
    },
    [historyIndex, showToast]
  );

  // Save to ready and move to next
  const handleSaveToReady = useCallback(() => {
    if (!currentItem) return;
    const updated = { ...currentItem, isSavedToReady: true, version: currentItem.version + 1 };
    handleUpdateItem(updated);

    // Look for next pending item
    const remainingPending = items.filter((i) => !i.isSavedToReady && i.id !== currentItem.id);
    if (remainingPending.length > 0) {
      setCurrentId(remainingPending[0].id);
      showToast('Saved to Ready. Loaded next poster.');
    } else {
      showToast('Saved to Ready. All posters in queue are adjusted!');
    }
  }, [currentItem, handleUpdateItem, items, showToast]);

  // Remove item from queue
  const handleRemoveItem = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setItems((prev) => {
        const nextList = prev.filter((i) => i.id !== id);
        if (currentId === id) {
          const nextItem = nextList.find((i) => !i.isSavedToReady) || nextList[0] || null;
          setCurrentId(nextItem ? nextItem.id : null);
        }
        return nextList;
      });
      showToast('Removed poster from queue.');
    },
    [currentId, showToast]
  );

  // Render poster safely onto offscreen canvas with mobile memory protection
  const renderPosterToJpegBlob = useCallback(async (targetItem: PosterItem) => {
    const dims = getPaperDimensions(
      targetItem.paperSize,
      targetItem.orientation,
      targetItem.customWidthMm && targetItem.customHeightMm
        ? { widthMm: targetItem.customWidthMm, heightMm: targetItem.customHeightMm }
        : undefined
    );
    let targetW = Math.round(dims.widthInches * 300);
    let targetH = Math.round(dims.heightInches * 300);

    // Mobile / hardware boundary safety:
    // Mobile browsers (Safari/Chrome) cap canvas memory at 16MP (4096px).
    const isMobile =
      typeof navigator !== 'undefined' &&
      (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.innerWidth < 768);
    const MAX_DIM = isMobile ? 4096 : 8192;
    const MAX_AREA = isMobile ? 15000000 : 70000000;

    if (targetW > MAX_DIM || targetH > MAX_DIM || targetW * targetH > MAX_AREA) {
      const scaleFactor = Math.min(
        MAX_DIM / Math.max(targetW, targetH),
        Math.sqrt(MAX_AREA / (targetW * targetH))
      );
      targetW = Math.max(800, Math.round(targetW * scaleFactor));
      targetH = Math.max(800, Math.round(targetH * scaleFactor));
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = targetW;
    exportCanvas.height = targetH;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) throw new Error('Could not create offscreen canvas context on device');

    // Clean white paper base
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);

    // Safely decode original image with fallback for mobile WebKit
    let sourceImage: CanvasImageSource;
    try {
      sourceImage = await createImageBitmap(targetItem.file);
    } catch {
      sourceImage = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        const objUrl = URL.createObjectURL(targetItem.file);
        img.onload = () => {
          URL.revokeObjectURL(objUrl);
          resolve(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(objUrl);
          reject(new Error('Failed to decode image data'));
        };
        img.src = objUrl;
      });
    }

    const { f, cx, cy } = targetItem.transform;
    const drawW = f * targetW;
    const drawH = drawW * (targetItem.height / targetItem.width);
    const drawX = cx * targetW - drawW / 2;
    const drawY = cy * targetH - drawH / 2;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceImage, drawX, drawY, drawW, drawH);

    if ('close' in sourceImage && typeof (sourceImage as any).close === 'function') {
      (sourceImage as any).close();
    }

    const jpegBlob = await new Promise<Blob | null>((resolve) =>
      exportCanvas.toBlob(resolve, 'image/jpeg', 0.95)
    );
    exportCanvas.width = 0;
    exportCanvas.height = 0; // Release memory

    if (!jpegBlob) throw new Error('JPEG serialization failed on device');

    // Embed 300 DPI JFIF density markers
    const rawBytes = new Uint8Array(await jpegBlob.arrayBuffer());
    const taggedBytes = injectJfifDpiHeader(rawBytes, 300);
    const taggedBlob = new Blob([taggedBytes as unknown as BlobPart], { type: 'image/jpeg' });

    const safeBaseName = targetItem.name.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_');
    const filename = `${safeBaseName}_${targetItem.paperSize}_${targetItem.orientation}_300dpi.jpg`;

    return { blob: taggedBlob, filename, width: targetW, height: targetH };
  }, []);

  // Export a single poster as 300 DPI JPEG (with native mobile Web Share and Touch-to-Save fallback)
  const handleExportSinglePoster = useCallback(
    async (targetItem: PosterItem) => {
      try {
        setIsExporting(true);
        setExportProgressText('Rendering 300 DPI JPEG…');
        showToast(`Preparing ${targetItem.name}…`);

        const { blob, filename } = await renderPosterToJpegBlob(targetItem);
        const result = await downloadJpegBlob(blob, filename);

        if (result.success) {
          if (result.usedShare) {
            showToast(`Shared ${filename} as 300 DPI JPEG.`);
          } else if (result.dataUrl && isMobileDevice()) {
            setMobileModalData({
              isOpen: true,
              imageUrl: result.dataUrl,
              filename,
              blob,
            });
            showToast(`Poster ready! Touch and hold image to save to Photos.`);
          } else {
            showToast(`Downloaded ${filename} as 300 DPI JPEG.`);
          }
        } else {
          throw new Error(result.error || 'Download failed');
        }
      } catch (err: any) {
        showToast(`Export failed: ${err?.message || 'Unknown error'}`);
      } finally {
        setIsExporting(false);
        setExportProgressText('');
      }
    },
    [renderPosterToJpegBlob, showToast]
  );

  // Export multiple posters as individual regular JPEGs (no RAR/ZIP required!)
  const handleExportMultipleJpegs = useCallback(
    async (targetItems: PosterItem[]) => {
      if (targetItems.length === 0) return;
      try {
        setIsExporting(true);
        for (let i = 0; i < targetItems.length; i++) {
          const item = targetItems[i];
          setExportProgressText(`Rendering ${i + 1} of ${targetItems.length}…`);
          const { blob, filename } = await renderPosterToJpegBlob(item);
          await downloadJpegBlob(blob, filename);

          // Small stagger between downloads so mobile browser queues them cleanly
          if (i < targetItems.length - 1) {
            await new Promise((r) => setTimeout(r, 450));
          }
        }
        showToast(`Downloaded ${targetItems.length} posters as regular JPEGs.`);
      } catch (err: any) {
        showToast(`Export failed: ${err?.message || 'Error downloading JPEGs'}`);
      } finally {
        setIsExporting(false);
        setExportProgressText('');
      }
    },
    [renderPosterToJpegBlob, showToast]
  );

  // Batch ZIP Export
  const handleBatchZipExport = useCallback(async () => {
    const readyItems = items.filter((i) => i.isSavedToReady);
    if (readyItems.length === 0) {
      showToast('No posters marked as ready to print.');
      return;
    }

    try {
      setIsExporting(true);
      const zip = new JSZip();

      for (let idx = 0; idx < readyItems.length; idx++) {
        const item = readyItems[idx];
        setExportProgressText(`Rendering ${idx + 1} of ${readyItems.length}…`);

        const dims = getPaperDimensions(item.paperSize, item.orientation);
        const targetW = Math.round(dims.widthInches * 300);
        const targetH = Math.round(dims.heightInches * 300);

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);

        const bmp = await createImageBitmap(item.file);
        const { f, cx, cy } = item.transform;
        const drawW = f * targetW;
        const drawH = drawW * (item.height / item.width);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bmp, cx * targetW - drawW / 2, cy * targetH - drawH / 2, drawW, drawH);
        bmp.close();

        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
        canvas.width = 0;
        canvas.height = 0;

        if (blob) {
          const rawBytes = new Uint8Array(await blob.arrayBuffer());
          const tagged = injectJfifDpiHeader(rawBytes, 300);
          const safeName = item.name.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_');
          const entryName = `${String(idx + 1).padStart(2, '0')}_${safeName}_${item.paperSize}_${item.orientation}_300dpi.jpg`;
          zip.file(entryName, tagged);
        }
      }

      setExportProgressText('Compressing ZIP archive…');
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'STORE', // Fast lossless packaging
      });

      const zipUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = zipUrl;
      a.download = `posters_300dpi_bundle_${Date.now()}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(zipUrl), 6000);

      showToast(`Batch ZIP downloaded with ${readyItems.length} posters at 300 DPI.`);
    } catch (err: any) {
      showToast(`Batch export error: ${err?.message || 'Failed to generate ZIP'}`);
    } finally {
      setIsExporting(false);
      setExportProgressText('');
    }
  }, [items, showToast]);

  // Safe Verified Remote URL Import
  const handleImportVerifiedUrl = useCallback(
    async (cleanUrl: string) => {
      try {
        showToast('Fetching image via verified client sandbox…');
        const res = await fetch(cleanUrl, { mode: 'cors' });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

        const blob = await res.blob();
        const urlObj = new URL(cleanUrl);
        const rawName = urlObj.pathname.split('/').pop() || 'remote_poster.jpg';
        const item = await processImageFile(blob, rawName);

        if (item) {
          setItems((prev) => [...prev, item]);
          setCurrentId(item.id);
          showToast(`Successfully imported ${item.name}`);
        }
      } catch (err: any) {
        showToast(`Could not import from URL: ${err?.message || 'CORS or network error'}`);
      }
    },
    [processImageFile, showToast]
  );

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      if (e.key === 'Escape') {
        setIsInspectOpen(false);
        setIsSecurityOpen(false);
        setIsSampleOpen(false);
      } else if (e.key === '1') {
        setActiveTab('editor');
      } else if (e.key === '2') {
        setActiveTab('verdict');
      } else if (e.key === '3') {
        setActiveTab('wall');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const readyCount = items.filter((i) => i.isSavedToReady).length;

  return (
    <div
      className={`flex flex-col h-screen w-screen overflow-hidden font-sans transition-colors duration-200 ${
        theme === 'light' ? 'bg-[#F8FAFC] text-[#0F172A]' : 'bg-[#0D0F12] text-[#F8FAFC]'
      }`}
    >
      {/* Top Header with Theme Switcher & Mobile Upload */}
      <VsCodeHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentItem={currentItem}
        onOpenInspectModal={() => setIsInspectOpen(true)}
        onDownloadCurrent={() => currentItem && handleExportSinglePoster(currentItem)}
        onDownloadAllZip={handleBatchZipExport}
        readyCount={readyCount}
        isExporting={isExporting}
        isQueueOpen={isQueueOpen}
        onToggleQueue={() => setIsQueueOpen(!isQueueOpen)}
        theme={theme}
        onToggleTheme={toggleTheme}
        onAddFiles={handleAddFiles}
        totalQueueCount={items.length}
        onOpenExportModal={() => setIsExportModalOpen(true)}
      />

      {/* Main Workspace Body (Sidebar + Content View) */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Backdrop for Queue */}
        {isQueueOpen && (
          <div
            onClick={() => setIsQueueOpen(false)}
            className="md:hidden fixed inset-0 bg-black/60 z-40"
          />
        )}

        {/* Batch Queue Sidebar (Desktop static, Mobile off-canvas drawer) */}
        <div
          className={`fixed md:static inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out md:translate-x-0 ${
            isQueueOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <QueueSidebar
            items={items}
            currentItem={currentItem}
            onSelectItem={(item) => {
              setCurrentId(item.id);
              setIsQueueOpen(false);
            }}
            onRemoveItem={handleRemoveItem}
            onAddFiles={handleAddFiles}
            onDownloadSingle={(item, e) => {
              e.stopPropagation();
              handleExportSinglePoster(item);
            }}
            onDownloadAllZip={handleBatchZipExport}
            onOpenSampleModal={() => setIsSampleOpen(true)}
            isExporting={isExporting}
            exportProgressText={exportProgressText}
            theme={theme}
            onClose={() => setIsQueueOpen(false)}
            onOpenExportModal={() => setIsExportModalOpen(true)}
          />
        </div>

        {/* Central Viewport depending on active tab */}
        <main className="flex-1 overflow-hidden relative">
          {activeTab === 'editor' && (
            <EditorCanvas
              item={currentItem}
              onUpdateItem={handleUpdateItem}
              onSaveToReady={handleSaveToReady}
              verdict={currentVerdict}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={historyIndex > 0}
              canRedo={historyIndex < historyStack.length - 1}
              onOpenUpscaler={() => setIsUpscalerOpen(true)}
              onRecordHistory={recordHistorySnapshot}
              theme={theme}
              onAddFiles={handleAddFiles}
              onLoadSample={handleLoadSample}
            />
          )}

          {activeTab === 'verdict' && (
            <PrintVerdictPanel
              item={currentItem}
              verdict={currentVerdict}
              onOpenInspect={() => setIsInspectOpen(true)}
              onApplyBleed={() => {
                if (!currentItem) return;
                const dims = getPaperDimensions(currentItem.paperSize, currentItem.orientation);
                const preset = calculatePresetFit('bleed', currentItem.width, currentItem.height, dims.widthInches, dims.heightInches);
                handleUpdateItem({
                  ...currentItem,
                  zoom: preset.f,
                  transform: preset,
                  version: currentItem.version + 1,
                });
                showToast('Applied Full Bleed framing.');
              }}
              theme={theme}
            />
          )}

          {activeTab === 'wall' && (
            <WallSimulator item={currentItem} verdict={currentVerdict} theme={theme} />
          )}

          {activeTab === 'security' && (
            <div className="h-full overflow-y-auto p-6 bg-[#181818]">
              <SecuritySandboxModal
                isOpen={true}
                onClose={() => setActiveTab('editor')}
                onImportVerifiedUrl={handleImportVerifiedUrl}
              />
            </div>
          )}
        </main>
      </div>

      {/* Floating Action / Notification Toast */}
      {toast && (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className={`toast-enter fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1f242c] text-[#e6edf3] border border-[#388bfd66] px-4 py-2 rounded-full shadow-lg text-xs font-mono flex items-center space-x-2 pointer-events-none transition-[opacity,translate] duration-200 ease-out ${
            toastLeaving ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-[#388bfd]"></span>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* 100% 1:1 Pixel Inspection Modal */}
      <InspectionModal
        item={currentItem}
        isOpen={isInspectOpen}
        onClose={() => setIsInspectOpen(false)}
      />

      {/* Readjust Poster Size & Custom Dimensions Modal */}
      <AdjustPosterSizeModal
        item={currentItem}
        isOpen={isAdjustSizeOpen}
        onClose={() => setIsAdjustSizeOpen(false)}
        onApplyNewSize={handleApplyNewSize}
        theme={theme}
      />

      {/* Edge-Aware Upscaler Modal */}
      {isUpscalerOpen && currentItem && currentVerdict && (
        <PosterUpscalerUI
          key={`${currentItem.id}_${currentItem.version}`}
          item={currentItem}
          verdict={currentVerdict}
          isOpen={isUpscalerOpen}
          onClose={() => setIsUpscalerOpen(false)}
          onApplyUpscaledItem={handleApplyUpscaledItem}
          theme={theme}
        />
      )}

      {/* Security Details Modal */}
      <SecuritySandboxModal
        isOpen={isSecurityOpen}
        onClose={() => setIsSecurityOpen(false)}
        onImportVerifiedUrl={handleImportVerifiedUrl}
      />

      {/* Sample Poster Chooser Modal */}
      <SamplePostersModal
        isOpen={isSampleOpen}
        onClose={() => setIsSampleOpen(false)}
        onLoadSample={handleLoadSample}
        onLoadAllSamples={handleLoadAllSamples}
      />

      {/* High-Resolution Individual & Batch JPEG Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        items={items}
        currentItem={currentItem}
        onDownloadSingleJpeg={handleExportSinglePoster}
        onDownloadMultipleJpegs={handleExportMultipleJpegs}
        onDownloadZip={handleBatchZipExport}
        isExporting={isExporting}
        exportProgressText={exportProgressText}
        theme={theme}
      />

      {/* Mobile Touch-and-Hold & Web Share Fallback Modal */}
      <MobileSaveImageModal
        isOpen={mobileModalData.isOpen}
        onClose={() => setMobileModalData((prev) => ({ ...prev, isOpen: false }))}
        imageUrl={mobileModalData.imageUrl}
        filename={mobileModalData.filename}
        blob={mobileModalData.blob}
        theme={theme}
      />
    </div>
  );
}
