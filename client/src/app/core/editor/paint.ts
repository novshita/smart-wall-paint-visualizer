import { Finish } from '../../shared/models/catalog.model';
import { Bounds } from './blur';

// sRGB <-> linear lookup tables: blending happens in linear light so shading looks natural
const SRGB_TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LINEAR[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
const LUT_SIZE = 4096;
const LINEAR_TO_SRGB = new Uint8ClampedArray(LUT_SIZE + 1);
for (let i = 0; i <= LUT_SIZE; i++) {
  const c = i / LUT_SIZE;
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  LINEAR_TO_SRGB[i] = Math.round(s * 255);
}

export function srgbToLinear(v: number): number {
  return SRGB_TO_LINEAR[v];
}

export function linearToSrgb(v: number): number {
  return LINEAR_TO_SRGB[Math.round(Math.min(1, Math.max(0, v)) * LUT_SIZE)];
}

/** Linear-light luminance (Rec. 709) for every pixel of an RGBA buffer. */
export function luminanceMap(rgba: Uint8ClampedArray): Float32Array {
  const n = rgba.length / 4;
  const lum = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    lum[i] =
      0.2126 * SRGB_TO_LINEAR[rgba[j]] +
      0.7152 * SRGB_TO_LINEAR[rgba[j + 1]] +
      0.0722 * SRGB_TO_LINEAR[rgba[j + 2]];
  }
  return lum;
}

/** Mask-weighted mean luminance of a wall: the wall's "average brightness". */
export function meanLuminance(
  lum: Float32Array,
  alpha: Uint8ClampedArray,
  w: number,
  b: Bounds,
): number {
  let sum = 0;
  let weight = 0;
  for (let y = b.y0; y < b.y1; y++) {
    for (let x = b.x0, i = y * w + b.x0; x < b.x1; x++, i++) {
      const a = alpha[i];
      if (a) {
        sum += lum[i] * a;
        weight += a;
      }
    }
  }
  return weight ? sum / weight : 0.5;
}

/**
 * Maps relative shading (pixel brightness ÷ wall average) through the paint finish
 * (spec §8.3): matte flattens highlights, glossy makes them pop.
 */
export function finishCurve(s: number, finish: Finish): number {
  if (s <= 1) return finish === 'glossy' ? s ** 1.08 : s;
  const highlight = s - 1;
  switch (finish) {
    case 'matte':
      return 1 + highlight * 0.55;
    case 'satin':
      return 1 + highlight * 0.9;
    case 'glossy':
      return 1 + highlight * 1.4;
  }
}

export type Rgb = readonly [number, number, number];

export interface PaintParams {
  /** Target paint colour, sRGB 0–255 (top/left tone for dual-tone, background for patterns) */
  rgb: Rgb;
  /** Second colour: bottom/right tone for dual-tone, ink colour for patterns */
  secondaryRgb?: Rgb;
  /** Dual-tone split; position is 0–100 across the wall's own extent (FR-C2) */
  split?: { direction: 'horizontal' | 'vertical'; position: number };
  /** Pattern coverage per image pixel: 0 = background colour … 255 = ink colour (FR-C3) */
  pattern?: Uint8Array;
  /** 0–100 */
  opacity: number;
  /** -100 to 100 */
  brightness: number;
  finish: Finish;
}

/**
 * Recolours one wall (spec §8.2). Each pixel's shading relative to the wall's average
 * brightness is kept and applied to the paint colour, in linear light, so shadows,
 * highlights and texture from the photo survive and the wall's average becomes the
 * true paint colour. Writes into `out` (which may already contain other walls).
 */
export function paintRegion(
  out: Uint8ClampedArray,
  lum: Float32Array,
  alpha: Uint8ClampedArray,
  w: number,
  bounds: Bounds,
  meanLum: number,
  params: PaintParams,
  /** The wall's unfeathered extent, used to place the dual-tone split */
  extent: Bounds = bounds,
): void {
  const tr = SRGB_TO_LINEAR[params.rgb[0]];
  const tg = SRGB_TO_LINEAR[params.rgb[1]];
  const tb = SRGB_TO_LINEAR[params.rgb[2]];
  const second = params.secondaryRgb ?? params.rgb;
  const sr = SRGB_TO_LINEAR[second[0]];
  const sg = SRGB_TO_LINEAR[second[1]];
  const sb = SRGB_TO_LINEAR[second[2]];
  const pattern = params.pattern;
  const split = !pattern && params.secondaryRgb ? params.split : undefined;
  const horizontal = split?.direction !== 'vertical';
  const splitAt = split
    ? horizontal
      ? extent.y0 + ((extent.y1 - extent.y0) * split.position) / 100
      : extent.x0 + ((extent.x1 - extent.x0) * split.position) / 100
    : 0;
  const exposure = 2 ** (params.brightness / 100); // ±1 stop at the slider ends
  const opacity = Math.min(1, Math.max(0, params.opacity / 100));
  const inv = 1 / Math.max(meanLum, 0.02); // guard very dark photos against noise blow-up

  // Cache the finish curve: s is clamped to [0, 4) and quantised
  const STEPS = 1024;
  const curve = new Float32Array(STEPS);
  for (let k = 0; k < STEPS; k++) curve[k] = finishCurve((k / STEPS) * 4, params.finish) * exposure;

  for (let y = bounds.y0; y < bounds.y1; y++) {
    for (let x = bounds.x0, i = y * w + bounds.x0; x < bounds.x1; x++, i++) {
      const a = alpha[i];
      if (!a) continue;
      const s = Math.min(STEPS - 1, (lum[i] * inv * STEPS) / 4) | 0;
      const f = curve[s];
      const mix = (a / 255) * opacity;
      const j = i * 4;

      // How much of the second colour this pixel gets (0 = all primary)
      let k = 0;
      if (pattern) k = pattern[i] / 255;
      else if (split) {
        // 1 px anti-aliased edge, like a taped paint line
        k = Math.min(1, Math.max(0, (horizontal ? y : x) + 0.5 - splitAt));
      }
      const r = k ? tr + (sr - tr) * k : tr;
      const g = k ? tg + (sg - tg) * k : tg;
      const b = k ? tb + (sb - tb) * k : tb;

      out[j] += (linearToSrgb(r * f) - out[j]) * mix;
      out[j + 1] += (linearToSrgb(g * f) - out[j + 1]) * mix;
      out[j + 2] += (linearToSrgb(b * f) - out[j + 2]) * mix;
    }
  }
}
