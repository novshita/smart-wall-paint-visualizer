import { MAX_ZOOM, fitView, toImage, toScreen, zoomAt } from './viewport';

describe('viewport', () => {
  it('fits and centres the image', () => {
    const v = fitView(2000, 1000, 1048, 1048, 24);
    expect(v.scale).toBeCloseTo(0.5);
    expect(v.x).toBeCloseTo(24);
    expect(v.y).toBeCloseTo(274);
  });

  it('keeps the point under the cursor fixed when zooming', () => {
    const v = { scale: 1, x: 10, y: 20 };
    const before = toImage(v, 300, 200);
    const zoomed = zoomAt(v, 2, 300, 200);
    expect(toScreen(zoomed, ...before)).toEqual([300, 200]);
  });

  it('clamps zoom', () => {
    expect(zoomAt({ scale: 6, x: 0, y: 0 }, 10, 0, 0).scale).toBe(MAX_ZOOM);
  });
});
