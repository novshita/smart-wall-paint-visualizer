import { alphaBounds, expandBounds, featherAlpha } from './blur';

describe('mask helpers', () => {
  it('finds bounds of the selected area', () => {
    const w = 10;
    const a = new Uint8ClampedArray(100);
    a[3 * w + 2] = 255;
    a[6 * w + 7] = 255;
    expect(alphaBounds(a, w, 10)).toEqual({ x0: 2, y0: 3, x1: 8, y1: 7 });
    expect(alphaBounds(new Uint8ClampedArray(100), w, 10)).toBeNull();
    expect(expandBounds({ x0: 2, y0: 3, x1: 8, y1: 7 }, 5, 10, 10)).toEqual({
      x0: 0,
      y0: 0,
      x1: 10,
      y1: 10,
    });
  });

  it('softens a hard edge without changing the interior', () => {
    const w = 40;
    const h = 1;
    const a = new Uint8ClampedArray(w);
    a.fill(255, 0, 20); // left half selected
    featherAlpha(a, w, h, 3, { x0: 0, y0: 0, x1: w, y1: h });
    expect(a[0]).toBe(255);
    expect(a[39]).toBe(0);
    expect(a[19]).toBeGreaterThan(80);
    expect(a[19]).toBeLessThan(200);
    for (let i = 1; i < w; i++) expect(a[i]).toBeLessThanOrEqual(a[i - 1]); // smooth falloff
  });
});
