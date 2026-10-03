import { finishCurve, linearToSrgb, luminanceMap, paintRegion, srgbToLinear } from './paint';
import { PaintEngine } from './paint-engine';
import { Selection } from './editor.model';

const SAGE: [number, number, number] = [167, 180, 154];

function grey(values: number[]): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(values.length * 4);
  values.forEach((v, i) => rgba.set([v, v, v, 255], i * 4));
  return rgba;
}

describe('paint blending', () => {
  it('round-trips sRGB through linear light', () => {
    for (const v of [0, 1, 50, 128, 200, 255]) expect(linearToSrgb(srgbToLinear(v))).toBe(v);
  });

  it('paints a flat wall exactly the target colour', () => {
    const base = grey([180, 180, 180, 180]);
    const out = new Uint8ClampedArray(base);
    const alpha = new Uint8ClampedArray([255, 255, 255, 255]);
    paintRegion(
      out,
      luminanceMap(base),
      alpha,
      4,
      { x0: 0, y0: 0, x1: 4, y1: 1 },
      luminanceMap(base)[0],
      {
        rgb: SAGE,
        opacity: 100,
        brightness: 0,
        finish: 'satin',
      },
    );
    for (let i = 0; i < 4; i++) {
      expect(Math.abs(out[i * 4] - SAGE[0])).toBeLessThanOrEqual(1);
      expect(Math.abs(out[i * 4 + 1] - SAGE[1])).toBeLessThanOrEqual(1);
      expect(Math.abs(out[i * 4 + 2] - SAGE[2])).toBeLessThanOrEqual(1);
    }
  });

  it('keeps shadows and highlights from the photo (FR-C5)', () => {
    const base = grey([90, 180, 180, 230]); // shadow, wall, wall, highlight
    const lum = luminanceMap(base);
    const mean = (lum[0] + lum[1] + lum[2] + lum[3]) / 4;
    const out = new Uint8ClampedArray(base);
    paintRegion(
      out,
      lum,
      new Uint8ClampedArray([255, 255, 255, 255]),
      4,
      { x0: 0, y0: 0, x1: 4, y1: 1 },
      mean,
      {
        rgb: SAGE,
        opacity: 100,
        brightness: 0,
        finish: 'satin',
      },
    );
    const g = (i: number) => out[i * 4 + 1];
    expect(g(0)).toBeLessThan(g(1)); // shadow stays darker
    expect(g(3)).toBeGreaterThan(g(1)); // highlight stays brighter
    // and the result is tinted, not grey
    expect(out[4 + 1]).toBeGreaterThan(out[4 + 2]);
  });

  it('respects opacity, brightness and an unselected pixel', () => {
    const base = grey([200, 200]);
    const lum = luminanceMap(base);
    const run = (opacity: number, brightness: number) => {
      const out = new Uint8ClampedArray(base);
      paintRegion(
        out,
        lum,
        new Uint8ClampedArray([255, 0]),
        2,
        { x0: 0, y0: 0, x1: 2, y1: 1 },
        lum[0],
        {
          rgb: [200, 40, 40],
          opacity,
          brightness,
          finish: 'matte',
        },
      );
      return out;
    };
    expect(run(0, 0)[0]).toBe(200); // invisible paint
    expect(run(100, 0)[4]).toBe(200); // pixel outside the mask untouched
    expect(run(50, 0)[1]).toBeGreaterThan(run(100, 0)[1]); // half-strength is closer to grey
    expect(run(100, -50)[0]).toBeLessThan(run(100, 0)[0]); // darker
  });

  it('flattens highlights for matte and boosts them for glossy', () => {
    expect(finishCurve(1.5, 'matte')).toBeLessThan(finishCurve(1.5, 'satin'));
    expect(finishCurve(1.5, 'glossy')).toBeGreaterThan(finishCurve(1.5, 'satin'));
    expect(finishCurve(0.5, 'matte')).toBe(0.5);
  });
});

describe('PaintEngine', () => {
  const sel: Selection = {
    type: 'polygon',
    points: [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    feather: 0,
  };

  it('caches masks per wall and only re-rasterises when the selection changes', () => {
    const w = 64;
    const h = 64;
    const image = {
      width: w,
      height: h,
      data: grey(new Array(w * h).fill(150)),
    } as unknown as ImageData;
    const rasterize = vi.fn((_s: Selection, mw: number, mh: number) =>
      new Uint8ClampedArray(mw * mh).fill(255),
    );
    const engine = new PaintEngine(image, rasterize);
    const out = {
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
    } as unknown as ImageData;

    const layer = {
      regionId: 'a',
      selection: sel,
      rgb: SAGE,
      opacity: 100,
      brightness: 0,
      finish: 'matte' as const,
    };
    engine.render([layer], out);
    engine.render([{ ...layer, rgb: [10, 20, 30] }], out); // colour change only
    expect(rasterize).toHaveBeenCalledTimes(1);

    engine.render([{ ...layer, selection: { ...sel, feather: 2 } }], out);
    expect(rasterize).toHaveBeenCalledTimes(2);
  });

  it('renders a 2000×1500 wall well under the 300 ms budget (spec §7)', () => {
    const w = 2000;
    const h = 1500;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) data.set([120 + (i % 97), 130, 125, 255], i);
    const engine = new PaintEngine(
      { width: w, height: h, data } as unknown as ImageData,
      (_s, mw, mh) => new Uint8ClampedArray(mw * mh).fill(255),
    );
    const out = {
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
    } as unknown as ImageData;
    const layer = {
      regionId: 'a',
      selection: sel,
      rgb: SAGE,
      opacity: 90,
      brightness: 10,
      finish: 'glossy' as const,
    };
    engine.render([layer], out); // first render includes mask setup
    const ms = engine.render([{ ...layer, rgb: [30, 60, 90] }], out);
    expect(ms).toBeLessThan(300);
  });
});
