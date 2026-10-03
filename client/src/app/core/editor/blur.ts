export interface Bounds {
  x0: number;
  y0: number;
  x1: number; // exclusive
  y1: number; // exclusive
}

/** Smallest rectangle containing every non-zero value, or null if the mask is empty. */
export function alphaBounds(alpha: Uint8ClampedArray, w: number, h: number): Bounds | null {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (alpha[row + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

export function expandBounds(b: Bounds, by: number, w: number, h: number): Bounds {
  return {
    x0: Math.max(0, b.x0 - by),
    y0: Math.max(0, b.y0 - by),
    x1: Math.min(w, b.x1 + by),
    y1: Math.min(h, b.y1 + by),
  };
}

/**
 * Soft-edge feathering (FR-W6): three passes of a separable box blur approximate a
 * Gaussian. Works in place, only inside `bounds` (which should include the blur margin).
 * Pure JS so it behaves the same in every browser (canvas `filter` isn't universal).
 */
export function featherAlpha(
  alpha: Uint8ClampedArray,
  w: number,
  h: number,
  radius: number,
  bounds: Bounds,
): void {
  const r = Math.round(radius);
  if (r < 1) return;
  const { x0, y0, x1, y1 } = bounds;
  const bw = x1 - x0;
  const bh = y1 - y0;
  const buf = new Float32Array(bw * bh);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) buf[y * bw + x] = alpha[(y + y0) * w + x + x0];
  }

  const tmp = new Float32Array(Math.max(bw, bh));
  const pass = (len: number, count: number, stride: number, step: number) => {
    for (let line = 0; line < count; line++) {
      const base = line * stride;
      // running sum over [i - r, i + r], clamped at the edges
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += buf[base + Math.min(len - 1, Math.max(0, i)) * step];
      for (let i = 0; i < len; i++) {
        tmp[i] = sum / (2 * r + 1);
        const add = Math.min(len - 1, i + r + 1);
        const sub = Math.max(0, i - r);
        sum += buf[base + add * step] - buf[base + sub * step];
      }
      for (let i = 0; i < len; i++) buf[base + i * step] = tmp[i];
    }
  };

  for (let k = 0; k < 3; k++) {
    pass(bw, bh, bw, 1); // horizontal
    pass(bh, bw, 1, bw); // vertical
  }

  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) alpha[(y + y0) * w + x + x0] = buf[y * bw + x];
  }
}
