import { AnyCanvas, context2d, createCanvas } from './mask';
import { PaintEngine, PaintLayer } from './paint-engine';

export type ExportFormat = 'png' | 'jpg';
export type ExportLayout = 'painted' | 'before-after';

export interface ExportRequest {
  /** Signed URL of the full-resolution original photo */
  originalUrl: string;
  /** Builds paint layers for the given render size (patterns depend on it) */
  layersAt: (width: number, height: number) => PaintLayer[];
  format: ExportFormat;
  layout: ExportLayout;
  /** Caption band with design name, colours, and the disclaimer (FR-S3, spec §8.7) */
  caption?: { title: string; lines: string[]; disclaimer: string };
}

/** Longest side of each half of a before/after image, to keep files a sensible size */
const SIDE_BY_SIDE_MAX = 2400;

export async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  await img.decode();
  return img;
}

/**
 * Renders a design for download at the photo's original resolution (spec §8.6): the
 * same paint engine as the preview, run on the full-size original rather than the
 * downscaled working copy.
 */
export async function renderExport(req: ExportRequest): Promise<Blob> {
  const original = await loadImage(req.originalUrl);
  const w = original.naturalWidth;
  const h = original.naturalHeight;

  const painted = createCanvas(w, h);
  const ctx = context2d(painted);
  ctx.drawImage(original, 0, 0);
  const engine = new PaintEngine(ctx.getImageData(0, 0, w, h));
  const out = ctx.createImageData(w, h);
  engine.render(req.layersAt(w, h), out);
  ctx.putImageData(out, 0, 0);

  const body = req.layout === 'before-after' ? sideBySide(original, painted, w, h) : painted;
  const final = req.caption ? withCaption(body, req.caption) : body;
  return toBlob(final, req.format);
}

function sideBySide(before: CanvasImageSource, after: AnyCanvas, w: number, h: number): AnyCanvas {
  const scale = Math.min(1, SIDE_BY_SIDE_MAX / Math.max(w, h));
  const sw = Math.round(w * scale);
  const sh = Math.round(h * scale);
  const gap = Math.max(6, Math.round(sw * 0.01));
  const canvas = createCanvas(sw * 2 + gap, sh);
  const ctx = context2d(canvas);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(before, 0, 0, sw, sh);
  ctx.drawImage(after as CanvasImageSource, sw + gap, 0, sw, sh);

  const font = Math.max(14, Math.round(sw / 40));
  pill(ctx, 'Before', font, font, font);
  pill(ctx, 'After', sw + gap + font, font, font);
  return canvas;
}

function pill(ctx: ReturnType<typeof context2d>, text: string, x: number, y: number, size: number) {
  ctx.font = `600 ${size}px Inter, Roboto, sans-serif`;
  const padX = size * 0.6;
  const width = ctx.measureText(text).width + padX * 2;
  const height = size * 1.7;
  ctx.fillStyle = 'rgba(29,36,39,0.78)';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, height / 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + padX, y + height / 2);
}

function withCaption(body: AnyCanvas, caption: NonNullable<ExportRequest['caption']>): AnyCanvas {
  const width = body.width;
  const size = Math.max(14, Math.round(width / 85));
  const small = Math.round(size * 0.78);
  const pad = Math.round(size * 1.2);
  const lineH = Math.round(size * 1.5);
  const height = pad * 2 + lineH * (1 + caption.lines.length) + Math.round(small * 1.8);

  const canvas = createCanvas(width, body.height + height);
  const ctx = context2d(canvas);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(body as CanvasImageSource, 0, 0);

  let y = body.height + pad;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#1d2427';
  ctx.font = `700 ${size}px Inter, Roboto, sans-serif`;
  ctx.fillText(caption.title, pad, y);
  y += lineH;
  ctx.font = `400 ${size}px Inter, Roboto, sans-serif`;
  for (const line of caption.lines) {
    ctx.fillText(line, pad, y);
    y += lineH;
  }
  ctx.fillStyle = '#5b666b';
  ctx.font = `400 ${small}px Inter, Roboto, sans-serif`;
  ctx.fillText(caption.disclaimer, pad, y + small * 0.4);
  return canvas;
}

export function toBlob(canvas: AnyCanvas, format: ExportFormat, quality = 0.92): Promise<Blob> {
  const type = format === 'png' ? 'image/png' : 'image/jpeg';
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), type, quality),
  );
}

/** Saves a blob through the browser's download prompt. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'design'
  );
}
