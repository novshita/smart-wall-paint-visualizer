import { context2d, createCanvas } from './mask';

/** Pattern tile size is relative to image width, so a design looks the same at any resolution. */
const REFERENCE_WIDTH = 1000;

/**
 * Tiles a greyscale pattern across a w × h image (with scale and rotation, FR-C3) and
 * returns per-pixel coverage: 0 where the tile is white (background colour) up to 255
 * on the darkest ink. Contrast is stretched so subtle grey tiles still read clearly.
 */
export function patternCoverage(
  tile: HTMLImageElement,
  w: number,
  h: number,
  scale: number,
  rotationDeg: number,
): Uint8Array {
  const canvas = createCanvas(w, h);
  const ctx = context2d(canvas);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);

  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) return new Uint8Array(w * h);
  const size = scale * (w / REFERENCE_WIDTH);
  pattern.setTransform(
    new DOMMatrix()
      .translateSelf(w / 2, h / 2)
      .rotateSelf(rotationDeg)
      .scaleSelf(size),
  );
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);

  const rgba = ctx.getImageData(0, 0, w, h).data;
  const coverage = new Uint8Array(w * h);
  let darkest = 255;
  for (let i = 0, j = 0; i < coverage.length; i++, j += 4) {
    const l = (rgba[j] * 54 + rgba[j + 1] * 183 + rgba[j + 2] * 19) >> 8;
    coverage[i] = 255 - l;
    if (l < darkest) darkest = l;
  }
  const range = 255 - darkest;
  if (range > 0 && range < 255) {
    const k = 255 / range;
    for (let i = 0; i < coverage.length; i++) coverage[i] = Math.min(255, coverage[i] * k);
  }
  return coverage;
}
