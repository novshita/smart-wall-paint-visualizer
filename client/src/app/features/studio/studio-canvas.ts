import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { EditorStore } from '../../core/editor/editor.store';
import { Selection } from '../../core/editor/editor.model';
import { hasArea } from '../../core/editor/geometry';
import { toBlob } from '../../core/editor/export';
import { AnyCanvas, context2d, createCanvas, rasterizeAlpha } from '../../core/editor/mask';
import { PaintEngine, PaintLayer } from '../../core/editor/paint-engine';
import { Stage } from '../../core/editor/stage';
import { View, toScreen } from '../../core/editor/viewport';

/**
 * Shows the painted room (spec §8): the paint engine composites walls over the photo
 * at working resolution, then the result is drawn with zoom/pan. Supports a
 * before/after comparison slider and "show original" (FR-C7).
 */
@Component({
  selector: 'app-studio-canvas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas
    #canvas
    [style.cursor]="dragging() ? 'ew-resize' : 'grab'"
    role="img"
    [attr.aria-label]="showBefore() ? 'Original room photo' : 'Room photo with paint applied'"
  ></canvas>`,
  host: {
    '[attr.data-render-ms]': 'renderMs()?.toFixed(1)',
    tabindex: '0',
    '(pointerdown)': 'focusSelf()',
  },
  styles: `
    :host {
      position: relative;
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #ebe8e2;
      touch-action: none;
      user-select: none;
    }
    :host(:focus-visible) {
      outline: 3px solid var(--swpv-accent);
      outline-offset: -3px;
    }
    canvas {
      position: absolute;
      inset: 0;
      display: block;
    }
  `,
})
export class StudioCanvas {
  private readonly store = inject(EditorStore);

  readonly layers = input.required<PaintLayer[]>();
  /** Side-by-side comparison with a draggable divider */
  readonly compare = input(false);
  /** Divider position, 0 (all after) … 1 (all before), as a fraction of image width */
  readonly comparePos = model(0.5);
  /** Show the untouched photo (press-and-hold "Before") */
  readonly showBefore = input(false);
  /** In compare mode, show another design on the left instead of the original photo (FR-C6) */
  readonly compareLayers = input<PaintLayer[] | null>(null);
  readonly leftLabel = input('Before');
  readonly rightLabel = input('After');

  readonly view = signal<View>({ scale: 1, x: 0, y: 0 });
  /** How long the last paint composite took, for the < 300 ms target (spec §7) */
  readonly renderMs = signal<number | null>(null);
  protected readonly dragging = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private stage?: Stage;
  private engine?: PaintEngine;
  private composite?: AnyCanvas;
  private output?: ImageData;
  private compareComposite?: AnyCanvas;
  private compareOutput?: ImageData;
  private compositeFrame = 0;
  private readonly hitMasks = new Map<string, { selection: Selection; alpha: Uint8ClampedArray }>();

  constructor() {
    afterNextRender(() => {
      this.stage = new Stage(
        this.canvasRef().nativeElement,
        {
          draw: (ctx, view, dpr) => this.draw(ctx, view, dpr),
          wantsPan: (e) => !this.nearDivider(e),
          pointerDown: (e) => {
            if (!this.nearDivider(e)) return false;
            this.dragging.set(true);
            return true;
          },
          pointerMove: (_e, at) => this.moveDivider(at[0]),
          pointerUp: () => this.dragging.set(false),
          cancel: () => this.dragging.set(false),
          click: (_e, at) => this.selectWallAt(at),
        },
        () => this.imageSize(),
        (view) => this.view.set(view),
      );
    });

    // Build the paint engine once the photo is decoded
    effect(() => {
      const img = this.store.image();
      if (!img) return;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const base = createCanvas(w, h);
      const ctx = context2d(base);
      ctx.drawImage(img, 0, 0);
      this.engine = new PaintEngine(ctx.getImageData(0, 0, w, h));
      this.composite = createCanvas(w, h);
      this.output = context2d(this.composite).createImageData(w, h);
      this.compareComposite = createCanvas(w, h);
      this.compareOutput = context2d(this.compareComposite).createImageData(w, h);
      this.scheduleComposite();
    });

    // Re-composite whenever paint changes (coalesced to one per frame)
    effect(() => {
      this.layers();
      this.compareLayers();
      this.scheduleComposite();
    });

    effect(() => {
      this.compare();
      this.comparePos();
      this.showBefore();
      this.leftLabel();
      this.rightLabel();
      this.stage?.requestRender();
    });

    inject(DestroyRef).onDestroy(() => {
      cancelAnimationFrame(this.compositeFrame);
      this.stage?.destroy();
    });
  }

  protected focusSelf(): void {
    this.host.nativeElement.focus({ preventScroll: true });
  }

  /** The current painted preview as an image, at most `maxSide` px, e.g. for thumbnails. */
  async snapshot(maxSide = 960): Promise<Blob | null> {
    const size = this.imageSize();
    if (!this.composite || !size) return null;
    const scale = Math.min(1, maxSide / Math.max(size.width, size.height));
    const out = createCanvas(Math.round(size.width * scale), Math.round(size.height * scale));
    const ctx = context2d(out);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.composite as CanvasImageSource, 0, 0, out.width, out.height);
    return toBlob(out, 'jpg', 0.85);
  }

  zoomBy(factor: number): void {
    this.stage?.zoomBy(factor);
  }

  fit(): void {
    this.stage?.fit();
  }

  private scheduleComposite(): void {
    if (this.compositeFrame || !this.engine) return;
    this.compositeFrame = requestAnimationFrame(() => {
      this.compositeFrame = 0;
      if (!this.engine || !this.output || !this.composite) return;
      const ms = this.engine.render(this.layers(), this.output);
      context2d(this.composite).putImageData(this.output, 0, 0);
      const other = this.compareLayers();
      if (other && this.compareOutput && this.compareComposite) {
        this.engine.render(other, this.compareOutput);
        context2d(this.compareComposite).putImageData(this.compareOutput, 0, 0);
      }
      this.renderMs.set(ms);
      this.stage?.requestRender();
    });
  }

  private draw(ctx: CanvasRenderingContext2D, view: View, dpr: number): void {
    const img = this.store.image();
    const size = this.imageSize();
    if (!img || !size) return;
    const painted = (this.composite ?? img) as CanvasImageSource;

    ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, dpr * view.x, dpr * view.y);
    ctx.imageSmoothingQuality = 'high';

    if (this.showBefore()) {
      ctx.drawImage(img, 0, 0, size.width, size.height);
      return;
    }
    if (!this.compare()) {
      ctx.drawImage(painted, 0, 0, size.width, size.height);
      return;
    }

    // Before (or the other design) on the left of the divider, this design on the right
    const split = this.comparePos() * size.width;
    const left = (this.compareLayers() && this.compareComposite) || img;
    ctx.drawImage(left as CanvasImageSource, 0, 0, size.width, size.height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(split, 0, size.width - split, size.height);
    ctx.clip();
    ctx.drawImage(painted, 0, 0, size.width, size.height);
    ctx.restore();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const [sx, top] = toScreen(view, split, 0);
    const [, bottom] = toScreen(view, split, size.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(sx - 1.5, top, 3, bottom - top);

    const cy = (top + bottom) / 2;
    ctx.beginPath();
    ctx.arc(sx, cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1d2427';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx + dir * 4, cy - 6);
      ctx.lineTo(sx + dir * 11, cy);
      ctx.lineTo(sx + dir * 4, cy + 6);
      ctx.fill();
    }

    ctx.font = '600 12px Inter, sans-serif';
    ctx.textBaseline = 'top';
    this.label(ctx, this.leftLabel(), sx - 12, top + 12, 'right');
    this.label(ctx, this.rightLabel(), sx + 12, top + 12, 'left');
  }

  private label(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    align: 'left' | 'right',
  ) {
    const w = ctx.measureText(text).width + 16;
    const left = align === 'left' ? x : x - w;
    ctx.fillStyle = 'rgba(29,36,39,0.75)';
    ctx.beginPath();
    ctx.roundRect(left, y, w, 22, 11);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(text, left + 8, y + 5);
  }

  private nearDivider(e: PointerEvent): boolean {
    const size = this.imageSize();
    if (!this.compare() || this.showBefore() || !size || !this.stage) return false;
    const [ix, iy] = this.stage.imagePoint(e);
    const tolerance = (e.pointerType === 'touch' ? 28 : 16) / this.view().scale;
    return (
      Math.abs(ix - this.comparePos() * size.width) <= tolerance && iy >= 0 && iy <= size.height
    );
  }

  private moveDivider(ix: number): void {
    const size = this.imageSize();
    if (!this.dragging() || !size) return;
    this.comparePos.set(Math.min(1, Math.max(0, ix / size.width)));
  }

  private selectWallAt(at: [number, number]): void {
    const size = this.imageSize();
    if (!size) return;
    const [x, y] = [Math.floor(at[0]), Math.floor(at[1])];
    if (x < 0 || y < 0 || x >= size.width || y >= size.height) return;
    const regions = this.store.regions();
    for (let i = regions.length - 1; i >= 0; i--) {
      const region = regions[i];
      if (!hasArea(region.selection)) continue;
      let hit = this.hitMasks.get(region.regionId);
      if (!hit || hit.selection !== region.selection) {
        hit = {
          selection: region.selection,
          alpha: rasterizeAlpha(region.selection, size.width, size.height),
        };
        this.hitMasks.set(region.regionId, hit);
      }
      if (hit.alpha[y * size.width + x] > 0) {
        this.store.activeRegionId.set(region.regionId);
        return;
      }
    }
  }

  private imageSize(): { width: number; height: number } | null {
    const img = this.store.image();
    return img ? { width: img.naturalWidth, height: img.naturalHeight } : null;
  }
}
