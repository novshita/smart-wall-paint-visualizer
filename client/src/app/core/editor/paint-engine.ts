import { Finish } from '../../shared/models/catalog.model';
import { Bounds, alphaBounds, expandBounds, featherAlpha } from './blur';
import { Selection } from './editor.model';
import { rasterizeAlpha } from './mask';
import { Rgb, luminanceMap, meanLuminance, paintRegion } from './paint';

export interface PaintLayer {
  regionId: string;
  selection: Selection;
  rgb: Rgb;
  secondaryRgb?: Rgb;
  split?: { direction: 'horizontal' | 'vertical'; position: number };
  /** Pattern coverage at the engine's resolution (see pattern-field.ts) */
  pattern?: Uint8Array;
  opacity: number;
  brightness: number;
  finish: Finish;
}

interface MaskEntry {
  selection: Selection;
  alpha: Uint8ClampedArray;
  /** Painted area including the feather margin */
  bounds: Bounds | null;
  /** The wall's own extent before feathering */
  extent: Bounds | null;
  mean: number;
}

type Rasterizer = (selection: Selection, w: number, h: number) => Uint8ClampedArray;

/**
 * Renders painted walls over the photo. Per-wall masks (with feathering) and the
 * photo's luminance are computed once and cached, so changing colour, opacity or
 * finish only re-runs the per-pixel blend (spec §7: < 300 ms on a 2000 px image).
 */
export class PaintEngine {
  readonly width: number;
  readonly height: number;
  private readonly base: Uint8ClampedArray;
  private readonly lum: Float32Array;
  private readonly masks = new Map<string, MaskEntry>();

  constructor(
    image: ImageData,
    private readonly rasterize: Rasterizer = rasterizeAlpha,
  ) {
    this.width = image.width;
    this.height = image.height;
    this.base = new Uint8ClampedArray(image.data);
    this.lum = luminanceMap(this.base);
  }

  /** Composites all layers (in order) and returns the elapsed time in ms. */
  render(layers: readonly PaintLayer[], out: ImageData): number {
    const start = performance.now();
    out.data.set(this.base);
    for (const layer of layers) {
      const mask = this.mask(layer.regionId, layer.selection);
      if (!mask.bounds) continue;
      paintRegion(
        out.data,
        this.lum,
        mask.alpha,
        this.width,
        mask.bounds,
        mask.mean,
        layer,
        mask.extent!,
      );
    }
    this.prune(layers);
    return performance.now() - start;
  }

  private mask(regionId: string, selection: Selection): MaskEntry {
    const cached = this.masks.get(regionId);
    if (cached && cached.selection === selection) return cached;

    const { width: w, height: h } = this;
    const alpha = this.rasterize(selection, w, h);
    const extent = alphaBounds(alpha, w, h);
    let bounds = extent;
    const feather = Math.round(selection.feather ?? 0);
    if (bounds && feather > 0) {
      bounds = expandBounds(bounds, feather * 3, w, h);
      featherAlpha(alpha, w, h, feather, bounds);
    }
    const mean = bounds ? meanLuminance(this.lum, alpha, w, bounds) : 0.5;
    const entry = { selection, alpha, bounds, extent, mean };
    this.masks.set(regionId, entry);
    return entry;
  }

  private prune(layers: readonly PaintLayer[]): void {
    const live = new Set(layers.map((l) => l.regionId));
    for (const id of this.masks.keys()) if (!live.has(id)) this.masks.delete(id);
  }
}
