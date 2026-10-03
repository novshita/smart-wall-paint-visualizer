import { Selection, Stroke } from './editor.model';

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function createCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function context2d(canvas: AnyCanvas): Ctx {
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as Ctx | null;
  if (!ctx) throw new Error('2D canvas is not supported in this browser');
  return ctx;
}

/** Draws one stroke in image pixels. Caller sets composite mode and colour. */
export function drawStroke(ctx: Ctx, stroke: Stroke, w: number, h: number): void {
  const width = stroke.size * w;
  const pts = stroke.points;
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0][0] * w, pts[0][1] * h, width / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(pts[0][0] * w, pts[0][1] * h);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * w, pts[i][1] * h);
  ctx.stroke();
}

/**
 * Paints the selection as opaque `color` on a transparent canvas of size w × h:
 * polygon first, then brush strokes add and eraser strokes remove, in order.
 */
export function drawSelection(
  ctx: Ctx,
  selection: Selection,
  w: number,
  h: number,
  color = '#fff',
) {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const poly = selection.points;
  if (poly && poly.length >= 3) {
    ctx.beginPath();
    ctx.moveTo(poly[0][0] * w, poly[0][1] * h);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0] * w, poly[i][1] * h);
    ctx.closePath();
    ctx.fill();
  }

  for (const stroke of selection.strokes ?? []) {
    ctx.globalCompositeOperation = stroke.mode === 'add' ? 'source-over' : 'destination-out';
    drawStroke(ctx, stroke, w, h);
  }
  ctx.restore();
}

/** Rasterises a selection to an 8-bit alpha mask (one byte per pixel). */
export function rasterizeAlpha(selection: Selection, w: number, h: number): Uint8ClampedArray {
  const canvas = createCanvas(w, h);
  const ctx = context2d(canvas);
  drawSelection(ctx, selection, w, h);
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const alpha = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 3; i < alpha.length; i++, j += 4) alpha[i] = rgba[j];
  return alpha;
}
