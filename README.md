# Poster Print Studio

A browser-based studio for preparing images for large-format poster printing. It checks whether an image has enough resolution for a sharp print at the chosen size, lets you frame and resize it, previews it on a wall, and upscales low-resolution images with AI.

## Features

- **Print verdict**: calculates the effective DPI for the chosen poster size and tells you whether the print will look sharp (300 DPI target)
- **Framing editor**: crop, position and resize the image to standard or custom poster dimensions
- **Wall simulator**: preview the poster at real scale on a wall before printing
- **Local upscaler**: an edge-aware reconstruction pipeline (Lanczos-3, edge-directed anti-aliasing, iterative back-projection, deringing and adaptive sharpening) that runs in a Web Worker, so the UI stays responsive
- **AI super-resolution**: optional 4× upscaling with Real-ESRGAN-class models, with live progress and an automatic fallback model
- **Batch queue and export**: process several posters and export them individually or as a ZIP archive
- **Responsive layout** with a dedicated mobile studio view

## Tech stack

TypeScript · React 19 · Vite · Tailwind CSS · Web Workers · Motion · JSZip

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

| Script | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build for production into `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | Type-check the project |

> The print checker, editor, wall simulator and local upscaler all run in the browser. Cloud AI super-resolution relies on a server-side component that is not included in this repository.

## Project structure

```
src/
├── components/   UI: editor canvas, print verdict, wall simulator, export, queue
├── hooks/        Upscaler and modal state hooks
├── utils/        Print calculations, upscaling engine, download helpers (with unit tests)
└── workers/      Web Worker that runs the upscaler off the main thread
```
